import { ROUTES } from '@/lib/constants'
import type { Notification } from '@/lib/types'
import type { Json } from '@/lib/database.types'

export type NotificationNavContext = {
  role?: 'customer' | 'provider' | 'admin' | null
}

function asRecord(data: Json | null): Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return {}
  return data as Record<string, unknown>
}

/**
 * Resolves in-app navigation path for a notification row.
 * Uses `data.path` when present, then `type` + structured `data` (back-compat with older rows).
 */
export function getNotificationNavTarget(
  n: Pick<Notification, 'type' | 'data'>,
  ctx?: NotificationNavContext
): string | null {
  const d = asRecord(n.data)
  const type = n.type ?? ''

  const rawPath = typeof d.path === 'string' ? d.path.trim() : ''
  if (rawPath) {
    let path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    if (typeof d.payment_id === 'string' && d.payment_id && !path.includes('payment=')) {
      const sep = path.includes('?') ? '&' : '?'
      path = `${path}${sep}payment=${encodeURIComponent(d.payment_id)}`
    }
    return path
  }

  if (type === 'message' || type === 'new_message') {
    const cid =
      (typeof d.conversation_id === 'string' && d.conversation_id) ||
      (typeof d.conversationId === 'string' && d.conversationId) ||
      null
    if (cid) return ROUTES.CHAT_CONVERSATION.replace(':id', cid)
  }

  if (type === 'new_post') {
    const pid = typeof d.post_id === 'string' ? d.post_id : null
    if (pid) return ROUTES.POST_DETAIL.replace(':id', pid)
  }

  if (type === 'category_request_reviewed') {
    return `${ROUTES.DASHBOARD}#dashboard-category-requests`
  }

  if (type === 'service_linked') {
    return `${ROUTES.PROFILE}?section=business`
  }

  // Admin-facing dispute types → always go to admin reports
  if (type === 'payment_dispute') {
    const payId = typeof d.payment_id === 'string' ? d.payment_id : null
    if (payId) return `${ROUTES.ADMIN_REPORTS}?payment=${encodeURIComponent(payId)}`
    const bookingId = typeof d.booking_id === 'string' ? d.booking_id : null
    if (bookingId) return `${ROUTES.ADMIN_REPORTS}`
    return ROUTES.ADMIN_REPORTS
  }

  // Dispute debit → wallet page for customer
  if (type === 'dispute_debit') {
    return ROUTES.WALLET
  }

  // Customer/provider dispute types → bookings page; admin variant goes to reports
  if (
    type === 'payment_disputed' ||
    type === 'payment_held' ||
    type === 'payment_released' ||
    type === 'payment_refunded' ||
    type === 'dispute_resolved' ||
    type === 'dispute_statement'
  ) {
    const payId = typeof d.payment_id === 'string' ? d.payment_id : null
    const bookingId = typeof d.booking_id === 'string' ? d.booking_id : null
    if (ctx?.role === 'admin' && payId) {
      return `${ROUTES.ADMIN_REPORTS}?payment=${encodeURIComponent(payId)}`
    }
    if (bookingId) {
      return `${ROUTES.MY_BOOKINGS}?booking=${encodeURIComponent(bookingId)}`
    }
  }

  if (type === 'new_review') {
    const bid = typeof d.booking_id === 'string' ? d.booking_id : null
    if (bid) return `${ROUTES.MY_BOOKINGS}?booking=${encodeURIComponent(bid)}`
    return ROUTES.MY_BOOKINGS
  }

  if (type.startsWith('quote') || type === 'quote_request') {
    const qid = typeof d.quote_id === 'string' ? d.quote_id : null
    return qid ? `${ROUTES.QUOTES}?quote=${encodeURIComponent(qid)}` : ROUTES.QUOTES
  }

  if (
    type.startsWith('booking') ||
    type.startsWith('payment_awaiting') ||
    type.startsWith('settlement') ||
    type === 'response_accepted' ||
    type === 'response_rejected'
  ) {
    const bid = typeof d.booking_id === 'string' ? d.booking_id : null
    if (bid) return `${ROUTES.MY_BOOKINGS}?booking=${encodeURIComponent(bid)}`
    const pid = typeof d.post_id === 'string' ? d.post_id : null
    if (pid) return ROUTES.POST_DETAIL.replace(':id', pid)
  }

  if (typeof d.booking_id === 'string' && d.booking_id) {
    return `${ROUTES.MY_BOOKINGS}?booking=${encodeURIComponent(d.booking_id)}`
  }
  if (typeof d.conversation_id === 'string' && d.conversation_id) {
    return ROUTES.CHAT_CONVERSATION.replace(':id', d.conversation_id)
  }
  if (typeof d.post_id === 'string' && d.post_id) {
    return ROUTES.POST_DETAIL.replace(':id', d.post_id)
  }
  if (typeof d.quote_id === 'string' && d.quote_id) {
    return ROUTES.QUOTES
  }

  return null
}
