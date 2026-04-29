import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Reveal } from '@/components/ui/Reveal'
import {
  FileText,
  Users,
  CalendarCheck,
  Star,
  MessageSquare,
  DollarSign,
  Briefcase,
  ArrowRight,
  Plus,
  TrendingUp,
  FolderPlus,
  Send,
  ClipboardList,
  BookMarked,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import {
  formatCurrency,
  formatRelativeTime,
  BOOKING_STATUS_CONFIG,
  POST_STATUS_CONFIG,
} from '@/lib/utils'
import { isProviderListingComplete, PROVIDER_LISTING_REQUIREMENTS_SHORT } from '@/lib/providerListing'
import type {
  LookingForPost,
  Booking,
  PostWithDetails,
  ServiceProvider,
  ServiceCategory,
} from '@/lib/types'
import {
  Button,
  Card,
  CardContent,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
  Input,
  Textarea,
  Modal,
} from '@/components/ui'

type PostWithCategory = LookingForPost & {
  profiles: { full_name: string; avatar_url: string | null }
  service_categories: ServiceCategory
  response_count?: number
}

type BookingWithProvider = Booking & {
  service_providers?: ServiceProvider & { profiles: { full_name: string; avatar_url: string | null } }
  profiles?: { full_name: string; avatar_url: string | null }
}

export function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Customer state
  const [customerPosts, setCustomerPosts] = useState<PostWithCategory[]>([])
  const [customerBookings, setCustomerBookings] = useState<BookingWithProvider[]>([])
  const [activePostsCount, setActivePostsCount] = useState(0)
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0)
  const [completedBookingsCount, setCompletedBookingsCount] = useState(0)
  const [customerQuotesToReviewCount, setCustomerQuotesToReviewCount] = useState(0)
  const [customerAwaitingQuotesCount, setCustomerAwaitingQuotesCount] = useState(0)
  const [customerQuotedQuotes, setCustomerQuotedQuotes] = useState<
    {
      id: string
      service_description: string
      created_at: string
      quoted_amount: number | null
      service_providers: { business_name: string | null } | null
    }[]
  >([])

  // Provider state
  const [providerData, setProviderData] = useState<ServiceProvider | null>(null)
  const [providerBookings, setProviderBookings] = useState<BookingWithProvider[]>([])
  const [opportunityPosts, setOpportunityPosts] = useState<PostWithDetails[]>([])
  const [earnings, setEarnings] = useState(0)

  // Category request state (provider)
  const [catRequestModal, setCatRequestModal] = useState(false)
  const [catReqName, setCatReqName] = useState('')
  const [catReqDescription, setCatReqDescription] = useState('')
  const [catReqSaving, setCatReqSaving] = useState(false)
  const [catReqError, setCatReqError] = useState<string | null>(null)
  const [catReqSuccess, setCatReqSuccess] = useState(false)
  const [myRequests, setMyRequests] = useState<{ id: string; name: string; status: string; admin_feedback: string | null }[]>([])
  const [providerListingReady, setProviderListingReady] = useState(true)
  const [providerPendingQuoteCount, setProviderPendingQuoteCount] = useState(0)
  const [providerPendingQuotes, setProviderPendingQuotes] = useState<
    {
      id: string
      service_description: string
      created_at: string
      profiles: { full_name: string | null } | null
    }[]
  >([])

  const refreshCustomerQuotes = useCallback(async (customerId: string) => {
    const { count: toReview } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'quoted')
    setCustomerQuotesToReviewCount(toReview ?? 0)

    const { count: awaitingQ } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'requested')
    setCustomerAwaitingQuotesCount(awaitingQ ?? 0)

    const { data: quotedList } = await supabase
      .from('quotes')
      .select(
        `
        id,
        service_description,
        created_at,
        quoted_amount,
        service_providers!quotes_provider_id_fkey(business_name)
      `
      )
      .eq('customer_id', customerId)
      .eq('status', 'quoted')
      .order('created_at', { ascending: false })
      .limit(5)

    setCustomerQuotedQuotes(
      (quotedList ?? []).map((row) => {
        const r = row as unknown as {
          id: string
          service_description: string
          created_at: string
          quoted_amount: number | null
          service_providers: { business_name: string | null } | null
        }
        return {
          id: r.id,
          service_description: r.service_description,
          created_at: r.created_at,
          quoted_amount: r.quoted_amount,
          service_providers: r.service_providers,
        }
      })
    )
  }, [])

  const refreshProviderQuotes = useCallback(async (providerId: string) => {
    const { count: pendingQuoteReq } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('provider_id', providerId)
      .eq('status', 'requested')
    setProviderPendingQuoteCount(pendingQuoteReq ?? 0)

    const { data: pendingQRows } = await supabase
      .from('quotes')
      .select(
        `
        id,
        service_description,
        created_at,
        profiles!quotes_customer_id_fkey(full_name)
      `
      )
      .eq('provider_id', providerId)
      .eq('status', 'requested')
      .order('created_at', { ascending: false })
      .limit(5)

    setProviderPendingQuotes(
      (pendingQRows ?? []).map((row) => {
        const r = row as unknown as {
          id: string
          service_description: string
          created_at: string
          profiles: { full_name: string | null } | null
        }
        return {
          id: r.id,
          service_description: r.service_description,
          created_at: r.created_at,
          profiles: r.profiles,
        }
      })
    )
  }, [])

  const refreshOpportunities = useCallback(async (providerId: string) => {
    const { data: services } = await supabase
      .from('services')
      .select('category_id')
      .eq('provider_id', providerId)
      .eq('is_active', true)
    const categoryIds = [...new Set(((services || []) as { category_id: string }[]).map((s) => s.category_id))]
    if (categoryIds.length > 0) {
      const { data: postsData } = await supabase
        .from('looking_for_posts')
        .select(
          `
          *,
          profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
          service_categories(name)
        `
        )
        .eq('status', 'active')
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false })
        .limit(5)
      setOpportunityPosts((postsData || []) as unknown as PostWithDetails[])
    } else {
      setOpportunityPosts([])
    }
  }, [])

  const refreshCustomerPosts = useCallback(async (customerId: string) => {
    const { data: postsData } = await supabase
      .from('looking_for_posts')
      .select(
        `
        *,
        profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
        service_categories(name)
      `
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5)
    const posts = (postsData || []).map((p) => p as unknown as PostWithCategory)
    setCustomerPosts(posts)

    const { count: activeCount } = await supabase
      .from('looking_for_posts')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'active')
    setActivePostsCount(activeCount ?? 0)

    if (posts.length > 0) {
      const { data: responsesData } = await supabase
        .from('looking_for_responses')
        .select('post_id')
        .in('post_id', posts.map((p) => p.id))
      const responseCounts = (responsesData || []).reduce(
        (acc, r: { post_id: string }) => {
          acc[r.post_id] = (acc[r.post_id] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
      setCustomerPosts((prev) => prev.map((p) => ({ ...p, response_count: responseCounts[p.id] || 0 })))
    }
  }, [])

  const refreshCustomerBookings = useCallback(async (customerId: string) => {
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(
        `
        *,
        service_providers!bookings_provider_id_fkey(
          profiles!service_providers_profile_id_fkey(full_name, avatar_url)
        )
      `
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5)

    setCustomerBookings((bookingsData || []) as unknown as BookingWithProvider[])

    const { count: pendingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .in('status', ['pending', 'confirmed', 'in_progress'])
    setPendingBookingsCount(pendingCount ?? 0)

    const { count: completedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'completed')
    setCompletedBookingsCount(completedCount ?? 0)
  }, [])

  const refreshProviderBookings = useCallback(async (providerId: string) => {
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(
        `
        *,
        profiles!bookings_customer_id_fkey(full_name, avatar_url)
      `
      )
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(5)

    setProviderBookings((bookingsData || []) as unknown as BookingWithProvider[])

    // Sum net earnings from wallet (payment_release credits = actual amount after platform fee)
    const { data: spRow } = await supabase
      .from('service_providers')
      .select('profile_id')
      .eq('id', providerId)
      .single()
    const profileId = (spRow as { profile_id: string } | null)?.profile_id
    if (profileId) {
      const { data: walletRow } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', profileId)
        .single()
      const walletId = (walletRow as { id: string } | null)?.id
      if (walletId) {
        const { data: txRows } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('wallet_id', walletId)
          .eq('type', 'payment_release')
          .eq('direction', 'credit')
        const total = ((txRows || []) as { amount: number }[]).reduce((sum, t) => sum + t.amount, 0)
        setEarnings(total)
      }
    }
  }, [])

  useEffect(() => {
    if (location.hash !== '#dashboard-category-requests') return
    const t = window.setTimeout(() => {
      document.getElementById('dashboard-category-requests')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false)
      return
    }

    async function fetchData() {
      if (!user || !profile) return
      setLoading(true)
      setError(null)
      try {
        if (profile.role === 'customer') {
          await fetchCustomerData(user.id)
        } else if (profile.role === 'provider') {
          await fetchProviderData(user.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id, profile?.role])

  useEffect(() => {
    if (!user?.id || profile?.role !== 'customer') return

    const channel = supabase
      .channel(`dashboard-quotes-customer:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          void refreshCustomerQuotes(user.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.role, refreshCustomerQuotes])

  useEffect(() => {
    if (!user?.id || profile?.role !== 'provider' || !providerData?.id) return
    const pid = providerData.id

    const channel = supabase
      .channel(`dashboard-quotes-provider:${pid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `provider_id=eq.${pid}`,
        },
        () => {
          void refreshProviderQuotes(pid)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.role, providerData?.id, refreshProviderQuotes])

  useEffect(() => {
    if (!user?.id || profile?.role !== 'customer') return

    const channel = supabase
      .channel(`dashboard-bookings-customer:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          void refreshCustomerBookings(user.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.role, refreshCustomerBookings])

  useEffect(() => {
    if (!user?.id || profile?.role !== 'provider' || !providerData?.id) return
    const pid = providerData.id

    const channel = supabase
      .channel(`dashboard-bookings-provider:${pid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${pid}`,
        },
        () => {
          void refreshProviderBookings(pid)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.role, providerData?.id, refreshProviderBookings])

  // Live: provider opportunities (looking_for_posts)
  useEffect(() => {
    if (!user?.id || profile?.role !== 'provider' || !providerData?.id) return
    const pid = providerData.id

    const channel = supabase
      .channel(`dashboard-opportunities:${pid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'looking_for_posts' },
        () => { void refreshOpportunities(pid) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, profile?.role, providerData?.id, refreshOpportunities])

  // Live: customer's own posts
  useEffect(() => {
    if (!user?.id || profile?.role !== 'customer') return

    const channel = supabase
      .channel(`dashboard-posts-customer:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'looking_for_posts',
          filter: `customer_id=eq.${user.id}`,
        },
        () => { void refreshCustomerPosts(user.id) }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'looking_for_responses',
        },
        () => { void refreshCustomerPosts(user.id) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, profile?.role, refreshCustomerPosts])

  async function fetchCustomerData(customerId: string) {
    const { data: postsData } = await supabase
      .from('looking_for_posts')
      .select(
        `
        *,
        profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
        service_categories(name)
      `
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10)

    const posts = (postsData || []).map((p) => p as unknown as PostWithCategory)
    setCustomerPosts(posts.slice(0, 5))

    const { count: activeCount } = await supabase
      .from('looking_for_posts')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'active')
    setActivePostsCount(activeCount ?? 0)

    const { data: responsesData } = await supabase
      .from('looking_for_responses')
      .select('post_id')
      .in('post_id', posts.map((p) => p.id))

          const responseCounts = (responsesData || []).reduce(
            (acc, r: { post_id: string }) => {
              acc[r.post_id] = (acc[r.post_id] || 0) + 1
              return acc
            },
            {} as Record<string, number>
          )

    setCustomerPosts((prev) =>
      prev.map((p) => ({ ...p, response_count: responseCounts[p.id] || 0 }))
    )

    await refreshCustomerBookings(customerId)

    await refreshCustomerQuotes(customerId)
  }

  async function fetchProviderData(profileId: string) {
    const { data: providerRow } = await supabase
      .from('service_providers')
      .select('*')
      .eq('profile_id', profileId)
      .single()

    const provider = providerRow as ServiceProvider | null
    if (!provider) {
      setProviderListingReady(false)
      setProviderPendingQuoteCount(0)
      setProviderPendingQuotes([])
      setLoading(false)
      return
    }
    setProviderData(provider)

    const { data: services } = await supabase
      .from('services')
      .select('category_id')
      .eq('provider_id', provider.id)
      .eq('is_active', true)
    const servicesList = (services || []) as { category_id: string }[]
    setProviderListingReady(
      isProviderListingComplete({
        description: provider.description,
        services: servicesList.map(() => ({ is_active: true })),
      })
    )
    const categoryIds = [...new Set(servicesList.map((s) => s.category_id))]

    await refreshProviderBookings(provider.id)

    if (categoryIds.length > 0) {
      const { data: postsData } = await supabase
        .from('looking_for_posts')
        .select(
          `
          *,
          profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
          service_categories(name)
        `
        )
        .eq('status', 'active')
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false })
        .limit(5)
      setOpportunityPosts((postsData || []) as unknown as PostWithDetails[])
    }

    const { data: reqData } = await supabase
      .from('category_requests')
      .select('id, name, status, admin_feedback')
      .eq('requested_by', profileId)
      .order('created_at', { ascending: false })
    setMyRequests((reqData || []) as { id: string; name: string; status: string; admin_feedback: string | null }[])

    await refreshProviderQuotes(provider.id)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!profile) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  async function handleSubmitCategoryRequest() {
    if (!user || !catReqName.trim()) {
      setCatReqError('Category name is required')
      return
    }
    setCatReqSaving(true)
    setCatReqError(null)
    try {
      const { error: insertErr } = await supabase.from('category_requests').insert({
        requested_by: user.id,
        name: catReqName.trim(),
        description: catReqDescription.trim() || null,
      } as any)
      if (insertErr) throw insertErr
      setCatReqSuccess(true)
      setCatReqName('')
      setCatReqDescription('')
      const { data: reqData } = await supabase
        .from('category_requests')
        .select('id, name, status, admin_feedback')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
      setMyRequests((reqData || []) as typeof myRequests)
      setTimeout(() => {
        setCatRequestModal(false)
        setCatReqSuccess(false)
      }, 1500)
    } catch (err) {
      setCatReqError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setCatReqSaving(false)
    }
  }

  if (profile.role === 'admin') {
    return <Navigate to={ROUTES.ADMIN} replace />
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

  if (profile.role === 'customer') {
    return (
      <div className="space-y-8">
        <section>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Welcome back, {profile.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="mt-1 text-gray-600">
            Manage your posts and bookings in one place.
          </p>
        </section>

        <section className="flex flex-wrap gap-4">
          <Link to={ROUTES.CREATE_POST}>
            <Button variant="primary" icon={<Plus className="size-5" />}>
              Post What You Need
            </Button>
          </Link>
          <Link to={ROUTES.PROVIDERS}>
            <Button variant="outline" icon={<Users className="size-5" />}>
              Browse Providers
            </Button>
          </Link>
          <Link to={ROUTES.MY_BOOKINGS}>
            <Button variant="outline" icon={<CalendarCheck className="size-5" />}>
              My Bookings
            </Button>
          </Link>
          <Link to={ROUTES.MY_POSTS}>
            <Button variant="outline" icon={<BookMarked className="size-5" />}>
              My Posts
            </Button>
          </Link>
          <Link to={ROUTES.QUOTES}>
            <Button variant="outline" icon={<ClipboardList className="size-5" />}>
              My Quotes
            </Button>
          </Link>
        </section>

        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, bg: 'bg-primary-100', color: 'text-primary-600', value: activePostsCount, label: 'Active Posts', delay: 0 },
            { icon: CalendarCheck, bg: 'bg-warning-100', color: 'text-warning-600', value: pendingBookingsCount, label: 'Pending Bookings', delay: 80 },
            { icon: TrendingUp, bg: 'bg-success-100', color: 'text-success-600', value: completedBookingsCount, label: 'Completed Services', delay: 160 },
            { icon: ClipboardList, bg: 'bg-sky-100', color: 'text-sky-700', value: customerQuotesToReviewCount, label: 'Quotes to review', delay: 200 },
          ].map(({ icon: Icon, bg, color, value, label, delay }) => (
            <Reveal key={label} delay={delay} animation="scale" className="h-full">
              <Card padding="md" className="card-hover-lift h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${bg} ${color}`}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{label}</p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your quotes</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {customerAwaitingQuotesCount > 0 && (
                  <span>{customerAwaitingQuotesCount} awaiting a quote from a provider</span>
                )}
                {customerAwaitingQuotesCount > 0 && customerQuotesToReviewCount > 0 && ' · '}
                {customerQuotesToReviewCount > 0 && (
                  <span>{customerQuotesToReviewCount} need your response</span>
                )}
                {customerAwaitingQuotesCount === 0 &&
                  customerQuotesToReviewCount === 0 &&
                  'Request quotes from provider profiles — they will show up here.'}
              </p>
            </div>
            <Link
              to={ROUTES.QUOTES}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              Open My Quotes
            </Link>
          </div>
          {customerQuotedQuotes.length === 0 ? (
            <Card padding="md">
              <p className="text-sm text-gray-600">
                {customerQuotesToReviewCount > 0 || customerAwaitingQuotesCount > 0
                  ? 'Open My Quotes to review details and respond.'
                  : 'No active quote activity yet.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {customerQuotedQuotes.map((q) => (
                <Link
                  key={q.id}
                  to={`${ROUTES.QUOTES}?filter=quoted&quote=${q.id}`}
                >
                  <Card padding="md" hover>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 line-clamp-2">{q.service_description}</p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {q.service_providers?.business_name ?? 'Provider'} ·{' '}
                          {formatRelativeTime(q.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {q.quoted_amount != null && (
                          <span className="font-semibold text-primary-700">
                            {formatCurrency(q.quoted_amount)}
                          </span>
                        )}
                        <Badge variant="info">Respond</Badge>
                        <ArrowRight className="size-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Posts</h2>
          {customerPosts.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-12" />}
              title="No posts yet"
              description="Create your first post to get quotes from providers."
              action={
                <Link to={ROUTES.CREATE_POST}>
                  <Button variant="primary">Post What You Need</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {customerPosts.map((post) => (
                <Link key={post.id} to={ROUTES.POST_DETAIL.replace(':id', post.id)}>
                  <Card padding="md" hover>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-gray-900">{post.title}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {post.service_categories?.name} • {post.response_count ?? 0} responses
                        </p>
                      </div>
                      <Badge
                        variant={
                          post.status === 'active'
                            ? 'success'
                            : post.status === 'matched'
                              ? 'primary'
                              : 'default'
                        }
                      >
                        {POST_STATUS_CONFIG[post.status]?.label ?? post.status}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Bookings</h2>
          {customerBookings.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="size-12" />}
              title="No bookings yet"
              description="When you accept a quote, your bookings will appear here."
              action={
                <Link to={ROUTES.LOOKING_FOR}>
                  <Button variant="primary">Browse Posts</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {customerBookings.map((booking) => {
                const provider = booking.service_providers as ServiceProvider & {
                  profiles: { full_name: string; avatar_url: string | null }
                }
                const config = BOOKING_STATUS_CONFIG[booking.status as keyof typeof BOOKING_STATUS_CONFIG]
                return (
                  <Link key={booking.id} to={ROUTES.BOOKING_DETAIL.replace(':id', booking.id)}>
                    <Card padding="md" hover>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={provider?.profiles?.avatar_url}
                            fallback={provider?.profiles?.full_name || '?'}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {provider?.profiles?.full_name || 'Provider'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(booking.agreed_price || 0)} •{' '}
                              {formatRelativeTime(booking.created_at)}
                            </p>
                          </div>
                        </div>
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
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    )
  }

  // Provider dashboard
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome, {providerData?.business_name || 'Provider'}!
        </h1>
        <p className="mt-1 text-gray-600">
          Manage your quotes, bookings, and earnings.
        </p>
      </section>

      {!providerListingReady && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold text-amber-900">Your business is not visible to customers yet</p>
          <p className="mt-1 text-amber-900/90">{PROVIDER_LISTING_REQUIREMENTS_SHORT}</p>
          <Link
            to={`${ROUTES.PROFILE}?section=business`}
            className="mt-3 inline-flex font-medium text-primary-700 underline hover:text-primary-800"
          >
            Complete your business profile
          </Link>
        </div>
      )}

      <section className="flex flex-wrap gap-4">
        <Link to={ROUTES.LOOKING_FOR}>
          <Button variant="primary" icon={<MessageSquare className="size-5" />}>
            View Opportunities
          </Button>
        </Link>
        <Link to={ROUTES.QUOTES}>
          <Button variant="outline" icon={<ClipboardList className="size-5" />}>
            My Quotes
          </Button>
        </Link>
        <Link to={ROUTES.PROVIDER_PROFILE.replace(':id', providerData?.id || '')}>
          <Button variant="outline" icon={<Briefcase className="size-5" />}>
            My Services
          </Button>
        </Link>
      </section>

      <section className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Star, bg: 'bg-warning-100', color: 'text-warning-600', value: providerData?.rating_avg?.toFixed(1) ?? '0.0', label: 'Rating' },
          { icon: ClipboardList, bg: 'bg-sky-100', color: 'text-sky-700', value: providerPendingQuoteCount, label: 'Quote requests' },
          { icon: MessageSquare, bg: 'bg-primary-100', color: 'text-primary-600', value: opportunityPosts.length, label: 'Active Opportunities' },
          { icon: CalendarCheck, bg: 'bg-warning-100', color: 'text-warning-600', value: providerBookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length, label: 'Pending Bookings' },
          { icon: TrendingUp, bg: 'bg-success-100', color: 'text-success-600', value: providerBookings.filter((b) => b.status === 'completed').length, label: 'Completed Jobs' },
          { icon: DollarSign, bg: 'bg-success-100', color: 'text-success-600', value: formatCurrency(earnings), label: 'Total Earnings' },
        ].map(({ icon: Icon, bg, color, value, label }, i) => (
          <Reveal key={label} delay={i * 70} animation="scale" className="h-full">
            <Card padding="md" className="card-hover-lift h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <span className={`flex size-10 items-center justify-center rounded-xl ${bg} ${color}`}>
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Customer quote requests</h2>
            {providerPendingQuoteCount > 0 && (
              <Badge variant="warning">{providerPendingQuoteCount} pending</Badge>
            )}
          </div>
          <Link
            to={`${ROUTES.QUOTES}?filter=requested`}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            View all in My Quotes
          </Link>
        </div>
        {providerPendingQuotes.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-gray-600">
              {providerPendingQuoteCount > 0
                ? 'Open My Quotes to see full details and respond.'
                : 'When customers request a quote from your profile, they will appear here.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {providerPendingQuotes.map((q) => (
              <Link
                key={q.id}
                to={`${ROUTES.QUOTES}?filter=requested&quote=${q.id}`}
              >
                <Card padding="md" hover>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 line-clamp-2">{q.service_description}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {q.profiles?.full_name ?? 'Customer'} · {formatRelativeTime(q.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="warning">Awaiting your quote</Badge>
                      <ArrowRight className="size-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quote Opportunities</h2>
        {opportunityPosts.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-12" />}
            title="No opportunities right now"
            description="Active posts matching your services will appear here. Add services to see more opportunities."
            action={
              <Link to={ROUTES.LOOKING_FOR}>
                <Button variant="primary">Browse All Posts</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {opportunityPosts.map((post) => (
              <Link key={post.id} to={ROUTES.POST_DETAIL.replace(':id', post.id)}>
                <Card padding="md" hover>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{post.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {post.service_categories?.name} • {post.location_address || 'No location'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">
                        {post.urgency}
                      </Badge>
                      <ArrowRight className="size-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Bookings</h2>
        {providerBookings.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-12" />}
            title="No bookings yet"
            description="When customers accept your quotes, bookings will appear here."
          />
        ) : (
          <div className="space-y-3">
            {providerBookings.map((booking) => {
              const customer = booking.profiles
              const config = BOOKING_STATUS_CONFIG[booking.status as keyof typeof BOOKING_STATUS_CONFIG]
              return (
                <Link key={booking.id} to={ROUTES.BOOKING_DETAIL.replace(':id', booking.id)}>
                  <Card padding="md" hover>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={customer?.avatar_url}
                          fallback={customer?.full_name || '?'}
                          size="md"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {customer?.full_name || 'Customer'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(booking.agreed_price || 0)} •{' '}
                            {formatRelativeTime(booking.created_at)}
                          </p>
                        </div>
                      </div>
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
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Request New Category */}
      <section id="dashboard-category-requests" className="scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Category Requests</h2>
          <Button
            size="sm"
            variant="outline"
            icon={<FolderPlus className="size-4" />}
            onClick={() => {
              setCatRequestModal(true)
              setCatReqName('')
              setCatReqDescription('')
              setCatReqError(null)
              setCatReqSuccess(false)
            }}
          >
            Request New Category
          </Button>
        </div>
        {myRequests.length === 0 ? (
          <p className="text-sm text-gray-500">
            Don't see your service category? Request a new one and our admin team will review it.
          </p>
        ) : (
          <div className="space-y-2">
            {myRequests.map((req) => (
              <Card key={req.id} padding="sm">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium text-gray-900">{req.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        req.status === 'approved'
                          ? 'success'
                          : req.status === 'declined'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {req.status === 'approved' ? 'Approved' : req.status === 'declined' ? 'Declined' : 'Pending'}
                    </Badge>
                  </div>
                </div>
                {req.admin_feedback && (
                  <p className="px-3 pb-2 text-sm text-gray-500">
                    Feedback: {req.admin_feedback}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Category Request Modal */}
      <Modal
        isOpen={catRequestModal}
        onClose={() => setCatRequestModal(false)}
        title="Request New Category"
        size="md"
      >
        <div className="space-y-4">
          {catReqSuccess ? (
            <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-center text-success-700">
              Request submitted! Our admin team will review it shortly.
            </div>
          ) : (
            <>
              {catReqError && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                  {catReqError}
                </div>
              )}
              <Input
                label="Category Name"
                value={catReqName}
                onChange={(e) => setCatReqName(e.target.value)}
                placeholder="e.g. Solar Panel Installation"
                required
              />
              <Textarea
                label="Description (optional)"
                value={catReqDescription}
                onChange={(e) => setCatReqDescription(e.target.value)}
                placeholder="Describe the types of services in this category..."
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCatRequestModal(false)}>
                  Cancel
                </Button>
                <Button
                  icon={<Send className="size-4" />}
                  onClick={handleSubmitCategoryRequest}
                  loading={catReqSaving}
                >
                  Submit Request
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
