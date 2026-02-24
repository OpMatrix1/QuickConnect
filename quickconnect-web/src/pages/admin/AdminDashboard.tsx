import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Users,
  Briefcase,
  CalendarCheck,
  DollarSign,
  FileText,
  ArrowRight,
  BarChart3,
  UserPlus,
  ClipboardList,
  FolderOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import {
  Card,
  CardContent,
  Spinner,
  EmptyState,
} from '@/components/ui'

interface ActivityItem {
  id: string
  type: 'user' | 'booking' | 'post'
  title: string
  subtitle: string
  createdAt: string
}

export function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [totalUsers, setTotalUsers] = useState(0)
  const [totalProviders, setTotalProviders] = useState(0)
  const [totalBookings, setTotalBookings] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [activePosts, setActivePosts] = useState(0)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])

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
        const [
          usersRes,
          providersRes,
          bookingsRes,
          postsRes,
          paymentsRes,
          recentUsersRes,
          recentBookingsRes,
          recentPostsRes,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase
            .from('service_providers')
            .select('*', { count: 'exact', head: true }),
          supabase.from('bookings').select('*', { count: 'exact', head: true }),
          supabase
            .from('looking_for_posts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active'),
          supabase
            .from('payments')
            .select('amount')
            .eq('status', 'completed'),
          supabase
            .from('profiles')
            .select('id, full_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('bookings')
            .select('id, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('looking_for_posts')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        setTotalUsers(usersRes.count ?? 0)
        setTotalProviders(providersRes.count ?? 0)
        setTotalBookings(bookingsRes.count ?? 0)
        setActivePosts(postsRes.count ?? 0)

        const payments = (paymentsRes.data || []) as { amount: number }[]
        setTotalRevenue(payments.reduce((sum, p) => sum + p.amount, 0))

        const activity: ActivityItem[] = []
        const users = (recentUsersRes.data || []) as {
          id: string
          full_name: string
          created_at: string
        }[]
        users.forEach((u) => {
          activity.push({
            id: `user-${u.id}`,
            type: 'user',
            title: 'New user joined',
            subtitle: u.full_name || 'Unknown',
            createdAt: u.created_at,
          })
        })

        const bookings = (recentBookingsRes.data || []) as {
          id: string
          created_at: string
        }[]
        bookings.forEach((b) => {
          activity.push({
            id: `booking-${b.id}`,
            type: 'booking',
            title: 'New booking',
            subtitle: `Booking #${b.id.slice(0, 8)}`,
            createdAt: b.created_at,
          })
        })

        const posts = (recentPostsRes.data || []) as {
          id: string
          title: string
          created_at: string
        }[]
        posts.forEach((p) => {
          activity.push({
            id: `post-${p.id}`,
            type: 'post',
            title: 'New post',
            subtitle: p.title || 'Untitled',
            createdAt: p.created_at,
          })
        })

        activity.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setRecentActivity(activity.slice(0, 10))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id, profile?.role])

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-gray-600">
          Overview of platform activity and key metrics
        </p>
      </div>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <Users className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
              <Briefcase className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalProviders}</p>
              <p className="text-sm text-gray-600">Total Providers</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <CalendarCheck className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
              <p className="text-sm text-gray-600">Total Bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <DollarSign className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="md">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <FileText className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activePosts}</p>
              <p className="text-sm text-gray-600">Active Posts</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link to={ROUTES.ADMIN_USERS}>
            <Card padding="md" hover className="min-w-[200px]">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-500">View and manage all users</p>
                </div>
                <ArrowRight className="ml-auto size-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link to={ROUTES.ADMIN_REPORTS}>
            <Card padding="md" hover className="min-w-[200px]">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent-100 text-accent-600">
                  <BarChart3 className="size-5" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-500">Analytics and insights</p>
                </div>
                <ArrowRight className="ml-auto size-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link to={ROUTES.ADMIN_CATEGORIES}>
            <Card padding="md" hover className="min-w-[200px]">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-success-100 text-success-600">
                  <FolderOpen className="size-5" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">Manage Categories</p>
                  <p className="text-sm text-gray-500">Service categories</p>
                </div>
                <ArrowRight className="ml-auto size-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-12" />}
            title="No recent activity"
            description="Activity will appear here as users join and interact"
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50/50"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                      item.type === 'user'
                        ? 'bg-primary-100 text-primary-600'
                        : item.type === 'booking'
                          ? 'bg-warning-100 text-warning-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {item.type === 'user' ? (
                      <Users className="size-5" />
                    ) : item.type === 'booking' ? (
                      <CalendarCheck className="size-5" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="truncate text-sm text-gray-500">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Charts placeholder */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Analytics</h2>
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
            <BarChart3 className="size-12 text-gray-400" />
            <p className="mt-4 text-sm font-medium text-gray-600">
              Charts placeholder
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Integrate a chart library here for analytics visualization
            </p>
          </div>
        </Card>
      </section>
    </div>
  )
}
