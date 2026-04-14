import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Quote } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import {
  Button,
  Card,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
  Modal,
  Input,
  Textarea,
} from '@/components/ui'

interface QuoteWithDetails extends Quote {
  profiles?: { full_name: string; avatar_url: string | null }
  service_providers?: {
    id: string
    business_name: string
    profile_id: string
    profiles?: { full_name: string; avatar_url: string | null }
  }
}

type QuoteFilter = 'all' | 'requested' | 'quoted' | 'accepted' | 'rejected'

const QUOTE_STATUS_CONFIG = {
  requested: { label: 'Awaiting Quote', variant: 'warning' as const },
  quoted:    { label: 'Quote Received', variant: 'info' as const },
  accepted:  { label: 'Accepted', variant: 'success' as const },
  rejected:  { label: 'Declined', variant: 'default' as const },
  expired:   { label: 'Expired', variant: 'default' as const },
}

const FILTER_TABS: { id: QuoteFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Pending' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Declined' },
]

export function Quotes() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QuoteFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Provider respond modal
  const [respondModal, setRespondModal] = useState<QuoteWithDetails | null>(null)
  const [respondAmount, setRespondAmount] = useState('')
  const [respondMessage, setRespondMessage] = useState('')
  const [respondError, setRespondError] = useState<string | null>(null)

  const isProvider = profile?.role === 'provider'

  const fetchQuotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      if (isProvider) {
        // Get provider row first
        const { data: providerRow } = await supabase
          .from('service_providers')
          .select('id')
          .eq('profile_id' as any, user.id as any)
          .single()
        const providerId = (providerRow as { id: string } | null)?.id
        if (!providerId) {
          setQuotes([])
          setLoading(false)
          return
        }

        const { data, error: fetchError } = await supabase
          .from('quotes')
          .select(`
            *,
            profiles!quotes_customer_id_fkey(full_name, avatar_url)
          `)
          .eq('provider_id' as any, providerId as any)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setQuotes((data ?? []) as unknown as QuoteWithDetails[])
      } else {
        const { data, error: fetchError } = await supabase
          .from('quotes')
          .select(`
            *,
            service_providers!quotes_provider_id_fkey(
              id, business_name, profile_id,
              profiles!service_providers_profile_id_fkey(full_name, avatar_url)
            )
          `)
          .eq('customer_id' as any, user.id as any)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setQuotes((data ?? []) as unknown as QuoteWithDetails[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotes')
    } finally {
      setLoading(false)
    }
  }, [user, isProvider])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  const filteredQuotes =
    filter === 'all'
      ? quotes
      : quotes.filter((q) => q.status === filter)

  const handleReject = async (quoteId: string) => {
    setActionLoading(quoteId)
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' } as any)
        .eq('id' as any, quoteId as any)
      if (error) throw error
      await fetchQuotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline quote')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAccept = async (quote: QuoteWithDetails) => {
    if (!user) return
    setActionLoading(quote.id)
    try {
      // Create a booking from the quote
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          provider_id: quote.provider_id,
          agreed_price: quote.quoted_amount ?? undefined,
          notes: `From quote: ${quote.service_description}`,
          status: 'confirmed',
        } as any)
        .select('id')
        .single()

      if (bookingError) throw bookingError
      const bookingId = (booking as { id: string } | null)?.id

      // Mark quote as accepted and link the booking
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ status: 'accepted', booking_id: bookingId ?? null } as any)
        .eq('id' as any, quote.id as any)
      if (quoteError) throw quoteError

      await fetchQuotes()
      if (bookingId) navigate(ROUTES.MY_BOOKINGS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept quote')
    } finally {
      setActionLoading(null)
    }
  }

  const handleProviderRespond = async () => {
    if (!respondModal || !respondAmount) return
    setRespondError(null)
    setActionLoading(respondModal.id)
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          quoted_amount: parseFloat(respondAmount),
          provider_message: respondMessage.trim() || null,
          status: 'quoted',
        } as any)
        .eq('id' as any, respondModal.id as any)
      if (error) throw error
      setRespondModal(null)
      setRespondAmount('')
      setRespondMessage('')
      await fetchQuotes()
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : 'Failed to submit quote')
    } finally {
      setActionLoading(null)
    }
  }

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
          <FileText className="size-10 text-primary-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">My Quotes</h1>
        <p className="mt-3 max-w-sm text-gray-500 text-sm leading-relaxed">
          Sign in to view and manage your quote requests.
        </p>
        <div className="mt-8">
          <Link to={ROUTES.LOGIN}>
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">My Quotes</h1>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">
          {isProvider
            ? 'Review and respond to quote requests from customers'
            : 'Track quote requests you\'ve sent to providers'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.id
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
          action={<Button variant="outline" onClick={fetchQuotes}>Try again</Button>}
        />
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-12 text-gray-400" />}
          title="No quotes found"
          description={
            filter === 'all'
              ? isProvider
                ? 'Quote requests from customers will appear here.'
                : 'Browse providers and request a quote to get started.'
              : `No ${filter} quotes.`
          }
          action={
            !isProvider && filter === 'all' ? (
              <Link to={ROUTES.PROVIDERS}>
                <Button>Browse Providers</Button>
              </Link>
            ) : filter !== 'all' ? (
              <Button variant="outline" onClick={() => setFilter('all')}>View all</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredQuotes.map((quote) => {
            const expanded = expandedId === quote.id
            const statusCfg = QUOTE_STATUS_CONFIG[quote.status as keyof typeof QUOTE_STATUS_CONFIG]

            // Display name and avatar differ by role
            const displayName = isProvider
              ? (quote.profiles?.full_name ?? 'Customer')
              : (quote.service_providers?.business_name ?? 'Provider')
            const displayAvatar = isProvider
              ? quote.profiles?.avatar_url
              : quote.service_providers?.profiles?.avatar_url

            return (
              <Card key={quote.id} padding="none">
                <div
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-5"
                  onClick={() => setExpandedId(expanded ? null : quote.id)}
                >
                  <div className="flex items-center gap-4">
                    <Avatar src={displayAvatar} fallback={displayName} size="md" />
                    <div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1">
                        {quote.service_description}
                      </h3>
                      <p className="text-sm text-gray-500">{displayName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(quote.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {quote.quoted_amount != null && (
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(quote.quoted_amount)}
                      </span>
                    )}
                    <Badge variant={statusCfg?.variant ?? 'default'}>
                      {statusCfg?.label ?? quote.status}
                    </Badge>
                    {expanded ? (
                      <ChevronUp className="size-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="size-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-3">
                    {/* Request details */}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Service requested</p>
                      <p className="text-sm text-gray-600 mt-0.5">{quote.service_description}</p>
                    </div>
                    {(quote.budget_min != null || quote.budget_max != null) && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Customer budget</p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {quote.budget_min != null && quote.budget_max != null
                            ? `${formatCurrency(quote.budget_min)} – ${formatCurrency(quote.budget_max)}`
                            : quote.budget_min != null
                              ? `From ${formatCurrency(quote.budget_min)}`
                              : `Up to ${formatCurrency(quote.budget_max!)}`}
                        </p>
                      </div>
                    )}
                    {quote.customer_message && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Customer's message</p>
                        <p className="text-sm text-gray-600 mt-0.5">{quote.customer_message}</p>
                      </div>
                    )}

                    {/* Provider's response */}
                    {quote.quoted_amount != null && (
                      <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                        <p className="text-sm font-medium text-primary-800">Provider's quote</p>
                        <p className="text-xl font-bold text-primary-700 mt-1">
                          {formatCurrency(quote.quoted_amount)}
                        </p>
                        {quote.provider_message && (
                          <p className="text-sm text-primary-700 mt-1">{quote.provider_message}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Provider: respond to pending request */}
                      {isProvider && quote.status === 'requested' && (
                        <Button
                          size="sm"
                          icon={<Send className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRespondError(null)
                            setRespondAmount('')
                            setRespondMessage('')
                            setRespondModal(quote)
                          }}
                        >
                          Send Quote
                        </Button>
                      )}
                      {isProvider && quote.status === 'requested' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger-600 hover:bg-danger-50"
                          icon={<XCircle className="size-4" />}
                          loading={actionLoading === quote.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReject(quote.id)
                          }}
                        >
                          Decline
                        </Button>
                      )}

                      {/* Customer: accept or reject a quoted price */}
                      {!isProvider && quote.status === 'quoted' && (
                        <>
                          <Button
                            size="sm"
                            icon={<CheckCircle2 className="size-4" />}
                            loading={actionLoading === quote.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAccept(quote)
                            }}
                          >
                            Accept & Book
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger-600 hover:bg-danger-50"
                            icon={<XCircle className="size-4" />}
                            loading={actionLoading === quote.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReject(quote.id)
                            }}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {/* Accepted: go to booking */}
                      {quote.status === 'accepted' && quote.booking_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Wallet className="size-4" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(ROUTES.MY_BOOKINGS)
                          }}
                        >
                          View Booking
                        </Button>
                      )}

                      {/* Status indicators */}
                      {quote.status === 'requested' && !isProvider && (
                        <span className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock className="size-4" />
                          Waiting for provider to respond
                        </span>
                      )}
                      {quote.status === 'accepted' && (
                        <span className="flex items-center gap-1.5 text-sm text-success-600">
                          <CheckCircle2 className="size-4" />
                          Quote accepted — booking created
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Provider: Respond with quote modal */}
      <Modal
        isOpen={!!respondModal}
        onClose={() => setRespondModal(null)}
        title="Send Your Quote"
        size="md"
      >
        {respondModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-700">Customer's request</p>
              <p className="text-sm text-gray-600 mt-1">{respondModal.service_description}</p>
              {(respondModal.budget_min != null || respondModal.budget_max != null) && (
                <p className="text-sm text-gray-500 mt-1">
                  Budget:{' '}
                  {respondModal.budget_min != null && respondModal.budget_max != null
                    ? `${formatCurrency(respondModal.budget_min)} – ${formatCurrency(respondModal.budget_max)}`
                    : respondModal.budget_min != null
                      ? `From ${formatCurrency(respondModal.budget_min)}`
                      : `Up to ${formatCurrency(respondModal.budget_max!)}`}
                </p>
              )}
            </div>

            {respondError && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{respondError}</div>
            )}

            <Input
              label="Your quoted price (BWP) *"
              type="number"
              min="0"
              step="0.01"
              value={respondAmount}
              onChange={(e) => setRespondAmount(e.target.value)}
              placeholder="0.00"
            />
            <Textarea
              label="Message to customer (optional)"
              value={respondMessage}
              onChange={(e) => setRespondMessage(e.target.value)}
              placeholder="Describe what's included, timeline, any conditions..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRespondModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleProviderRespond}
                loading={actionLoading === respondModal.id}
                disabled={!respondAmount}
                icon={<Send className="size-4" />}
              >
                Send Quote
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
