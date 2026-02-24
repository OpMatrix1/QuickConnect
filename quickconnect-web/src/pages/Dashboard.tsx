import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Customer state
  const [customerPosts, setCustomerPosts] = useState<PostWithCategory[]>([])
  const [customerBookings, setCustomerBookings] = useState<BookingWithProvider[]>([])
  const [activePostsCount, setActivePostsCount] = useState(0)
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0)
  const [completedBookingsCount, setCompletedBookingsCount] = useState(0)

  // Provider state
  const [providerData, setProviderData] = useState<ServiceProvider | null>(null)
  const [providerBookings, setProviderBookings] = useState<BookingWithProvider[]>([])
  const [opportunityPosts, setOpportunityPosts] = useState<PostWithDetails[]>([])
  const [earnings, setEarnings] = useState(0)

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
  }

  async function fetchProviderData(profileId: string) {
    const { data: providerRow } = await supabase
      .from('service_providers')
      .select('*')
      .eq('profile_id', profileId)
      .single()

    const provider = providerRow as ServiceProvider | null
    if (!provider) {
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
    const categoryIds = [...new Set(servicesList.map((s) => s.category_id))]

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(
        `
        *,
        profiles!bookings_customer_id_fkey(full_name, avatar_url)
      `
      )
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .limit(5)

    setProviderBookings((bookingsData || []) as unknown as BookingWithProvider[])

    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('agreed_price')
      .eq('provider_id', provider.id)
      .eq('status', 'completed')
    const completedList = (completedBookings || []) as { agreed_price: number | null }[]
    const total = completedList.reduce((sum, b) => sum + (b.agreed_price || 0), 0)
    setEarnings(total)

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
  }

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
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
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <FileText className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activePostsCount}</p>
                <p className="text-sm text-gray-600">Active Posts</p>
              </div>
            </CardContent>
          </Card>
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
                <CalendarCheck className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingBookingsCount}</p>
                <p className="text-sm text-gray-600">Pending Bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card padding="md">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
                <TrendingUp className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold text-gray-900">{completedBookingsCount}</p>
                <p className="text-sm text-gray-600">Completed Services</p>
              </div>
            </CardContent>
          </Card>
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

      <section className="flex flex-wrap gap-4">
        <Link to={ROUTES.LOOKING_FOR}>
          <Button variant="primary" icon={<MessageSquare className="size-5" />}>
            View Opportunities
          </Button>
        </Link>
        <Link to={ROUTES.PROVIDER_PROFILE.replace(':id', providerData?.id || '')}>
          <Button variant="outline" icon={<Briefcase className="size-5" />}>
            My Services
          </Button>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Star className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {providerData?.rating_avg?.toFixed(1) ?? '0.0'}
              </p>
              <p className="text-sm text-gray-600">Rating</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <MessageSquare className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{opportunityPosts.length}</p>
              <p className="text-sm text-gray-600">Active Opportunities</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <CalendarCheck className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {providerBookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length}
              </p>
              <p className="text-sm text-gray-600">Pending Bookings</p>
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
                {providerBookings.filter((b) => b.status === 'completed').length}
              </p>
              <p className="text-sm text-gray-600">Completed Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <DollarSign className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(earnings)}</p>
              <p className="text-sm text-gray-600">Total Earnings</p>
            </div>
          </CardContent>
        </Card>
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
    </div>
  )
}
