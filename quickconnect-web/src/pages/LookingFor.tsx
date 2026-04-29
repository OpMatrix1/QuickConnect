import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  MapPin,
  Clock,
  MessageSquare,
  LayoutGrid,
  FolderOpen,
  ExternalLink,
} from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  truncate,
  URGENCY_CONFIG,
  POST_STATUS_CONFIG,
  CITIES,
} from '@/lib/utils'
import type { ServiceCategory, PostWithDetails, ResponseWithProvider } from '@/lib/types'
import {
  Button,
  Card,
  Badge,
  Avatar,
  Select,
  Spinner,
  EmptyState,
} from '@/components/ui'

type BrowsePost = PostWithDetails & { response_count?: number }

type SortOption = 'newest' | 'oldest' | 'budget'

type MyPostWithResponses = PostWithDetails & {
  looking_for_responses: ResponseWithProvider[]
}

const RESPONSE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

function responseStatusBadgeVariant(
  status: string
): 'default' | 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'accepted') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

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

function PostCard({ post }: { post: BrowsePost }) {
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
          <div className="mt-4 flex min-h-[2.75rem] items-center gap-3 border-t border-gray-100 pt-3">
            <Avatar
              src={post.profiles?.avatar_url}
              fallback={post.profiles?.full_name || '?'}
              size="sm"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
              {post.profiles?.full_name || 'Anonymous'}
            </span>
            <span
              title={post.service_categories?.name ?? undefined}
              className={cn(
                'ml-auto flex h-11 w-[9.25rem] shrink-0 items-center justify-center overflow-hidden rounded-md px-1.5 py-1',
                'bg-primary-100 text-center text-[11px] font-medium leading-snug text-primary-800',
                'sm:w-40 sm:text-xs sm:leading-tight'
              )}
            >
              <span className="line-clamp-2 break-words hyphens-auto">
                {post.service_categories?.name}
              </span>
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function MyPostCard({ post }: { post: MyPostWithResponses }) {
  const responses = [...(post.looking_for_responses || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const budgetRange =
    post.budget_min != null || post.budget_max != null
      ? `${post.budget_min != null ? formatCurrency(post.budget_min) : '?'} - ${post.budget_max != null ? formatCurrency(post.budget_max) : '?'}`
      : 'Budget not specified'
  const urgencyConfig = URGENCY_CONFIG[post.urgency]
  const statusConfig = POST_STATUS_CONFIG[post.status as keyof typeof POST_STATUS_CONFIG]

  return (
    <Card padding="md" className="h-full border-gray-200">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to={ROUTES.POST_DETAIL.replace(':id', post.id)}
              className="group font-semibold text-gray-900 hover:text-primary-600 line-clamp-2"
            >
              {post.title}
              <ExternalLink className="ml-1 inline size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{truncate(post.description, 140)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant={post.urgency === 'emergency' ? 'danger' : post.urgency === 'high' ? 'warning' : 'info'}>
              {urgencyConfig?.label ?? post.urgency}
            </Badge>
            {statusConfig && (
              <Badge variant={post.status === 'active' ? 'success' : 'default'}>{statusConfig.label}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="font-medium text-primary-600">{budgetRange}</span>
          {post.location_address && (
            <span className="flex items-center gap-1">
              <MapPin className="size-4 shrink-0" />
              {truncate(post.location_address, 48)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-4 shrink-0" />
            {formatRelativeTime(post.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-4 shrink-0" />
            {responses.length} {responses.length === 1 ? 'quote' : 'quotes'}
          </span>
        </div>

        {post.service_categories?.name && (
          <p className="text-xs font-medium text-primary-800">
            {post.service_categories.name}
          </p>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Provider quotes & replies
          </p>
          {responses.length === 0 ? (
            <p className="text-sm text-gray-500">No quotes yet. Providers will appear here when they respond.</p>
          ) : (
            <ul className="space-y-3">
              {responses.map((r) => {
                const sp = r.service_providers
                const prof = sp?.profiles
                const name = sp?.business_name || prof?.full_name || 'Provider'
                return (
                  <li
                    key={r.id}
                    className="flex gap-3 rounded-lg bg-gray-50 p-3 text-sm"
                  >
                    <span className="shrink-0">
                      <Avatar src={prof?.avatar_url} fallback={name} size="sm" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{name}</span>
                        <Badge variant={responseStatusBadgeVariant(r.status)}>
                          {RESPONSE_STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-semibold text-primary-700">{formatCurrency(r.quoted_price)}</p>
                      {r.message && (
                        <p className="mt-1 text-gray-600 line-clamp-3">{r.message}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(r.created_at)}
                        {r.estimated_duration ? ` · ${r.estimated_duration}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-3">
            <Link to={ROUTES.POST_DETAIL.replace(':id', post.id)}>
              <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                Open post — accept or manage quotes
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function LookingFor() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [listMode, setListMode] = useState<'browse' | 'mine'>(
    searchParams.get('tab') === 'mine' ? 'mine' : 'browse'
  )
  const [posts, setPosts] = useState<BrowsePost[]>([])
  const [myPosts, setMyPosts] = useState<MyPostWithResponses[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(true)
  const [loadingMine, setLoadingMine] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  // Stable ref so the realtime subscription can call the latest fetchPosts
  const fetchPostsRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('service_categories').select('id, name').order('name')
      setCategories((data || []) as ServiceCategory[])
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (listMode !== 'browse') return

    async function fetchPosts() {
      setLoadingBrowse(true)
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

        const postsArray = (postsData || []) as unknown as BrowsePost[]
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
        setLoadingBrowse(false)
      }
    }

    fetchPostsRef.current = fetchPosts
    fetchPosts()
  }, [listMode, categoryFilter, cityFilter, urgencyFilter, sortBy])

  // Live: subscribe to looking_for_posts changes and refresh browse list
  useEffect(() => {
    if (listMode !== 'browse') return

    const ch = supabase
      .channel('looking-for-posts-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'looking_for_posts' },
        () => { fetchPostsRef.current() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'looking_for_responses' },
        () => { fetchPostsRef.current() }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [listMode])

  const fetchMyPosts = useCallback(async () => {
    if (!user?.id) return
    setLoadingMine(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('looking_for_posts')
        .select(
          `
          *,
          profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
          service_categories(id, name),
          looking_for_responses (
            id,
            post_id,
            provider_id,
            quoted_price,
            message,
            estimated_duration,
            available_date,
            available_time,
            status,
            created_at,
            service_providers!looking_for_responses_provider_id_fkey(
              business_name,
              rating_avg,
              review_count,
              profiles!service_providers_profile_id_fkey(full_name, avatar_url)
            )
          )
        `
        )
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const rows = (data || []).map((row) => ({
        ...(row as MyPostWithResponses),
        looking_for_responses: (row as MyPostWithResponses).looking_for_responses ?? [],
      }))
      setMyPosts(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your posts')
    } finally {
      setLoadingMine(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (listMode !== 'mine' || !user?.id) return
    fetchMyPosts()
  }, [listMode, user?.id, fetchMyPosts])

  const isCustomer = profile?.role === 'customer'
  const loading = listMode === 'browse' ? loadingBrowse : loadingMine

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Looking For
          </h1>
          <p className="mt-1 text-gray-600">
            {listMode === 'mine'
              ? 'Your posts, provider quotes, and reply status in one place.'
              : 'Browse active posts and find service opportunities.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCustomer && (
            <>
              <Button
                type="button"
                variant={listMode === 'browse' ? 'primary' : 'secondary'}
                icon={<LayoutGrid className="size-5" />}
                onClick={() => setListMode('browse')}
              >
                Browse
              </Button>
              <Button
                type="button"
                variant={listMode === 'mine' ? 'primary' : 'secondary'}
                icon={<FolderOpen className="size-5" />}
                onClick={() => setListMode('mine')}
              >
                My posts
              </Button>
              <Link to={ROUTES.CREATE_POST}>
                <Button variant="primary" icon={<Plus className="size-5" />}>
                  Create Post
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {listMode === 'browse' && (
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
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-danger-700">{error}</p>
        </div>
      ) : listMode === 'browse' ? (
        posts.length === 0 ? (
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
            {posts.map((post, i) => (
              <Reveal key={post.id} delay={i * 55} animation="scale">
                <PostCard post={post} />
              </Reveal>
            ))}
          </div>
        )
      ) : !user?.id ? (
        <EmptyState
          icon={<FolderOpen className="size-12" />}
          title="Sign in required"
          description="Sign in as a customer to see your posts and quotes."
        />
      ) : myPosts.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-12" />}
          title="No posts yet"
          description="Create a post to get quotes from providers. Quotes and replies will show up here."
          action={
            <Link to={ROUTES.CREATE_POST}>
              <Button variant="primary">Create a post</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {myPosts.map((post, i) => (
            <Reveal key={post.id} delay={i * 45} animation="scale">
              <MyPostCard post={post} />
            </Reveal>
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
