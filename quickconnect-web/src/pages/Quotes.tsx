import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([])
  const [providerId, setProviderId] = useState<string | null>(null)
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
  const [customerWalletWithdrawable, setCustomerWalletWithdrawable] = useState<number | null>(null)

  const isProvider = profile?.role === 'provider'

  const fetchCustomerWalletWithdrawable = useCallback(async () => {
    if (!user || isProvider) return
    const { data } = await supabase
      .from('wallets')
      .select('balance, reserved_balance')
      .eq('user_id', user.id as never)
      .maybeSingle()
    const w = data as { balance: number; reserved_balance?: number } | null
    if (!w) {
      setCustomerWalletWithdrawable(null)
      return
    }
    const avail = w.balance - (w.reserved_balance ?? 0)
    setCustomerWalletWithdrawable(avail)
  }, [user, isProvider])

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
          setProviderId(null)
          setQuotes([])
          setLoading(false)
          return
        }
        setProviderId(providerId)

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
        setProviderId(null)
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

  useEffect(() => {
    void fetchCustomerWalletWithdrawable()
  }, [fetchCustomerWalletWithdrawable])

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f === 'all' || f === 'requested' || f === 'quoted' || f === 'accepted' || f === 'rejected') {
      setFilter(f)
    }
    const q = searchParams.get('quote')
    if (q?.trim()) setExpandedId(q.trim())
  }, [searchParams])

  useEffect(() => {
    if (!user?.id) return
    if (isProvider && !providerId) return

    const filter = isProvider
      ? `provider_id=eq.${providerId}`
      : `customer_id=eq.${user.id}`

    const channel = supabase
      .channel(`quotes-realtime:${isProvider ? providerId : user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const row = payload.new as QuoteWithDetails
            setQuotes((prev) => {
              const ix = prev.findIndex((q) => q.id === row.id)
              if (ix === -1) {
                void fetchQuotes()
                return prev
              }
              const next = [...prev]
              next[ix] = { ...next[ix], ...row }
              return next
            })
            return
          }
          if (payload.eventType === 'INSERT') {
            void fetchQuotes()
            return
          }
          if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
            const id = (payload.old as { id: string }).id
            setQuotes((prev) => prev.filter((q) => q.id !== id))
            return
          }
          void fetchQuotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, isProvider, providerId, fetchQuotes])

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
      const { data, error } = await supabase.rpc('customer_accept_quote', {
        p_quote_id: quote.id,
      } as never)
      if (error) throw error
      const bookingId = (data as { booking_id?: string } | null)?.booking_id
      await fetchQuotes()
      if (bookingId) navigate(`${ROUTES.MY_BOOKINGS}?booking=${bookingId}`)
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
      const { error } = await supabase.rpc('provider_submit_quote_response', {
        p_quote_id: respondModal.id,
        p_quoted_amount: parseFloat(respondAmount),
        p_provider_message: respondMessage.trim() || null,
      } as never)
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
                          {quote.quoted_amount != null && customerWalletWithdrawable != null && (
                            <p
                              className={`w-full basis-full text-sm ${
                                customerWalletWithdrawable < quote.quoted_amount
                                  ? 'text-danger-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              Your available wallet balance (not counting reserved funds):{' '}
                              <strong>{formatCurrency(customerWalletWithdrawable)}</strong>
                              {customerWalletWithdrawable < quote.quoted_amount && (
                                <>
                                  {' '}
                                  — not enough to accept this quote ({formatCurrency(quote.quoted_amount)}).
                                  Top up or wait for other jobs to complete.
                                </>
                              )}
                            </p>
                          )}
                          <Button
                            size="sm"
                            icon={<CheckCircle2 className="size-4" />}
                            loading={actionLoading === quote.id}
                            disabled={
                              quote.quoted_amount != null &&
                              customerWalletWithdrawable != null &&
                              customerWalletWithdrawable < quote.quoted_amount
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleAccept(quote)
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
