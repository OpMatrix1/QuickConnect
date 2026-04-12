import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
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

  // Category request state (provider)
  const [catRequestModal, setCatRequestModal] = useState(false)
  const [catReqName, setCatReqName] = useState('')
  const [catReqDescription, setCatReqDescription] = useState('')
  const [catReqSaving, setCatReqSaving] = useState(false)
  const [catReqError, setCatReqError] = useState<string | null>(null)
  const [catReqSuccess, setCatReqSuccess] = useState(false)
  const [myRequests, setMyRequests] = useState<{ id: string; name: string; status: string; admin_feedback: string | null }[]>([])

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

    const { data: reqData } = await supabase
      .from('category_requests')
      .select('id, name, status, admin_feedback')
      .eq('requested_by', profileId)
      .order('created_at', { ascending: false })
    setMyRequests((reqData || []) as { id: string; name: string; status: string; admin_feedback: string | null }[])
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
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: FileText, bg: 'bg-primary-100', color: 'text-primary-600', value: activePostsCount, label: 'Active Posts', delay: 0 },
            { icon: CalendarCheck, bg: 'bg-warning-100', color: 'text-warning-600', value: pendingBookingsCount, label: 'Pending Bookings', delay: 80 },
            { icon: TrendingUp, bg: 'bg-success-100', color: 'text-success-600', value: completedBookingsCount, label: 'Completed Services', delay: 160 },
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

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { icon: Star, bg: 'bg-warning-100', color: 'text-warning-600', value: providerData?.rating_avg?.toFixed(1) ?? '0.0', label: 'Rating' },
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
      <section>
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
