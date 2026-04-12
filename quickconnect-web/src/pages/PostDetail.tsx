import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Clock,
  Calendar,
  MessageSquare,
  Check,
  X,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  URGENCY_CONFIG,
  POST_STATUS_CONFIG,
} from '@/lib/utils'
import type {
  PostWithDetails,
  LookingForResponse,
  ServiceProvider,
} from '@/lib/types'
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Avatar,
  StarRating,
  Input,
  Textarea,
  Spinner,
  EmptyState,
} from '@/components/ui'

type ResponseWithProviderData = LookingForResponse & {
  service_providers: ServiceProvider & {
    profiles: { full_name: string; avatar_url: string | null }
  }
}

export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [post, setPost] = useState<PostWithDetails | null>(null)
  const [responses, setResponses] = useState<ResponseWithProviderData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [quotePrice, setQuotePrice] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [quoteDuration, setQuoteDuration] = useState('')
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteTime, setQuoteTime] = useState('')
  const [submittingQuote, setSubmittingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const isOwner = user && post && post.customer_id === user.id
  const isProvider = profile?.role === 'provider'
  const canSubmitQuote = isProvider && !isOwner && post?.status === 'active'

  useEffect(() => {
    if (!id) return

    async function fetchPost() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('looking_for_posts')
          .select(
            `
            *,
            profiles!looking_for_posts_customer_id_fkey(full_name, avatar_url),
            service_categories(id, name)
          `
          )
          .eq('id', id!)
          .single()

        if (fetchError) throw fetchError
        setPost(data as unknown as PostWithDetails)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Post not found')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  useEffect(() => {
    if (!id) return

    const postId = id

    async function fetchResponses() {
      const { data } = await supabase
        .from('looking_for_responses')
        .select(
          `
          *,
          service_providers!looking_for_responses_provider_id_fkey(
            profiles!service_providers_profile_id_fkey(full_name, avatar_url),
            rating_avg,
            review_count
          )
        `
        )
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      setResponses((data || []) as ResponseWithProviderData[])
    }

    fetchResponses()

    const channel = supabase
      .channel(`post-responses-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'looking_for_responses',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchResponses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !post || !profile || profile.role !== 'provider') return

    const price = parseFloat(quotePrice)
    if (!quotePrice || isNaN(price) || price <= 0) {
      setQuoteError('Enter a price greater than zero')
      return
    }
    if (quoteDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(quoteDate) < today) {
        setQuoteError('Available date cannot be in the past')
        return
      }
    }

    setSubmittingQuote(true)
    setQuoteError(null)
    try {
      const { data: providerData } = await supabase
        .from('service_providers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!providerData) {
        setQuoteError('Provider profile not found')
        setSubmittingQuote(false)
        return
      }

      const { error: insertError } = await supabase.from('looking_for_responses').insert({
        post_id: post.id,
        provider_id: (providerData as { id: string }).id,
        quoted_price: price,
        message: quoteMessage.trim() || null,
        estimated_duration: quoteDuration.trim() || null,
        available_date: quoteDate || null,
        available_time: quoteTime || null,
        status: 'pending',
      } as any)

      if (insertError) throw insertError

      setQuotePrice('')
      setQuoteMessage('')
      setQuoteDuration('')
      setQuoteDate('')
      setQuoteTime('')
      const { data } = await supabase
        .from('looking_for_responses')
        .select(
          `
          *,
          service_providers!looking_for_responses_provider_id_fkey(
            profiles!service_providers_profile_id_fkey(full_name, avatar_url),
            rating_avg,
            review_count
          )
        `
        )
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
      setResponses((data || []) as ResponseWithProviderData[])
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Failed to submit quote')
    } finally {
      setSubmittingQuote(false)
    }
  }

  async function handleAcceptResponse(responseId: string) {
    if (!user || !post || !isOwner) return

    setAcceptingId(responseId)
    try {
      const response = responses.find((r) => r.id === responseId)
      if (!response) return

      const providerId = (response as ResponseWithProviderData).provider_id

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          provider_id: providerId,
          looking_for_response_id: responseId,
          status: 'pending',
          agreed_price: response.quoted_price,
          location_address: post.location_address,
          scheduled_date: response.available_date,
          scheduled_time: response.available_time,
        } as never)
        .select('id')
        .single()

      if (bookingError) throw bookingError

      await supabase
        .from('looking_for_responses')
        .update({ status: 'accepted' } as never)
        .eq('id', responseId)

      await supabase
        .from('looking_for_responses')
        .update({ status: 'rejected' } as never)
        .eq('post_id', post.id)
        .neq('id', responseId)

      await supabase
        .from('looking_for_posts')
        .update({ status: 'matched' } as never)
        .eq('id', post.id)

      setPost((p) => (p ? { ...p, status: 'matched' } : null))
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId ? { ...r, status: 'accepted' } : { ...r, status: 'rejected' }
        )
      )

      navigate(ROUTES.BOOKING_DETAIL.replace(':id', (booking as { id: string }).id))
    } catch (err) {
      console.error(err)
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleRejectResponse(responseId: string) {
    if (!user || !post || !isOwner) return

    setRejectingId(responseId)
    try {
      await supabase
        .from('looking_for_responses')
        .update({ status: 'rejected' } as never)
        .eq('id', responseId)

      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, status: 'rejected' } : r))
      )
    } catch (err) {
      console.error(err)
    } finally {
      setRejectingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-12" />}
        title="Post not found"
        description={error || 'This post may have been removed.'}
        action={
          <Link to={ROUTES.LOOKING_FOR}>
            <Button variant="primary">Browse Posts</Button>
          </Link>
        }
      />
    )
  }

  const urgencyConfig = URGENCY_CONFIG[post.urgency]
  const statusConfig = POST_STATUS_CONFIG[post.status as keyof typeof POST_STATUS_CONFIG]
  const budgetRange =
    post.budget_min != null || post.budget_max != null
      ? `${post.budget_min != null ? formatCurrency(post.budget_min) : '?'} - ${post.budget_max != null ? formatCurrency(post.budget_max) : '?'}`
      : 'Not specified'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{post.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="primary">{post.service_categories?.name}</Badge>
            <Badge
              variant={
                post.urgency === 'emergency'
                  ? 'danger'
                  : post.urgency === 'high'
                    ? 'warning'
                    : 'info'
              }
            >
              {urgencyConfig?.label ?? post.urgency}
            </Badge>
            {statusConfig && (
              <Badge variant={post.status === 'active' ? 'success' : 'default'}>
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </div>
        <Link to={ROUTES.LOOKING_FOR}>
          <Button variant="outline">Back to Posts</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <CardContent>
              <p className="whitespace-pre-wrap text-gray-700">{post.description}</p>
            </CardContent>
          </Card>

          {post.images && post.images.length > 0 && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Images</h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {post.images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Post image ${i + 1}`}
                      className="max-h-48 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card padding="lg">
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Details</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-2 text-gray-700">
                <span className="font-medium text-gray-500">Budget:</span>
                {budgetRange}
              </p>
              {post.location_address && (
                <p className="flex items-center gap-2 text-gray-700">
                  <MapPin className="size-4 shrink-0 text-gray-400" />
                  {post.location_address}
                </p>
              )}
              {post.preferred_date && (
                <p className="flex items-center gap-2 text-gray-700">
                  <Calendar className="size-4 shrink-0 text-gray-400" />
                  {formatDate(post.preferred_date)}
                </p>
              )}
              {post.preferred_time && (
                <p className="flex items-center gap-2 text-gray-700">
                  <Clock className="size-4 shrink-0 text-gray-400" />
                  {formatTime(post.preferred_time)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Posted by</h3>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar
                  src={post.profiles?.avatar_url}
                  fallback={post.profiles?.full_name || '?'}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {post.profiles?.full_name || 'Anonymous'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatRelativeTime(post.created_at)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {canSubmitQuote && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Submit Your Quote</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  {quoteError && (
                    <p className="text-sm text-danger-600">{quoteError}</p>
                  )}
                  <Input
                    label="Your Price (P)"
                    type="number"
                    min={0}
                    step={0.01}
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    required
                  />
                  <Textarea
                    label="Message"
                    placeholder="Describe your approach, experience..."
                    value={quoteMessage}
                    onChange={(e) => setQuoteMessage(e.target.value)}
                    rows={3}
                  />
                  <Input
                    label="Estimated Duration"
                    placeholder="e.g. 2 hours"
                    value={quoteDuration}
                    onChange={(e) => setQuoteDuration(e.target.value)}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Available Date"
                      type="date"
                      value={quoteDate}
                      onChange={(e) => setQuoteDate(e.target.value)}
                    />
                    <Input
                      label="Available Time"
                      type="time"
                      value={quoteTime}
                      onChange={(e) => setQuoteTime(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Send className="size-4" />}
                    loading={submittingQuote}
                    fullWidth
                  >
                    Send Quote
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {isOwner && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Responses ({responses.length})
          </h2>
          {responses.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-12" />}
              title="No responses yet"
              description="Providers will be able to submit quotes. You'll see them here."
            />
          ) : (
            <div className="space-y-4">
              {responses.map((response) => {
                const provider = response.service_providers as ServiceProvider & {
                  profiles: { full_name: string; avatar_url: string | null }
                  rating_avg?: number
                  review_count?: number
                }
                const isAccepted = response.status === 'accepted'
                const isRejected = response.status === 'rejected'
                const isPending = response.status === 'pending'

                return (
                  <Card key={response.id} padding="lg">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <Avatar
                          src={provider?.profiles?.avatar_url}
                          fallback={provider?.profiles?.full_name || '?'}
                          size="lg"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {provider?.profiles?.full_name || 'Provider'}
                            </p>
                            {provider?.rating_avg != null && (
                              <StarRating
                                rating={provider.rating_avg}
                                readonly
                                size="sm"
                              />
                            )}
                          </div>
                          <p className="mt-1 text-lg font-bold text-primary-600">
                            {formatCurrency(response.quoted_price)}
                          </p>
                          {response.message && (
                            <p className="mt-2 text-sm text-gray-600">{response.message}</p>
                          )}
                          {(response.available_date || response.available_time) && (
                            <p className="mt-1 text-sm text-gray-500">
                              Available:{' '}
                              {response.available_date && formatDate(response.available_date)}
                              {response.available_time && ` at ${formatTime(response.available_time)}`}
                            </p>
                          )}
                          {response.estimated_duration && (
                            <p className="text-sm text-gray-500">
                              Est. {response.estimated_duration}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOwner && post.status === 'active' && isPending && (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Check className="size-4" />}
                            loading={acceptingId === response.id}
                            onClick={() => handleAcceptResponse(response.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<X className="size-4" />}
                            loading={rejectingId === response.id}
                            onClick={() => handleRejectResponse(response.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {(isAccepted || isRejected) && (
                        <Badge variant={isAccepted ? 'success' : 'default'}>
                          {isAccepted ? 'Accepted' : 'Rejected'}
                        </Badge>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      {!isOwner && canSubmitQuote && responses.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {responses.length} Quote{responses.length !== 1 ? 's' : ''} received
          </h2>
          <p className="text-sm text-gray-500">
            Other providers have submitted quotes. You can submit your own above.
          </p>
        </section>
      )}
    </div>
  )
}
