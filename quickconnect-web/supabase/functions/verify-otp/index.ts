import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Always return HTTP 200 so the client can read the actual error body.
const ok  = () =>
  new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
const err = (msg: string) =>
  new Response(JSON.stringify({ success: false, error: msg }), { headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return err('Missing Authorization header')

  let code: string
  try {
    const body = await req.json()
    code = body?.code
  } catch {
    return err('Invalid request body')
  }
  if (!code || !/^\d{6}$/.test(code)) return err('Code must be 6 digits')

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    console.error('Auth error:', authErr?.message)
    return err(`Auth failed: ${authErr?.message ?? 'no user'}`)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const now   = new Date().toISOString()

  const { data: record, error: lookupErr } = await admin
    .from('otp_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', now)
    .maybeSingle()

  if (lookupErr) {
    console.error('Lookup error:', lookupErr)
    return err(`DB error: ${lookupErr.message}`)
  }
  if (!record) return err('Invalid or expired code')

  await admin.from('otp_codes').update({ used: true }).eq('id', record.id)

  return ok()
})
