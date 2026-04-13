import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Clock,
  CheckCircle2,
  MessageCircle,
  FileText,
  Star,
  Edit3,
  AlertCircle,
  ShieldCheck,
  Flag,
  Briefcase,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import type {
  Profile,
  ServiceProvider,
  Service,
  ServiceArea,
  ServiceCategory,
  Review,
} from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import {
  Button,
  Card,
  Badge,
  Avatar,
  StarRating,
  Spinner,
  EmptyState,
  Modal,
  Input,
  Textarea,
  Select,
} from '@/components/ui'

type TabId = 'services' | 'reviews' | 'about'

interface ProviderWithDetails extends ServiceProvider {
  profiles: Profile
  services: (Service & { service_categories: ServiceCategory | null })[]
  service_areas: ServiceArea[]
}

interface ReviewWithProfile extends Review {
  profiles: Profile
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or irrelevant content' },
  { value: 'harassment', label: 'Harassment or abusive behaviour' },
  { value: 'fraud', label: 'Fraud or scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'fake_profile', label: 'Fake or impersonation profile' },
  { value: 'other', label: 'Other' },
]

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('services')
  const [provider, setProvider] = useState<ProviderWithDetails | null>(null)
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([])
  const [completedJobs, setCompletedJobs] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contactLoading, setContactLoading] = useState(false)

  // Quote request modal state
  const [quoteModal, setQuoteModal] = useState(false)
  const [quoteDescription, setQuoteDescription] = useState('')
  const [quoteBudgetMin, setQuoteBudgetMin] = useState('')
  const [quoteBudgetMax, setQuoteBudgetMax] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteSuccess, setQuoteSuccess] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Report modal state
  const [reportModal, setReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('spam')
  const [reportDescription, setReportDescription] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const isOwnProfile =
    user &&
    profile?.role === 'provider' &&
    provider?.profile_id === user.id

  useEffect(() => {
    if (!id) return

    const fetchProvider = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('service_providers')
          .select(
            `
            *,
            profiles(*),
            services(
              *,
              service_categories(name)
            ),
            service_areas(*)
          `
          )
          .eq('id' as any, id as any)
          .single()

        if (fetchError) throw fetchError
        if (!data) throw new Error('Provider not found')

        setProvider(data as unknown as ProviderWithDetails)

        // Fetch completed jobs count
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id' as any, id as any)
          .eq('status' as any, 'completed' as any)
        setCompletedJobs(count ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load provider')
        setProvider(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProvider()
  }, [id])

  useEffect(() => {
    if (!provider?.id) return

    const fetchReviews = async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*, profiles(*)')
        .eq('provider_id' as any, provider.id as any)
        .order('created_at', { ascending: false })

      setReviews((data ?? []) as unknown as ReviewWithProfile[])
    }

    fetchReviews()
  }, [provider?.id])

  const handleContactProvider = async () => {
    if (!user || !provider) return
    setContactLoading(true)
    try {
      const participant1 = user.id
      const participant2 = provider.profile_id
      const [p1, p2] =
        participant1 < participant2
          ? [participant1, participant2]
          : [participant2, participant1]

      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1' as any, p1 as any)
        .eq('participant_2' as any, p2 as any)
        .maybeSingle()

      const existingId = (existing as { id: string } | null)?.id
      if (existingId) {
        navigate(ROUTES.CHAT_CONVERSATION.replace(':id', existingId))
        return
      }

      const { data: inserted, error } = await supabase
        .from('conversations')
        .insert({
          participant_1: p1,
          participant_2: p2,
        } as any)
        .select('id')
        .single()

      if (error) throw error
      const insertedId = (inserted as { id: string } | null)?.id
      if (insertedId) {
        navigate(ROUTES.CHAT_CONVERSATION.replace(':id', insertedId))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setContactLoading(false)
    }
  }

  const handleSubmitQuote = async () => {
    if (!user || !provider || !quoteDescription.trim()) return
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const { error } = await supabase.from('quotes').insert({
        customer_id: user.id,
        provider_id: provider.id,
        service_description: quoteDescription.trim(),
        budget_min: quoteBudgetMin ? parseFloat(quoteBudgetMin) : null,
        budget_max: quoteBudgetMax ? parseFloat(quoteBudgetMax) : null,
        customer_message: quoteMessage.trim() || null,
      } as any)
      if (error) throw error
      setQuoteSuccess(true)
      setQuoteDescription('')
      setQuoteBudgetMin('')
      setQuoteBudgetMax('')
      setQuoteMessage('')
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Failed to send quote request')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleSubmitReport = async () => {
    if (!user || !provider) return
    setReportLoading(true)
    setReportError(null)
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_user_id: provider.profile_id,
        reason: reportReason,
        description: reportDescription.trim() || null,
      } as any)
      if (error) {
        if (error.code === '23505') {
          throw new Error('You have already submitted a report for this user.')
        }
        throw error
      }
      setReportSuccess(true)
      setReportDescription('')
      setReportReason('spam')
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !provider) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-12 text-danger-500" />}
        title="Provider not found"
        description={error ?? 'The provider you are looking for does not exist.'}
        action={
          <Link to={ROUTES.PROVIDERS}>
            <Button variant="outline">Browse providers</Button>
          </Link>
        }
      />
    )
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'services', label: 'Services', icon: <FileText className="size-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="size-4" /> },
    { id: 'about', label: 'About', icon: <MapPin className="size-4" /> },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary-50 to-accent-50/50 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar
              src={provider.profiles?.avatar_url}
              fallback={provider.business_name}
              size="xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  {provider.business_name}
                </h1>
                {provider.is_verified && (
                  <Badge variant="success" className="gap-1">
                    <ShieldCheck className="size-3.5" />
                    Verified
                  </Badge>
                )}
                {isOwnProfile && (
                  <Link to={ROUTES.DASHBOARD}>
                    <Button variant="outline" size="sm" icon={<Edit3 className="size-4" />}>
                      Edit profile
                    </Button>
                  </Link>
                )}
              </div>
              {provider.description && (
                <p className="mt-2 text-gray-600">{provider.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={provider.rating_avg} size="sm" readonly />
                  <span className="font-medium text-gray-700">
                    {provider.rating_avg.toFixed(1)}
                  </span>
                  <span className="text-gray-500">
                    ({provider.review_count} reviews)
                  </span>
                </div>
                {/* Total completed jobs */}
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Briefcase className="size-4 shrink-0" />
                  <span className="font-medium text-gray-700">{completedJobs}</span>
                  <span>jobs completed</span>
                </div>
                {provider.profiles?.city && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <MapPin className="size-4 shrink-0" />
                    {provider.profiles.city}
                  </div>
                )}
                {provider.response_time_avg != null && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Clock className="size-4 shrink-0" />
                    ~{Math.round(provider.response_time_avg)}h response
                  </div>
                )}
                {provider.completion_rate != null && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <CheckCircle2 className="size-4 shrink-0" />
                    {Math.round(provider.completion_rate)}% completion
                  </div>
                )}
              </div>
              {!isOwnProfile && user && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    icon={<MessageCircle className="size-4" />}
                    onClick={handleContactProvider}
                    loading={contactLoading}
                  >
                    Contact Provider
                  </Button>
                  {profile?.role === 'customer' && (
                    <Button
                      variant="outline"
                      icon={<Send className="size-4" />}
                      onClick={() => {
                        setQuoteSuccess(false)
                        setQuoteError(null)
                        setQuoteModal(true)
                      }}
                    >
                      Request Quote
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Flag className="size-4" />}
                    className="text-gray-500 hover:text-danger-600 hover:bg-danger-50 ml-auto"
                    onClick={() => {
                      setReportSuccess(false)
                      setReportError(null)
                      setReportModal(true)
                    }}
                  >
                    Report
                  </Button>
                </div>
              )}
              {!user && (
                <div className="mt-6">
                  <Link to={ROUTES.LOGIN}>
                    <Button>Sign in to contact</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'services' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {provider.services?.filter((s) => s.is_active).length ? (
                provider.services
                  .filter((s) => s.is_active)
                  .map((service) => (
                    <Card key={service.id} padding="md">
                      <h3 className="font-semibold text-gray-900">
                        {service.title}
                      </h3>
                      {service.service_categories?.name && (
                        <Badge variant="default" className="mt-1">
                          {service.service_categories.name}
                        </Badge>
                      )}
                      {service.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <div className="mt-3 text-sm font-medium text-primary-600">
                        {service.price_type === 'quote'
                          ? 'Price on quote'
                          : service.price_min != null && service.price_max != null
                            ? `${formatCurrency(service.price_min)} - ${formatCurrency(service.price_max)}`
                            : service.price_min != null
                              ? `From ${formatCurrency(service.price_min)}`
                              : 'Contact for price'}
                      </div>
                    </Card>
                  ))
              ) : (
                <EmptyState
                  icon={<FileText className="size-12 text-gray-400" />}
                  title="No services listed"
                  description="This provider has not added any services yet."
                />
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length ? (
                reviews.map((review) => (
                  <Card key={review.id} padding="md">
                    <div className="flex gap-4">
                      <Avatar
                        src={review.profiles?.avatar_url}
                        fallback={review.profiles?.full_name ?? '?'}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">
                            {review.profiles?.full_name ?? 'Anonymous'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(review.created_at)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <StarRating rating={review.rating} size="sm" readonly />
                        </div>
                        {review.comment && (
                          <p className="mt-2 text-gray-600">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={<Star className="size-12 text-gray-400" />}
                  title="No reviews yet"
                  description="Be the first to leave a review after your booking."
                />
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <Card padding="md">
              <h3 className="font-semibold text-gray-900">Service Areas</h3>
              {provider.service_areas?.length ? (
                <ul className="mt-2 space-y-1">
                  {provider.service_areas.map((area) => (
                    <li
                      key={area.id}
                      className="flex items-center gap-2 text-gray-600"
                    >
                      <MapPin className="size-4 shrink-0 text-gray-400" />
                      {area.city}
                      {area.area_name && ` - ${area.area_name}`}
                      {area.radius_km != null && ` (${area.radius_km}km)`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-gray-500">
                  {provider.profiles?.city
                    ? `Serves ${provider.profiles.city} and surrounding areas.`
                    : 'Contact for service area details.'}
                </p>
              )}
              {provider.profiles?.phone && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-900">Contact</h3>
                  <p className="mt-1 text-gray-600">
                    {provider.profiles.phone}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Request Quote Modal */}
      <Modal
        isOpen={quoteModal}
        onClose={() => setQuoteModal(false)}
        title="Request a Quote"
        size="md"
      >
        {quoteSuccess ? (
          <div className="space-y-4 text-center py-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-success-100 mx-auto">
              <CheckCircle2 className="size-8 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Quote Request Sent!</h3>
            <p className="text-sm text-gray-600">
              {provider.business_name} will review your request and send you a quote. You can track it in{' '}
              <Link to={ROUTES.QUOTES} className="text-primary-600 underline font-medium">My Quotes</Link>.
            </p>
            <Button onClick={() => setQuoteModal(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Describe what you need and your budget. <strong>{provider.business_name}</strong> will respond with a price and timeline.
            </p>
            {quoteError && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{quoteError}</div>
            )}
            <Textarea
              label="What do you need? *"
              value={quoteDescription}
              onChange={(e) => setQuoteDescription(e.target.value)}
              placeholder="e.g. Fix a leaking tap in the kitchen and bathroom..."
              rows={3}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Budget Min (BWP)"
                type="number"
                min="0"
                step="0.01"
                value={quoteBudgetMin}
                onChange={(e) => setQuoteBudgetMin(e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="Budget Max (BWP)"
                type="number"
                min="0"
                step="0.01"
                value={quoteBudgetMax}
                onChange={(e) => setQuoteBudgetMax(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Textarea
              label="Additional message (optional)"
              value={quoteMessage}
              onChange={(e) => setQuoteMessage(e.target.value)}
              placeholder="Any extra details, preferred timing, etc."
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuoteModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitQuote}
                loading={quoteLoading}
                disabled={!quoteDescription.trim()}
                icon={<Send className="size-4" />}
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Report Modal */}
      <Modal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
        title="Report this provider"
        size="sm"
      >
        {reportSuccess ? (
          <div className="space-y-4 text-center py-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-success-100 mx-auto">
              <CheckCircle2 className="size-8 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Report Submitted</h3>
            <p className="text-sm text-gray-600">
              Thank you. Our team will review this report and take appropriate action.
            </p>
            <Button onClick={() => setReportModal(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Help keep QuickConnect safe. Reports are confidential and reviewed by our team.
            </p>
            {reportError && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{reportError}</div>
            )}
            <Select
              label="Reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              options={REPORT_REASONS}
            />
            <Textarea
              label="Additional details (optional)"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Please provide any additional context..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReportModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleSubmitReport}
                loading={reportLoading}
                icon={<Flag className="size-4" />}
              >
                Submit Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
