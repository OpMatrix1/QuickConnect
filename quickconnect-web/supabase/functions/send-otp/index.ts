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

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller's existing password session
  const userClient = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user?.email) {
    console.error('Auth error:', authErr?.message)
    return err(`Auth failed: ${authErr?.message ?? 'no user'}`)
  }

  // Call Supabase's GoTrue admin API — sends the OTP email via your configured
  // Supabase SMTP and returns the 6-digit code as email_otp.
  const genRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({ type: 'magiclink', email: user.email }),
  })

  const genData = await genRes.json()
  console.log('generate_link status:', genRes.status, '| email_otp:', genData?.email_otp ?? '(none)', '| body:', JSON.stringify(genData))

  if (!genRes.ok) {
    return err(`generate_link failed (${genRes.status}): ${genData?.msg ?? genData?.message ?? genData?.error ?? 'unknown'}`)
  }

  const code: string | undefined = genData?.email_otp
  if (!code || !/^\d{6}$/.test(code)) {
    return err(`email_otp not a 6-digit code — got: "${code ?? 'undefined'}"`)
  }

  const admin      = createClient(supabaseUrl, serviceRoleKey)
  const expiresAt  = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await admin.from('otp_codes').update({ used: true }).eq('user_id', user.id).eq('used', false)

  const { error: insertErr } = await admin.from('otp_codes').insert({ user_id: user.id, code, expires_at: expiresAt })
  if (insertErr) {
    console.error('Insert error:', insertErr)
    return err(`DB insert failed: ${insertErr.message}`)
  }

  return ok()
})
