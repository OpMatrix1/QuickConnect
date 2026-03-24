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

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
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
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const isProvider = profile?.role === 'provider'

  const fetchBookings = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      if (isProvider) {
        const { data: providerRow } = await supabase
          .from('service_providers')
          .select('id')
          .eq('profile_id', user.id)
          .single()
        const providerId = (providerRow as { id: string } | null)?.id
        if (!providerId) {
          setBookings([])
          setLoading(false)
          return
        }

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
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setBookings((data ?? []) as unknown as BookingWithDetails[])
      } else {
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
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setBookings((data ?? []) as unknown as BookingWithDetails[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [user, isProvider])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

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
        .update({ status: newStatus })
        .eq('id', bookingId)
      if (error) throw error
      await fetchBookings()
      setExpandedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
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
      })
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
      .eq('user_id', user.id)
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
      })
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
        .eq('id', payment.id)
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
        .eq('id', payment.id)
      if (error) throw error
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispute')
    } finally {
      setActionLoading(null)
    }
  }

  const canCancel = (b: BookingWithDetails) =>
    !['in_progress', 'completed', 'cancelled'].includes(b.status)

  const hasPayment = (b: BookingWithDetails) =>
    b.payments && b.payments.length > 0
  const hasReview = (b: BookingWithDetails) =>
    b.reviews && b.reviews.length > 0

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    navigate(ROUTES.LOGIN, { replace: true })
    return null
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
      </div>

      {/* Status tabs */}
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
            <Button variant="outline" onClick={fetchBookings}>
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
                                Cancel
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

                      {/* Customer actions */}
                      {!isProvider && booking.status === 'completed' && (
                        <>
                          {!hasReview(booking) && (
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
                          {!hasPayment(booking) && (
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
                        </>
                      )}

                      {/* Escrow actions */}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'held' && (
                        <div className="flex w-full flex-col gap-2 border-t border-gray-200 pt-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="info">
                              {PAYMENT_STATUS_CONFIG.held.label}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {formatCurrency(booking.agreed_price ?? 0)} held in escrow
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>Customer: {booking.payments[0].customer_confirmed ? 'Confirmed' : 'Pending'}</span>
                            <span>&bull;</span>
                            <span>Provider: {booking.payments[0].provider_confirmed ? 'Confirmed' : 'Pending'}</span>
                          </div>
                          <div className="flex gap-2">
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
                              Dispute
                            </Button>
                          </div>
                        </div>
                      )}

                      {hasPayment(booking) && booking.payments?.[0]?.status === 'released' && (
                        <Badge variant="success">Payment Released</Badge>
                      )}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'disputed' && (
                        <Badge variant="danger">Payment Disputed — Admin Reviewing</Badge>
                      )}
                      {hasPayment(booking) && booking.payments?.[0]?.status === 'refunded' && (
                        <Badge variant="warning">Payment Refunded</Badge>
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
                          Cancel
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
                            .eq('participant_1', p1)
                            .eq('participant_2', p2)
                            .maybeSingle()
                          const existingId = (existing as { id: string } | null)?.id
                          if (existingId) {
                            navigate(ROUTES.CHAT_CONVERSATION.replace(':id', existingId))
                            return
                          }
                          const { data: inserted, error } = await supabase
                            .from('conversations')
                            .insert({ participant_1: p1, participant_2: p2 })
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
              <strong>Escrow protection:</strong> The amount is deducted from your wallet and held securely. Once both you and the provider confirm satisfaction, it's released to the provider.
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
