import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Web Push is not targeted at iPhone Safari / iOS PWAs in this project. */
export function isWebPushTargetPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return false
  return true
}

export function isWebPushSupported(): boolean {
  if (!isWebPushTargetPlatform()) return false
  if (!VAPID_PUBLIC?.trim()) return false
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Persist current browser subscription for this user (e.g. after login). */
export async function syncPushSubscriptionToProfile(userId: string): Promise<void> {
  if (!isWebPushSupported()) return
  const sub = await getExistingPushSubscription()
  if (!sub) return
  const json = sub.toJSON()
  const pk = json.keys?.p256dh
  const ak = json.keys?.auth
  if (!pk || !ak) return
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: pk,
      auth: ak,
    },
    { onConflict: 'endpoint' },
  )
}

export async function subscribeWebPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isWebPushSupported() || !VAPID_PUBLIC) {
    return { ok: false, error: 'Push is not available in this browser.' }
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return { ok: false, error: 'Notification permission was not granted.' }
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC.trim()) as BufferSource,
    })
  }
  const raw = sub.toJSON()
  const pk = raw.keys?.p256dh
  const ak = raw.keys?.auth
  if (!pk || !ak) return { ok: false, error: 'Invalid push keys.' }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: pk,
      auth: ak,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function unsubscribeWebPush(): Promise<void> {
  const sub = await getExistingPushSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
