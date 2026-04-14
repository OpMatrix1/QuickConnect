import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Star,
  BarChart3,
  Filter,
  AlertTriangle,
  Check,
  RotateCcw,
  Flag,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BOOKING_STATUS_CONFIG } from '@/lib/utils'
import type { PaymentMethod } from '@/lib/types'
import {
  Card,
  CardHeader,
  CardContent,
  Spinner,
  EmptyState,
  Badge,
  Button,
  Input,
  Modal,
} from '@/components/ui'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  btc_myzaka: 'BTC MyZaka',
  mascom_myzaka: 'Mascom MyZaka',
  wallet: 'Wallet',
}

interface DisputedPayment {
  id: string
  amount: number
  status: string
  method: string | null
  created_at: string
  booking_id: string
  dispute_customer_statement: string | null
  dispute_provider_statement: string | null
  dispute_initiated_by: string | null
  dispute_opened_at: string | null
  bookings: {
    customer_id: string
    profiles: { full_name: string } | null
    service_providers: {
      profile_id: string
      profiles: { full_name: string } | null
    } | null
  } | null
}

export function AdminReports() {
  const { user, profile, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightPaymentId = searchParams.get('payment')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )

  const [bookingStats, setBookingStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    completed: 0,
    completionRate: 0,
  })
  const [revenueStats, setRevenueStats] = useState({
    total: 0,
    byMethod: {} as Record<PaymentMethod, number>,
  })
  const [topProviders, setTopProviders] = useState<
    { id: string; name: string; rating: number; completed: number }[]
  >([])
  const [categoryPopularity, setCategoryPopularity] = useState<
    { name: string; posts: number; bookings: number }[]
  >([])
  const [disputedPayments, setDisputedPayments] = useState<DisputedPayment[]>([])
  const [disputeActionLoading, setDisputeActionLoading] = useState<string | null>(null)
  const [disputeError, setDisputeError] = useState<string | null>(null)
  const [walletBalancesByUserId, setWalletBalancesByUserId] = useState<Record<string, number>>({})
  const [debitModal, setDebitModal] = useState<{ paymentId: string; amount: string } | null>(null)

  interface UserReport {
    id: string
    reporter_id: string
    reported_user_id: string
    reason: string
    description: string | null
    status: string
    created_at: string
    reporter: { full_name: string } | null
    reported: { full_name: string } | null
  }
  const [userReports, setUserReports] = useState<UserReport[]>([])
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null)

  const fetchUserReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select(`
        id, reporter_id, reported_user_id, reason, description, status, created_at,
        reporter:profiles!reports_reporter_id_fkey(full_name),
        reported:profiles!reports_reported_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
    setUserReports((data ?? []) as unknown as UserReport[])
  }

  const handleReportAction = async (reportId: string, newStatus: string) => {
    setReportActionLoading(reportId + newStatus)
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus } as any)
        .eq('id' as any, reportId as any)
      if (error) throw error
      await fetchUserReports()
    } finally {
      setReportActionLoading(null)
    }
  }

  const fetchDisputedPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select(`
        id, amount, status, method, created_at, booking_id,
        dispute_customer_statement,
        dispute_provider_statement,
        dispute_initiated_by,
        dispute_opened_at,
        bookings(
          customer_id,
          profiles!bookings_customer_id_fkey(full_name),
          service_providers!bookings_provider_id_fkey(
            profile_id,
            profiles!service_providers_profile_id_fkey(full_name)
          )
        )
      `)
      .in('status', ['disputed', 'held'])
      .order('created_at', { ascending: false })
    setDisputedPayments((data ?? []) as unknown as DisputedPayment[])
  }

  useEffect(() => {
    if (disputedPayments.length === 0) {
      setWalletBalancesByUserId({})
      return
    }
    const ids = new Set<string>()
    for (const p of disputedPayments) {
      const b = p.bookings
      if (!b) continue
      ids.add(b.customer_id)
      const pid = b.service_providers?.profile_id
      if (pid) ids.add(pid)
    }
    const list = [...ids]
    if (list.length === 0) return
    void (async () => {
      const { data } = await supabase.from('wallets').select('user_id, balance').in('user_id', list)
      const map: Record<string, number> = {}
      ;(data ?? []).forEach((w: { user_id: string; balance: number }) => {
        map[w.user_id] = w.balance
      })
      setWalletBalancesByUserId(map)
    })()
  }, [disputedPayments])

  useEffect(() => {
    if (!highlightPaymentId || disputedPayments.length === 0) return
    const hasRow = disputedPayments.some((p) => p.id === highlightPaymentId)
    if (!hasRow) return
    const t = window.setTimeout(() => {
      document
        .getElementById(`admin-dispute-${highlightPaymentId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => window.clearTimeout(t)
  }, [highlightPaymentId, disputedPayments])

  const handleDebitCustomer = async () => {
    if (!debitModal) return
    const amt = parseFloat(debitModal.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setDisputeError('Enter a valid positive amount.')
      return
    }
    setDisputeActionLoading(debitModal.paymentId + 'debit')
    setDisputeError(null)
    try {
      const { error } = await supabase.rpc('admin_dispute_debit_customer', {
        p_payment_id: debitModal.paymentId,
        p_amount: amt,
      } as never)
      if (error) throw error
      setDebitModal(null)
      await fetchDisputedPayments()
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Debit failed')
    } finally {
      setDisputeActionLoading(null)
    }
  }

  const handleDisputeAction = async (paymentId: string, action: 'refund' | 'release') => {
    setDisputeActionLoading(paymentId + action)
    setDisputeError(null)
    try {
      const fn = action === 'refund' ? 'admin_refund_payment' : 'admin_release_payment'
      const { error } = await supabase.rpc(fn, {
        p_payment_id: paymentId,
      } as never)
      if (error) throw error
      await fetchDisputedPayments()
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setDisputeActionLoading(null)
    }
  }

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false)
      return
    }

    if (profile.role !== 'admin') {
      setLoading(false)
      return
    }

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const fromDate = `${dateFrom}T00:00:00`
        const toDate = `${dateTo}T23:59:59`

        const [bookingsRes, paymentsRes, providersRes, postsByCatRes, bookingsByCatRes] =
          await Promise.all([
            supabase
              .from('bookings')
              .select('id, status')
              .gte('created_at', fromDate)
              .lte('created_at', toDate),
            supabase
              .from('payments')
              .select('amount, method')
              .eq('status', 'completed')
              .gte('created_at', fromDate)
              .lte('created_at', toDate),
            supabase
              .from('service_providers')
              .select(
                `
                id,
                business_name,
                rating_avg,
                completion_rate,
                profiles!service_providers_profile_id_fkey(full_name)
              `
              )
              .order('rating_avg', { ascending: false })
              .limit(10),
            supabase
              .from('looking_for_posts')
              .select('category_id')
              .gte('created_at', fromDate)
              .lte('created_at', toDate),
            supabase
              .from('bookings')
              .select('service_id')
              .gte('created_at', fromDate)
              .lte('created_at', toDate)
              .not('service_id', 'is', null),
          ])

        const bookings = (bookingsRes.data || []) as { id: string; status: string }[]
        const byStatus: Record<string, number> = {}
        let completed = 0
        bookings.forEach((b) => {
          byStatus[b.status] = (byStatus[b.status] || 0) + 1
          if (b.status === 'completed') completed++
        })
        setBookingStats({
          total: bookings.length,
          byStatus,
          completed,
          completionRate:
            bookings.length > 0 ? (completed / bookings.length) * 100 : 0,
        })

        const payments = (paymentsRes.data || []) as {
          amount: number
          method: PaymentMethod
        }[]
        const byMethod = {
          orange_money: 0,
          btc_myzaka: 0,
          mascom_myzaka: 0,
        } as Record<PaymentMethod, number>
        let totalRevenue = 0
        payments.forEach((p) => {
          byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
          totalRevenue += p.amount
        })
        setRevenueStats({ total: totalRevenue, byMethod })

        const providers = (providersRes.data || []) as {
          id: string
          business_name: string
          rating_avg: number
          completion_rate: number | null
          profiles: { full_name: string } | null
        }[]

        const { data: completedByProvider } = await supabase
          .from('bookings')
          .select('provider_id')
          .eq('status', 'completed')
          .gte('created_at', fromDate)
          .lte('created_at', toDate)

        const completedCounts = (completedByProvider || []).reduce(
          (acc: Record<string, number>, b: { provider_id: string }) => {
            acc[b.provider_id] = (acc[b.provider_id] || 0) + 1
            return acc
          },
          {}
        )

        setTopProviders(
          providers.map((p) => ({
            id: p.id,
            name: p.profiles?.full_name || p.business_name || 'Unknown',
            rating: p.rating_avg || 0,
            completed: completedCounts[p.id] || 0,
          }))
        )

        const posts = (postsByCatRes.data || []) as { category_id: string }[]
        const postCounts: Record<string, number> = {}
        posts.forEach((p) => {
          postCounts[p.category_id] = (postCounts[p.category_id] || 0) + 1
        })

        const bookingsWithService = (bookingsByCatRes.data || []) as {
          service_id: string
        }[]
        const serviceIds = [...new Set(bookingsWithService.map((b) => b.service_id))]
        let bookingCountsByCategory: Record<string, number> = {}
        if (serviceIds.length > 0) {
          const { data: services } = await supabase
            .from('services')
            .select('id, category_id')
            .in('id', serviceIds)
          const svcList = (services || []) as { id: string; category_id: string }[]
          svcList.forEach((s) => {
            bookingCountsByCategory[s.category_id] =
              (bookingCountsByCategory[s.category_id] || 0) + 1
          })
        }

        const { data: categories } = await supabase
          .from('service_categories')
          .select('id, name')
        const catMap = new Map(
          (categories || []).map((c: { id: string; name: string }) => [c.id, c.name])
        )
        const allCatIds = new Set([
          ...Object.keys(postCounts),
          ...Object.keys(bookingCountsByCategory),
        ])
        setCategoryPopularity(
          Array.from(allCatIds).map((catId) => ({
            name: catMap.get(catId) || 'Unknown',
            posts: postCounts[catId] || 0,
            bookings: bookingCountsByCategory[catId] || 0,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    fetchDisputedPayments()
    fetchUserReports()
  }, [user?.id, profile?.role, dateFrom, dateTo])

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (profile.role !== 'admin') {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
        <p className="text-danger-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-gray-600">
            Booking statistics, revenue, and category insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-5 text-gray-500" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {/* Booking statistics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Booking Statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <CalendarCheck className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {bookingStats.total}
                </p>
                <p className="text-sm text-gray-600">Total Bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
                <TrendingUp className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {bookingStats.completionRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Completion Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
                <BarChart3 className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {bookingStats.completed}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>
        {Object.keys(bookingStats.byStatus).length > 0 && (
          <Card className="mt-4" padding="md">
            <CardHeader>
              <h3 className="text-base font-medium text-gray-900">
                Bookings by Status
              </h3>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-3">
                {Object.entries(bookingStats.byStatus).map(([status, count]) => (
                  <li
                    key={status}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-2"
                  >
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        BOOKING_STATUS_CONFIG[status as keyof typeof BOOKING_STATUS_CONFIG]
                          ?.color ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {BOOKING_STATUS_CONFIG[status as keyof typeof BOOKING_STATUS_CONFIG]
                        ?.label ?? status}
                    </span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Revenue overview */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Revenue Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
                <DollarSign className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueStats.total)}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
            </CardContent>
          </Card>
          {(Object.entries(revenueStats.byMethod) as [PaymentMethod, number][]).map(
            ([method, amount]) =>
              amount > 0 && (
                <Card key={method} padding="md">
                  <CardContent className="flex items-center gap-4">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <DollarSign className="size-6" />
                    </span>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(amount)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {PAYMENT_METHOD_LABELS[method]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
          )}
        </div>
      </section>

      {/* Top providers */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Top Providers
        </h2>
        {topProviders.length === 0 ? (
          <EmptyState
            icon={<Star className="size-12" />}
            title="No provider data"
            description="Provider rankings will appear here"
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100">
              {topProviders.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">
                        {p.rating.toFixed(1)} rating • {p.completed} completed jobs
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Category popularity */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Category Popularity
        </h2>
        {categoryPopularity.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-12" />}
            title="No category data"
            description="Category stats will appear here"
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100">
              {categoryPopularity
                .sort((a, b) => b.posts + b.bookings - (a.posts + a.bookings))
                .map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>{c.posts} posts</span>
                      <span>{c.bookings} bookings</span>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </section>

      {/* User Reports */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Flag className="size-5 text-danger-500" />
          User Reports
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Reports submitted by users about other users or providers. Review and take action as needed.
        </p>

        {userReports.length === 0 ? (
          <EmptyState
            icon={<Check className="size-10 text-success-500" />}
            title="No reports submitted"
            description="No user reports have been filed."
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100">
              {userReports.map((r) => {
                const reporterName = (r.reporter as { full_name: string } | null)?.full_name ?? 'Unknown'
                const reportedName = (r.reported as { full_name: string } | null)?.full_name ?? 'Unknown'
                return (
                  <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={
                          r.status === 'pending' ? 'warning' :
                          r.status === 'resolved' ? 'success' :
                          r.status === 'dismissed' ? 'default' : 'info'
                        }>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </Badge>
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {r.reason.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        <strong>{reporterName}</strong> reported <strong>{reportedName}</strong>
                      </p>
                      {r.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(r.created_at)}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={reportActionLoading === r.id + 'dismissed'}
                          onClick={() => handleReportAction(r.id, 'dismissed')}
                          className="text-gray-600"
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          loading={reportActionLoading === r.id + 'resolved'}
                          onClick={() => handleReportAction(r.id, 'resolved')}
                        >
                          Mark Resolved
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* Disputed & Held Payments — deep-link: /admin/reports?payment=<payment_id> */}
      <section id="admin-disputes">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning-500" />
          Payments Requiring Attention
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Review each party&apos;s story and both wallet balances before refunding, releasing escrow, or applying a
          customer debit. Wallets may show a negative balance after a debit until the customer tops up. Rows with{' '}
          <strong>no wallet escrow</strong> (e.g. customer never paid — provider-reported dispute):{' '}
          <strong>Release to provider</strong> debits the customer and credits the provider by the claimed amount;{' '}
          <strong>Refund customer</strong> closes the dispute without crediting the customer (they did not pay into escrow).
        </p>

        {disputeError && (
          <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
            {disputeError}
          </div>
        )}

        {disputedPayments.length === 0 ? (
          <EmptyState
            icon={<Check className="size-10 text-success-500" />}
            title="No payments need attention"
            description="All payments are resolved."
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100">
              {disputedPayments.map((p) => {
                const customerName =
                  (p.bookings?.profiles as { full_name: string } | null)?.full_name ?? 'Customer'
                const providerName =
                  (p.bookings?.service_providers?.profiles as { full_name: string } | null)
                    ?.full_name ?? 'Provider'
                const custId = p.bookings?.customer_id
                const provProfileId = p.bookings?.service_providers?.profile_id
                const custBal =
                  custId !== undefined ? walletBalancesByUserId[custId] : undefined
                const provBal =
                  provProfileId !== undefined ? walletBalancesByUserId[provProfileId] : undefined
                const likelyNoWalletEscrow =
                  p.status === 'disputed' &&
                  (p.method == null || p.method === '')
                return (
                  <li
                    key={p.id}
                    id={`admin-dispute-${p.id}`}
                    className={`flex flex-col gap-4 px-5 py-4 scroll-mt-24 ${
                      highlightPaymentId === p.id
                        ? 'bg-primary-50/60 ring-2 ring-inset ring-primary-200'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={p.status === 'disputed' ? 'danger' : 'warning'}>
                            {p.status === 'disputed' ? 'Disputed' : 'Held'}
                          </Badge>
                          <span className="text-base font-semibold text-gray-900">
                            {likelyNoWalletEscrow ? 'Claimed ' : 'Escrow '}
                            {formatCurrency(p.amount)}
                          </span>
                          {p.dispute_initiated_by && (
                            <span className="text-xs text-gray-500">
                              Opened by {p.dispute_initiated_by}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Customer: <strong>{customerName}</strong> &rarr; Provider:{' '}
                          <strong>{providerName}</strong>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Payment {new Date(p.created_at).toLocaleDateString('en-BW', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {p.dispute_opened_at && (
                            <>
                              {' '}
                              · Dispute{' '}
                              {new Date(p.dispute_opened_at).toLocaleString('en-BW', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </>
                          )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                          <div
                            className={`rounded-lg border px-3 py-2 ${
                              custBal !== undefined && custBal < 0
                                ? 'border-warning-300 bg-warning-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <span className="text-gray-500">Customer wallet</span>{' '}
                            <span className="font-semibold text-gray-900">
                              {custBal !== undefined ? formatCurrency(custBal) : '—'}
                            </span>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <span className="text-gray-500">Provider wallet</span>{' '}
                            <span className="font-semibold text-gray-900">
                              {provBal !== undefined ? formatCurrency(provBal) : '—'}
                            </span>
                          </div>
                        </div>
                        {likelyNoWalletEscrow && (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            No wallet escrow on file for this booking. Use <strong>Release to provider</strong> to debit
                            the customer and credit the provider, or <strong>Refund customer</strong> to close the dispute
                            in the customer&apos;s favor without adding wallet funds.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<RotateCcw className="size-4" />}
                          loading={disputeActionLoading === p.id + 'refund'}
                          onClick={() => handleDisputeAction(p.id, 'refund')}
                          className="text-danger-600 border-danger-300 hover:bg-danger-50"
                        >
                          Refund Customer
                        </Button>
                        <Button
                          size="sm"
                          icon={<Check className="size-4" />}
                          loading={disputeActionLoading === p.id + 'release'}
                          onClick={() => handleDisputeAction(p.id, 'release')}
                        >
                          Release to Provider
                        </Button>
                        {p.status === 'disputed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={disputeActionLoading === p.id + 'debit'}
                            onClick={() => setDebitModal({ paymentId: p.id, amount: '' })}
                          >
                            Debit customer…
                          </Button>
                        )}
                      </div>
                    </div>
                    {(p.dispute_customer_statement || p.dispute_provider_statement) && (
                      <div className="grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
                        {p.dispute_customer_statement && (
                          <div className="rounded-lg bg-gray-50 p-3 text-sm">
                            <p className="font-semibold text-gray-800">Customer says</p>
                            <p className="mt-1 whitespace-pre-wrap text-gray-700">
                              {p.dispute_customer_statement}
                            </p>
                          </div>
                        )}
                        {p.dispute_provider_statement && (
                          <div className="rounded-lg bg-gray-50 p-3 text-sm">
                            <p className="font-semibold text-gray-800">Provider says</p>
                            <p className="mt-1 whitespace-pre-wrap text-gray-700">
                              {p.dispute_provider_statement}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {p.status === 'disputed' &&
                      !p.dispute_customer_statement &&
                      !p.dispute_provider_statement && (
                        <p className="text-xs text-warning-700">
                          No written statements yet — ask parties to add their side under My Bookings, or proceed using
                          balances and escrow only.
                        </p>
                      )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>

      <Modal
        isOpen={!!debitModal}
        onClose={() => setDebitModal(null)}
        title="Debit customer wallet"
        size="sm"
      >
        {debitModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Debits this booking&apos;s customer wallet by the amount below. The balance may become negative until
              they top up. Use only when fair after reading both parties&apos; statements and wallet balances.
            </p>
            <Input
              label="Amount (BWP)"
              type="number"
              min="0.01"
              step="0.01"
              value={debitModal.amount}
              onChange={(e) =>
                setDebitModal((d) => (d ? { ...d, amount: e.target.value } : null))
              }
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDebitModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleDebitCustomer()}
                loading={disputeActionLoading === debitModal.paymentId + 'debit'}
              >
                Apply debit
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
