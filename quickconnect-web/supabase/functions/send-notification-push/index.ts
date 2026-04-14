import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type NotificationRow = {
  id: string
  user_id: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const auth = req.headers.get('Authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:quickconnect@localhost'
  const siteUrl = (Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/$/, '')

  if (!publicKey || !privateKey) {
    console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY')
    return json({ ok: false, error: 'Server misconfigured' }, 500)
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)

  let payload: { type?: string; table?: string; record?: NotificationRow }
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  if (payload.table !== 'notifications' || payload.type !== 'INSERT' || !payload.record) {
    return json({ ok: true, skipped: true })
  }

  const record = payload.record
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.user_id)

  if (subErr) {
    console.error('push_subscriptions select:', subErr)
    return json({ ok: false, error: subErr.message }, 500)
  }
  if (!subs?.length) return json({ ok: true, sent: 0 })

  const dataObj = record.data && typeof record.data === 'object' ? record.data : {}
  const path = typeof dataObj.path === 'string' ? dataObj.path : '/'
  const openUrl =
    siteUrl ? `${siteUrl}${path.startsWith('/') ? path : `/${path}`}` : path

  const pushPayload = JSON.stringify({
    title: record.title,
    body: record.body ?? '',
    tag: `notification-${record.id}`,
    data: { url: openUrl },
  })

  let sent = 0
  for (const row of subs) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }
    try {
      await webpush.sendNotification(subscription, pushPayload, { TTL: 86_400 })
      sent++
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      } else {
        console.error('webpush error:', e)
      }
    }
  }

  return json({ ok: true, sent })
})
