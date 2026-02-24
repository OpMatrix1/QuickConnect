import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Clock, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import {
  formatCurrency,
  formatRelativeTime,
  truncate,
  URGENCY_CONFIG,
  POST_STATUS_CONFIG,
  CITIES,
} from '@/lib/utils'
import type { ServiceCategory } from '@/lib/types'
import {
  Button,
  Card,
  Badge,
  Avatar,
  Select,
  Spinner,
  EmptyState,
} from '@/components/ui'

type PostWithDetails = {
  id: string
  title: string
  description: string
  budget_min: number | null
  budget_max: number | null
  location_address: string | null
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  status: string
  created_at: string
  category_id: string
  profiles: { full_name: string; avatar_url: string | null }
  service_categories: ServiceCategory
  response_count?: number
}

type SortOption = 'newest' | 'oldest' | 'budget'

const URGENCY_OPTIONS = [
  { value: '', label: 'All urgencies' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
] as const

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'budget', label: 'Highest budget' },
]

function PostCard({ post }: { post: PostWithDetails }) {
  const budgetRange =
    post.budget_min != null || post.budget_max != null
      ? `${post.budget_min != null ? formatCurrency(post.budget_min) : '?'} - ${post.budget_max != null ? formatCurrency(post.budget_max) : '?'}`
      : 'Budget not specified'

  const urgencyConfig = URGENCY_CONFIG[post.urgency]
  const statusConfig = POST_STATUS_CONFIG[post.status as keyof typeof POST_STATUS_CONFIG]

  return (
    <Link to={ROUTES.POST_DETAIL.replace(':id', post.id)}>
      <Card padding="md" hover className="h-full transition-all hover:border-primary-200">
        <div className="flex h-full flex-col">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-2">{post.title}</h3>
            <div className="flex shrink-0 gap-1.5">
              <Badge variant={post.urgency === 'emergency' ? 'danger' : post.urgency === 'high' ? 'warning' : 'info'}>
                {urgencyConfig?.label ?? post.urgency}
              </Badge>
              {statusConfig && (
                <Badge variant={post.status === 'active' ? 'success' : 'default'}>
                  {statusConfig.label}
                </Badge>
              )}
            </div>
          </div>
          <p className="mb-3 flex-1 text-sm text-gray-600 line-clamp-2">
            {truncate(post.description, 120)}
          </p>
          <div className="space-y-1.5 text-sm text-gray-500">
            <p className="font-medium text-primary-600">{budgetRange}</p>
            {post.location_address && (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0" />
                {truncate(post.location_address, 40)}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" />
              {formatRelativeTime(post.created_at)}
            </p>
            <p className="flex items-center gap-1.5">
              <MessageSquare className="size-4 shrink-0" />
              {post.response_count ?? 0} responses
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
            <Avatar
              src={post.profiles?.avatar_url}
              fallback={post.profiles?.full_name || '?'}
              size="sm"
            />
            <span className="text-sm font-medium text-gray-700">
              {post.profiles?.full_name || 'Anonymous'}
            </span>
            <Badge variant="primary" className="ml-auto">
              {post.service_categories?.name}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function LookingFor() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<PostWithDetails[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('service_categories').select('id, name').order('name')
      setCategories((data || []) as ServiceCategory[])
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true)
      setError(null)
      try {
        let query = supabase
          .from('looking_for_posts')
          .select(
            `
            id,
            title,
            description,
            budget_min,
            budget_max,
            location_address,
            urgency,
            status,
            created_at,
            category_id,
            profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
            service_categories(id, name)
          `
          )
          .eq('status', 'active')

        if (categoryFilter) {
          query = query.eq('category_id', categoryFilter)
        }
        if (cityFilter) {
          query = query.ilike('location_address', `%${cityFilter}%`)
        }
        if (urgencyFilter) {
          query = query.eq('urgency', urgencyFilter as 'low' | 'medium' | 'high' | 'emergency')
        }

        switch (sortBy) {
          case 'oldest':
            query = query.order('created_at', { ascending: true })
            break
          case 'budget':
            query = query.order('budget_max', { ascending: false, nullsFirst: false })
            break
          default:
            query = query.order('created_at', { ascending: false })
        }

        const { data: postsData, error: fetchError } = await query.limit(50)

        if (fetchError) throw fetchError

        const postsArray = (postsData || []) as PostWithDetails[]
        const postIds = postsArray.map((p) => p.id)
        if (postIds.length > 0) {
          const { data: responsesData } = await supabase
            .from('looking_for_responses')
            .select('post_id')
            .in('post_id', postIds)

          const responseCounts = (responsesData || []).reduce(
            (acc, r: { post_id: string }) => {
              acc[r.post_id] = (acc[r.post_id] || 0) + 1
              return acc
            },
            {} as Record<string, number>
          )

          const postsWithCounts = postsArray.map((p) => ({
            ...p,
            response_count: responseCounts[p.id] || 0,
          }))
          setPosts(postsWithCounts)
        } else {
          setPosts([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts')
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [categoryFilter, cityFilter, urgencyFilter, sortBy])

  const isCustomer = profile?.role === 'customer'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Looking For
          </h1>
          <p className="mt-1 text-gray-600">
            Browse active posts and find service opportunities.
          </p>
        </div>
        {isCustomer && (
          <Link to={ROUTES.CREATE_POST}>
            <Button variant="primary" icon={<Plus className="size-5" />}>
              Create Post
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-[140px] flex-1">
          <Select
            label="Category"
            options={[
              { value: '', label: 'All categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <Select
            label="City"
            options={[
              { value: '', label: 'All cities' },
              ...CITIES.map((c) => ({ value: c, label: c })),
            ]}
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <Select
            label="Urgency"
            options={URGENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <Select
            label="Sort"
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-danger-700">{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-12" />}
          title="No posts found"
          description="Try adjusting your filters or check back later for new opportunities."
          action={
            isCustomer ? (
              <Link to={ROUTES.CREATE_POST}>
                <Button variant="primary">Create First Post</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {isCustomer && (
        <Link
          to={ROUTES.CREATE_POST}
          className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-all hover:bg-primary-600 hover:scale-105 sm:bottom-8 sm:right-8"
          aria-label="Create post"
        >
          <Plus className="size-6" />
        </Link>
      )}
    </div>
  )
}
