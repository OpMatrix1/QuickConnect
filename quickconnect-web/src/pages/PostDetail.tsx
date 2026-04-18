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
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  errorMessageFromUnknown,
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
  Modal,
  Select,
} from '@/components/ui'

type ResponseWithProviderData = LookingForResponse & {
  service_providers: ServiceProvider & {
    profiles: { full_name: string; avatar_url: string | null }
  }
}

type QuoteFieldKey = 'price' | 'message' | 'duration' | 'date' | 'time'

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
  const [quoteFieldErrors, setQuoteFieldErrors] = useState<
    Partial<Record<QuoteFieldKey, string>>
  >({})

  const clearQuoteFieldError = (key: QuoteFieldKey) => {
    setQuoteFieldErrors((prev) => {
      if (prev[key] === undefined) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('other')
  const [reportDescription, setReportDescription] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const isOwner = user && post && post.customer_id === user.id
  const isProvider = profile?.role === 'provider'
  const isAdmin = profile?.role === 'admin'
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

    setQuoteError(null)
    setQuoteFieldErrors({})

    const fieldErrors: Partial<Record<QuoteFieldKey, string>> = {}
    const price = parseFloat(quotePrice)

    if (!quotePrice.trim()) {
      fieldErrors.price = 'Enter your price'
    } else if (isNaN(price) || price <= 0) {
      fieldErrors.price = 'Enter a price greater than zero'
    }

    if (!quoteMessage.trim()) {
      fieldErrors.message = 'Add a message for the poster'
    }
    if (!quoteDuration.trim()) {
      fieldErrors.duration = 'Enter how long the work will take'
    }
    if (!quoteDate.trim()) {
      fieldErrors.date = 'Choose an available date'
    }
    if (!quoteTime.trim()) {
      fieldErrors.time = 'Choose an available time'
    }

    if (quoteDate.trim() && !fieldErrors.date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(quoteDate) < today) {
        fieldErrors.date = 'Available date cannot be in the past'
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setQuoteFieldErrors(fieldErrors)
      return
    }

    setSubmittingQuote(true)
    try {
      const { error: insertError } = await supabase.rpc('provider_submit_looking_for_response', {
        p_post_id: post.id,
        p_quoted_price: price,
        p_message: quoteMessage.trim() || null,
        p_estimated_duration: quoteDuration.trim() || null,
        p_available_date: quoteDate.trim() ? quoteDate : null,
        p_available_time: quoteTime.trim() ? quoteTime : null,
      } as never)

      if (insertError) throw insertError

      setQuotePrice('')
      setQuoteMessage('')
      setQuoteDuration('')
      setQuoteDate('')
      setQuoteTime('')
      setQuoteFieldErrors({})
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
      setQuoteError(errorMessageFromUnknown(err, 'Failed to submit quote'))
    } finally {
      setSubmittingQuote(false)
    }
  }

  async function handleAcceptResponse(responseId: string) {
    if (!user || !post || !isOwner) return

    setAcceptingId(responseId)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'customer_accept_looking_for_response',
        { p_response_id: responseId } as never
      )
      if (rpcError) throw rpcError

      const bookingId = (data as { booking_id?: string } | null)?.booking_id
      setPost((p) => (p ? { ...p, status: 'matched' } : null))
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId ? { ...r, status: 'accepted' } : { ...r, status: 'rejected' }
        )
      )

      if (bookingId) {
        navigate(`${ROUTES.MY_BOOKINGS}?booking=${bookingId}`)
      }
    } catch (err) {
      console.error(err)
      setQuoteError(
        errorMessageFromUnknown(
          err,
          'Could not accept this response. Check your wallet balance.'
        )
      )
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

  async function handleDeletePost() {
    if (!user || !post || (!isOwner && !isAdmin)) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('looking_for_posts')
        .delete()
        .eq('id', post.id)

      if (deleteError) throw deleteError
      setDeleteModalOpen(false)
      navigate(ROUTES.LOOKING_FOR)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmitReport() {
    if (!user || !post || isOwner) return
    if (reportDescription.trim().length < 8) {
      setReportError('Please add at least 8 characters so admins can evaluate clearly.')
      return
    }

    setReportSubmitting(true)
    setReportError(null)
    try {
      const { error: reportInsertError } = await supabase
        .from('looking_for_post_reports')
        .insert({
          reporter_id: user.id,
          post_id: post.id,
          reason: reportReason,
          description: reportDescription.trim(),
        } as never)
      if (reportInsertError) throw reportInsertError
      setReportModalOpen(false)
      setReportDescription('')
      setReportReason('other')
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setReportSubmitting(false)
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

      <div className="flex flex-wrap gap-2">
        {isOwner && post.status === 'active' && (
          <Link to={ROUTES.EDIT_POST.replace(':id', post.id)}>
            <Button size="sm" variant="outline" icon={<Edit2 className="size-4" />}>
              Edit Post
            </Button>
          </Link>
        )}
        {(isOwner || isAdmin) && (
          <Button
            size="sm"
            variant="outline"
            className="text-danger-600 border-danger-300 hover:bg-danger-50"
            icon={<Trash2 className="size-4" />}
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete Post
          </Button>
        )}
        {!isOwner && user && (
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-700 hover:bg-warning-50"
            icon={<AlertTriangle className="size-4" />}
            onClick={() => setReportModalOpen(true)}
          >
            Report Post
          </Button>
        )}
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
                <p className="mt-1 text-sm text-gray-500">
                  The poster must have enough wallet balance to cover your quoted price, or the quote cannot be
                  submitted.
                </p>
              </CardHeader>
              <CardContent>
                <form noValidate onSubmit={handleSubmitQuote} className="space-y-4">
                  {quoteError && (
                    <p className="text-sm text-danger-600">{quoteError}</p>
                  )}
                  <Input
                    label="Your Price (P) *"
                    type="number"
                    min={0}
                    step={0.01}
                    value={quotePrice}
                    onChange={(e) => {
                      setQuotePrice(e.target.value)
                      clearQuoteFieldError('price')
                    }}
                    error={quoteFieldErrors.price}
                    required
                    aria-required
                  />
                  <Textarea
                    label="Message *"
                    placeholder="Describe your approach, experience..."
                    value={quoteMessage}
                    onChange={(e) => {
                      setQuoteMessage(e.target.value)
                      clearQuoteFieldError('message')
                    }}
                    rows={3}
                    error={quoteFieldErrors.message}
                    required
                    aria-required
                  />
                  <Input
                    label="Estimated Duration *"
                    placeholder="e.g. 2 hours"
                    value={quoteDuration}
                    onChange={(e) => {
                      setQuoteDuration(e.target.value)
                      clearQuoteFieldError('duration')
                    }}
                    error={quoteFieldErrors.duration}
                    required
                    aria-required
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Available Date *"
                      type="date"
                      value={quoteDate}
                      onChange={(e) => {
                        setQuoteDate(e.target.value)
                        clearQuoteFieldError('date')
                      }}
                      error={quoteFieldErrors.date}
                      required
                      aria-required
                    />
                    <Input
                      label="Available Time *"
                      type="time"
                      value={quoteTime}
                      onChange={(e) => {
                        setQuoteTime(e.target.value)
                        clearQuoteFieldError('time')
                      }}
                      error={quoteFieldErrors.time}
                      required
                      aria-required
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

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete post"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This permanently removes the post and its related responses. Continue?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => void handleDeletePost()}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Report this post"
        size="md"
      >
        <div className="space-y-4">
          {reportError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {reportError}
            </p>
          )}
          <Select
            label="Reason"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            options={[
              { value: 'spam', label: 'Spam' },
              { value: 'harassment', label: 'Harassment' },
              { value: 'fraud', label: 'Fraud' },
              { value: 'inappropriate_content', label: 'Inappropriate content' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Textarea
            label="Details"
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            rows={4}
            placeholder="Explain what is wrong with this post..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={reportSubmitting}
              onClick={() => void handleSubmitReport()}
            >
              Submit report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
