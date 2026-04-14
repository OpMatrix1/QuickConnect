import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  X,
  Play,
  Star,
  Wallet,
  MessageCircle,
  CalendarCheck,
  Edit2,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/constants'
import {
  formatCurrency,
  formatDate,
  formatTime,
  BOOKING_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from '@/lib/utils'
import type { Booking, BookingStatus, PaymentStatus } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import {
  Button,
  Card,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
  Textarea,
  Modal,
  StarRating,
  Input,
} from '@/components/ui'

type StatusFilter = 'all' | BookingStatus

interface BookingWithDetails extends Booking {
  service_providers?: {
    profile_id: string
    profiles: { full_name: string; avatar_url: string | null }
  }
  profiles?: { full_name: string; avatar_url: string | null }
  services?: { title: string } | null
  looking_for_responses?: { looking_for_posts: { title: string } } | null
  payments?: { id: string; status: PaymentStatus; customer_confirmed: boolean; provider_confirmed: boolean }[]
  reviews?: { id: string }[]
}

// Cancelled moved after in_progress, completed stays last
const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'completed', label: 'Completed' },
]

function getBookingTitle(b: BookingWithDetails): string {
  if (b.services?.title) return b.services.title
  if (b.looking_for_responses?.looking_for_posts?.title)
    return b.looking_for_responses.looking_for_posts.title
  return 'Booking'
}

function getOtherParty(b: BookingWithDetails, isProvider: boolean) {
  if (isProvider) {
    return b.profiles?.full_name ?? 'Customer'
  }
  return b.service_providers?.profiles?.full_name ?? 'Provider'
}

function getOtherPartyAvatar(b: BookingWithDetails, isProvider: boolean) {
  if (isProvider) {
    return b.profiles?.avatar_url
  }
  return b.service_providers?.profiles?.avatar_url
}

/** Nested `payments(...)` embeds often come back empty under RLS; merge from a direct query. */
async function mergePaymentsIntoBookings(
  rows: BookingWithDetails[]
): Promise<BookingWithDetails[]> {
  if (rows.length === 0) return rows
  const ids = rows.map((b) => b.id)
  const { data: payRows, error } = await supabase
    .from('payments')
    .select('id, booking_id, status, customer_confirmed, provider_confirmed')
    .in('booking_id', ids)

  if (error || !payRows?.length) return rows

  const byBooking = new Map<string, NonNullable<BookingWithDetails['payments']>>()
  for (const raw of payRows) {
    const p = raw as {
      id: string
      booking_id: string
      status: PaymentStatus
      customer_confirmed: boolean
      provider_confirmed: boolean
    }
    const row = {
      id: p.id,
      status: p.status,
      customer_confirmed: p.customer_confirmed,
      provider_confirmed: p.provider_confirmed,
    }
    const cur = byBooking.get(p.booking_id)
    if (cur) cur.push(row)
    else byBooking.set(p.booking_id, [row])
  }

  return rows.map((b) => {
    const merged = byBooking.get(b.id)
    return merged?.length ? { ...b, payments: merged } : b
  })
}

export function MyBookings() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState<BookingWithDetails | null>(null)
  const [paymentModal, setPaymentModal] = useState<BookingWithDetails | null>(null)
  const [editModal, setEditModal] = useState<BookingWithDetails | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [providerIdForRealtime, setProviderIdForRealtime] = useState<string | null>(null)
  const isProvider = profile?.role === 'provider'

  // Edit modal form state
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPrice, setEditPrice] = useState('')

  const fetchBookings = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      if (isProvider) {
        const { data: providerRow } = await supabase
          .from('service_providers')
          .select('id')
          .eq('profile_id' as any, user.id as any)
          .single()
        const providerId = (providerRow as { id: string } | null)?.id
        if (!providerId) {
          setProviderIdForRealtime(null)
          setBookings([])
          if (!opts?.silent) setLoading(false)
          return
        }
        setProviderIdForRealtime(providerId)

        const { data, error: fetchError } = await supabase
          .from('bookings')
          .select(
            `
            *,
            profiles!bookings_customer_id_fkey(full_name, avatar_url),
            services(title),
            looking_for_responses(looking_for_posts(title)),
            payments(id, status, customer_confirmed, provider_confirmed),
            reviews(id)
          `
          )
          .eq('provider_id' as any, providerId as any)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        const withPayments = await mergePaymentsIntoBookings(
          (data ?? []) as unknown as BookingWithDetails[]
        )
        setBookings(withPayments)
      } else {
        setProviderIdForRealtime(null)
        const { data, error: fetchError } = await supabase
          .from('bookings')
          .select(
            `
            *,
            service_providers!bookings_provider_id_fkey(
              profile_id,
              profiles!service_providers_profile_id_fkey(full_name, avatar_url)
            ),
            services(title),
            looking_for_responses(looking_for_posts(title)),
            payments(id, status, customer_confirmed, provider_confirmed),
            reviews(id)
          `
          )
          .eq('customer_id' as any, user.id as any)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        const withPayments = await mergePaymentsIntoBookings(
          (data ?? []) as unknown as BookingWithDetails[]
        )
        setBookings(withPayments)
      }
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Failed to load bookings')
        setBookings([])
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [user, isProvider])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    if (!user?.id) return
    if (isProvider && !providerIdForRealtime) return

    const filter = isProvider
      ? `provider_id=eq.${providerIdForRealtime}`
      : `customer_id=eq.${user.id}`

    const channel = supabase
      .channel(`bookings-list:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter,
        },
        () => {
          void fetchBookings({ silent: true })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, isProvider, providerIdForRealtime, fetchBookings])

  const filteredBookings =
    statusFilter === 'all'
      ? bookings
      : bookings.filter((b) => b.status === statusFilter)

  const updateBookingStatus = async (
    bookingId: string,
    newStatus: Booking['status']
  ) => {
    setActionLoading(bookingId)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus } as any)
        .eq('id' as any, bookingId as any)
      if (error) throw error
      await fetchBookings()
      setExpandedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setActionLoading(null)
    }
  }

  const openEditModal = (booking: BookingWithDetails) => {
    setEditDate(booking.scheduled_date ?? '')
    setEditTime(booking.scheduled_time ?? '')
    setEditAddress(booking.location_address ?? '')
    setEditNotes(booking.notes ?? '')
    setEditPrice(booking.agreed_price != null ? String(booking.agreed_price) : '')
    setEditModal(booking)
  }

  const submitEdit = async () => {
    if (!editModal) return
    setActionLoading(editModal.id)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          scheduled_date: editDate || null,
          scheduled_time: editTime || null,
          location_address: editAddress || null,
          notes: editNotes || null,
          agreed_price: editPrice ? parseFloat(editPrice) : null,
        } as any)
        .eq('id' as any, editModal.id as any)
      if (error) throw error
      setEditModal(null)
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update booking')
    } finally {
      setActionLoading(null)
    }
  }

  const submitReview = async () => {
    if (!reviewModal || !user) return
    setActionLoading(reviewModal.id)
    try {
      const { error } = await supabase.from('reviews').insert({
        booking_id: reviewModal.id,
        customer_id: user.id,
        provider_id: reviewModal.provider_id,
        rating: reviewRating,
        comment: reviewComment || null,
      } as any)
      if (error) throw error
      setReviewModal(null)
      setReviewRating(5)
      setReviewComment('')
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setActionLoading(null)
    }
  }

  const fetchWalletBalance = async () => {
    if (!user) return
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id' as any, user.id as any)
      .single()
    setWalletBalance((data as { balance: number } | null)?.balance ?? null)
  }

  const openPaymentModal = async (booking: BookingWithDetails) => {
    setPaymentModal(booking)
    await fetchWalletBalance()
  }

  const submitPayment = async () => {
    if (!paymentModal || !user) return
    setActionLoading(paymentModal.id)
    try {
      const { error } = await supabase.rpc('initiate_wallet_payment', {
        p_booking_id: paymentModal.id,
        p_amount: paymentModal.agreed_price ?? 0,
      } as never)
      if (error) throw error
      setPaymentModal(null)
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment')
    } finally {
      setActionLoading(null)
    }
  }

  const confirmSatisfaction = async (bookingId: string) => {
    if (!user) return
    setActionLoading(bookingId)
    try {
      const booking = bookings.find((b) => b.id === bookingId)
      const payment = booking?.payments?.[0]
      if (!payment) return

      const field = isProvider ? 'provider_confirmed' : 'customer_confirmed'

      const { error } = await supabase
        .from('payments')
        .update({ [field]: true } as any)
        .eq('id' as any, payment.id as any)
      if (error) throw error
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm')
    } finally {
      setActionLoading(null)
    }
  }

  const disputePayment = async (bookingId: string) => {
    if (!user) return
    setActionLoading(bookingId)
    try {
      const booking = bookings.find((b) => b.id === bookingId)
      const payment = booking?.payments?.[0]
      if (!payment) return
      const { error } = await supabase
        .from('payments')
        .update({ status: 'disputed' } as any)
        .eq('id' as any, payment.id as any)
      if (error) throw error
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispute')
    } finally {
      setActionLoading(null)
    }
  }

  // Can cancel if still pending or confirmed (before work has started)
  const canCancel = (b: BookingWithDetails) =>
    !['in_progress', 'completed', 'cancelled'].includes(b.status)

  const hasPayment = (b: BookingWithDetails) =>
    b.payments && b.payments.length > 0
  const hasReview = (b: BookingWithDetails) =>
    b.reviews && b.reviews.length > 0

  // Payment can be initiated when confirmed or in_progress (proper escrow: pay before work releases)
  const canPay = (b: BookingWithDetails) =>
    !isProvider &&
    (b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed') &&
    !hasPayment(b) &&
    (b.agreed_price ?? 0) > 0

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center px-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-primary-50 mb-6">
          <CalendarCheck className="size-10 text-primary-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">View your bookings</h1>
        <p className="mt-3 max-w-sm text-gray-500 text-sm leading-relaxed">
          Sign in to your account to track your bookings, manage appointments,
          and communicate with service providers.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center justify-center rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-sm"
          >
            Sign In
          </Link>
          <Link
            to={ROUTES.REGISTER}
            className="inline-flex items-center justify-center rounded-xl border-2 border-primary-500 px-6 py-3 text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
          >
            Create a Free Account
          </Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          My Bookings
        </h1>
        <p className="mt-1 text-gray-600">
          {isProvider
            ? 'Manage your service bookings and appointments'
            : 'Track your bookings and service requests'}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          To confirm satisfaction and release escrow (or dispute), expand the relevant booking below — not on the Wallet page.
        </p>
      </div>

      {/* Status tabs — cancelled before completed */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="size-12 text-danger-500" />}
          title="Something went wrong"
          description={error}
          action={
            <Button variant="outline" onClick={() => void fetchBookings()}>
              Try again
            </Button>
          }
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="size-12 text-gray-400" />}
          title="No bookings found"
          description={
            statusFilter === 'all'
              ? 'Your bookings will appear here when you make or receive requests.'
              : `No ${statusFilter} bookings.`
          }
          action={
            statusFilter !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => setStatusFilter('all')}
              >
                View all
              </Button>
            ) : isProvider ? (
              <Link to={ROUTES.LOOKING_FOR}>
                <Button>Browse opportunities</Button>
              </Link>
            ) : (
              <Link to={ROUTES.PROVIDERS}>
                <Button>Find providers</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const config =
              BOOKING_STATUS_CONFIG[booking.status as keyof typeof BOOKING_STATUS_CONFIG]
            const expanded = expandedId === booking.id
            const otherName = getOtherParty(booking, isProvider)
            const otherAvatar = getOtherPartyAvatar(booking, isProvider)

            return (
              <Card key={booking.id} padding="none">
                <div
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-5"
                  onClick={() =>
                    setExpandedId(expanded ? null : booking.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <Avatar
                      src={otherAvatar}
                      fallback={otherName}
                      size="lg"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getBookingTitle(booking)}
                      </h3>
                      <p className="text-sm text-gray-600">{otherName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        {booking.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            {formatDate(booking.scheduled_date)}
                            {booking.scheduled_time &&
                              ` at ${formatTime(booking.scheduled_time)}`}
                          </span>
                        )}
                        {booking.location_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-4" />
                            {booking.location_address}
                          </span>
                        )}
                        {booking.agreed_price != null && (
                          <span className="font-medium text-gray-700">
                            {formatCurrency(booking.agreed_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        booking.status === 'completed'
                          ? 'success'
                          : booking.status === 'cancelled'
                            ? 'default'
                            : 'warning'
                      }
                    >
                      {config?.label ?? booking.status}
                    </Badge>
                    {expanded ? (
                      <ChevronUp className="size-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="size-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                    {booking.notes && (
                      <p className="mb-4 text-sm text-gray-600">
                        <strong>Notes:</strong> {booking.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {/* Provider actions */}
                      {isProvider && (
                        <>
                          {booking.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                icon={<Check className="size-4" />}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateBookingStatus(booking.id, 'confirmed')
                                }}
                                loading={actionLoading === booking.id}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<X className="size-4" />}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateBookingStatus(booking.id, 'cancelled')
                                }}
                                loading={actionLoading === booking.id}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          {booking.status === 'confirmed' && (
                            <Button
                              size="sm"
                              icon={<Play className="size-4" />}
                              onClick={(e) => {
                                e.stopPropagation()
                                updateBookingStatus(booking.id, 'in_progress')
                              }}
                              loading={actionLoading === booking.id}
                            >
                              Mark In Progress
                            </Button>
                          )}
                          {booking.status === 'in_progress' && (
                            <Button
                              size="sm"
                              icon={<Check className="size-4" />}
                              onClick={(e) => {
                                e.stopPropagation()
                                updateBookingStatus(booking.id, 'completed')
                              }}
                              loading={actionLoading === booking.id}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </>
                      )}

                      {/* Customer: edit pending booking */}
                      {!isProvider && booking.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Edit2 className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(booking)
                          }}
                        >
                          Edit Details
                        </Button>
                      )}

                      {/* Escrow & payment outcome — show before pay/review so confirmation is visible */}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'held' && (
                        <div className="flex w-full basis-full flex-col gap-2 border-t border-gray-200 pt-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-blue-500" />
                            <Badge variant="info">
                              {PAYMENT_STATUS_CONFIG.held.label}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {formatCurrency(booking.agreed_price ?? 0)} secured in escrow
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Funds are held securely. Once both parties confirm satisfaction the payment is released to the provider.
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>Customer: {booking.payments[0].customer_confirmed ? '✓ Confirmed' : 'Pending'}</span>
                            <span>&bull;</span>
                            <span>Provider: {booking.payments[0].provider_confirmed ? '✓ Confirmed' : 'Pending'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!(isProvider ? booking.payments[0].provider_confirmed : booking.payments[0].customer_confirmed) && (
                              <Button
                                size="sm"
                                icon={<Check className="size-4" />}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmSatisfaction(booking.id)
                                }}
                                loading={actionLoading === booking.id}
                              >
                                Confirm Satisfied
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger-600 hover:bg-danger-50"
                              icon={<AlertCircle className="size-4" />}
                              onClick={(e) => {
                                e.stopPropagation()
                                disputePayment(booking.id)
                              }}
                              loading={actionLoading === booking.id}
                            >
                              Raise Dispute
                            </Button>
                          </div>
                        </div>
                      )}

                      {hasPayment(booking) && booking.payments?.[0]?.status === 'released' && (
                        <Badge variant="success">Payment Released to Provider</Badge>
                      )}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'disputed' && (
                        <Badge variant="danger">Payment Disputed — Admin Reviewing</Badge>
                      )}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'refunded' && (
                        <Badge variant="warning">Payment Refunded to Customer</Badge>
                      )}

                      {/* Customer: pay from wallet (available from confirmed onwards) */}
                      {canPay(booking) && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Wallet className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            openPaymentModal(booking)
                          }}
                        >
                          Pay from Wallet
                        </Button>
                      )}

                      {/* Customer: leave review after completion */}
                      {!isProvider && booking.status === 'completed' && !hasReview(booking) && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Star className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setReviewModal(booking)
                          }}
                        >
                          Leave Review
                        </Button>
                      )}

                      {/* Cancel (before in_progress) */}
                      {canCancel(booking) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger-600 hover:bg-danger-50"
                          icon={<X className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateBookingStatus(booking.id, 'cancelled')
                          }}
                          loading={actionLoading === booking.id}
                        >
                          Cancel Booking
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<MessageCircle className="size-4" />}
                        onClick={async (e) => {
                          e.stopPropagation()
                          const otherId = isProvider
                            ? booking.customer_id
                            : booking.service_providers?.profile_id
                          if (!otherId) return
                          const [p1, p2] =
                            user!.id < otherId
                              ? [user!.id, otherId]
                              : [otherId, user!.id]
                          const { data: existing } = await supabase
                            .from('conversations')
                            .select('id')
                            .eq('participant_1' as any, p1 as any)
                            .eq('participant_2' as any, p2 as any)
                            .maybeSingle()
                          const existingId = (existing as { id: string } | null)?.id
                          if (existingId) {
                            navigate(ROUTES.CHAT_CONVERSATION.replace(':id', existingId))
                            return
                          }
                          const { data: inserted, error } = await supabase
                            .from('conversations')
                            .insert({ participant_1: p1, participant_2: p2 } as any)
                            .select('id')
                            .single()
                          const insertedId = (inserted as { id: string } | null)?.id
                          if (!error && insertedId) {
                            navigate(ROUTES.CHAT_CONVERSATION.replace(':id', insertedId))
                          }
                        }}
                      >
                        Chat
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Booking Modal — for customers with pending bookings */}
      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title="Edit Booking Details"
        size="md"
      >
        {editModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Update the details for your pending booking. The provider will see your changes.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Preferred Date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <Input
                label="Preferred Time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
            <Input
              label="Location / Address"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Gaborone"
            />
            <Input
              label="Agreed Price (BWP)"
              type="number"
              min="0"
              step="0.01"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="0.00"
            />
            <Textarea
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Any additional details for the provider..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitEdit}
                loading={actionLoading === editModal.id}
                icon={<Check className="size-4" />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Leave a Review"
        size="md"
      >
        {reviewModal && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Rating</p>
              <StarRating
                rating={reviewRating}
                onChange={setReviewRating}
                size="lg"
              />
            </div>
            <Textarea
              label="Comment (optional)"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitReview}
                loading={actionLoading === reviewModal.id}
              >
                Submit Review
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        title="Pay from Wallet"
        size="md"
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <p className="text-sm text-gray-500">Amount to pay</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(paymentModal.agreed_price ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Your wallet balance</p>
                <p className={`text-lg font-semibold ${
                  walletBalance !== null && walletBalance < (paymentModal.agreed_price ?? 0)
                    ? 'text-danger-600'
                    : 'text-success-600'
                }`}>
                  {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
                </p>
              </div>
            </div>

            {walletBalance !== null && walletBalance < (paymentModal.agreed_price ?? 0) && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
                <strong>Insufficient balance.</strong> You need{' '}
                {formatCurrency((paymentModal.agreed_price ?? 0) - walletBalance)} more.{' '}
                <a href={ROUTES.WALLET} className="underline font-medium">Top up your wallet</a> first.
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <div className="flex items-start gap-2">
                <ShieldCheck className="size-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Escrow protection:</strong> The amount is deducted from your wallet and held securely by QuickConnect. Once both you and the provider confirm the work is complete and satisfactory, funds are released to the provider. If there is a dispute, an admin will review and resolve it.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitPayment}
                loading={actionLoading === paymentModal.id}
                disabled={
                  walletBalance !== null &&
                  walletBalance < (paymentModal.agreed_price ?? 0)
                }
                icon={<Wallet className="size-4" />}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
