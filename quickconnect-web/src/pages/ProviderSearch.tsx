import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Reveal } from '@/components/ui/Reveal'
import {
  Search,
  SlidersHorizontal,
  MapPin,
  ChevronRight,
  AlertCircle,
  Wrench,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/constants'
import { truncate, SERVICE_CATEGORIES, CITIES } from '@/lib/utils'
import type { Profile, ServiceProvider, Service, ServiceCategory } from '@/lib/types'
import {
  Button,
  Input,
  Card,
  Badge,
  Avatar,
  StarRating,
  Select,
  Spinner,
  EmptyState,
} from '@/components/ui'

interface ProviderWithDetails extends ServiceProvider {
  profiles: Profile
  services: (Service & { service_categories: ServiceCategory | null })[]
}

const MIN_RATINGS = [
  { value: '', label: 'Any rating' },
  { value: '4', label: '4+ stars' },
  { value: '4.5', label: '4.5+ stars' },
]

const PRICE_RANGES = [
  { value: '', label: 'Any price' },
  { value: '0-100', label: 'Under P100' },
  { value: '100-500', label: 'P100 - P500' },
  { value: '500-1000', label: 'P500 - P1,000' },
  { value: '1000-5000', label: 'P1,000 - P5,000' },
  { value: '5000-', label: 'P5,000+' },
]

export function ProviderSearch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') ?? ''

  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [city, setCity] = useState('')
  const [minRating, setMinRating] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [providers, setProviders] = useState<ProviderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('service_providers')
        .select(
          `
          *,
          profiles(*),
          services(
            id,
            title,
            price_min,
            price_max,
            price_type,
            service_categories(name)
          )
        `
        )

      // Text search on business_name or description
      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`
        query = query.or(`business_name.ilike.${term},description.ilike.${term}`)
      }

      // Min rating filter
      if (minRating) {
        const min = parseFloat(minRating)
        query = query.gte('rating_avg', min)
      }

      const { data, error: fetchError } = await query.order('rating_avg', {
        ascending: false,
      })

      if (fetchError) throw fetchError

      let results = (data ?? []) as unknown as ProviderWithDetails[]

      // Client-side filters (category, city, price) - Supabase nested filter is limited
      if (category) {
        results = results.filter((p) =>
          p.services?.some(
            (s) =>
              s.service_categories?.name?.toLowerCase() === category.toLowerCase()
          )
        )
      }
      if (city) {
        results = results.filter(
          (p) => p.profiles?.city?.toLowerCase() === city.toLowerCase()
        )
      }
      if (priceRange) {
        const [minStr, maxStr] = priceRange.split('-')
        const minPrice = minStr ? parseInt(minStr, 10) : 0
        const maxPrice = maxStr ? parseInt(maxStr, 10) : Infinity
        results = results.filter((p) => {
          const prices = p.services?.flatMap((s) => [
            s.price_min ?? 0,
            s.price_max ?? 0,
          ]) ?? []
          const hasMatch = prices.some(
            (pr) => pr >= minPrice && (maxPrice === Infinity || pr <= maxPrice)
          )
          return hasMatch || prices.length === 0
        })
      }

      setProviders(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers')
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, category, city, minRating, priceRange])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory)
  }, [initialCategory])

  const handleProviderClick = (providerId: string) => {
    navigate(ROUTES.PROVIDER_PROFILE.replace(':id', providerId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Find Service Providers
        </h1>
        <p className="mt-1 text-gray-600">
          Browse verified providers across Botswana
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by business name or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              onKeyDown={(e) => e.key === 'Enter' && fetchProviders()}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              icon={<SlidersHorizontal className="size-4" />}
            >
              Filters
            </Button>
            <Button onClick={fetchProviders}>Search</Button>
          </div>
        </div>

        {showFilters && (
          <Card className="animate-slide-down border-primary-100 bg-primary-50/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Select
                label="Category"
                options={[
                  { value: '', label: 'All categories' },
                  ...SERVICE_CATEGORIES.map((c) => ({ value: c, label: c })),
                ]}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Select
                label="City"
                options={[
                  { value: '', label: 'All cities' },
                  ...CITIES.map((c) => ({ value: c, label: c })),
                ]}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Select
                label="Min Rating"
                options={MIN_RATINGS}
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              />
              <Select
                label="Price Range"
                options={PRICE_RANGES}
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
              />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCategory('')
                    setCity('')
                    setMinRating('')
                    setPriceRange('')
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="size-12 text-danger-500" />}
          title="Something went wrong"
          description={error}
          action={
            <Button variant="outline" onClick={fetchProviders}>
              Try again
            </Button>
          }
        />
      ) : providers.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-12 text-gray-400" />}
          title="No providers found"
          description="Try adjusting your search or filters to find more results."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setCategory('')
                setCity('')
                setMinRating('')
                setPriceRange('')
                fetchProviders()
              }}
            >
              Clear all
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider, i) => (
            <Reveal key={provider.id} delay={i * 60} animation="scale">
            <Card
              hover
              padding="none"
              onClick={() => handleProviderClick(provider.id)}
              className="card-hover-lift h-full overflow-hidden"
            >
              <div className="p-5">
                <div className="flex gap-4">
                  <Avatar
                    src={provider.profiles?.avatar_url}
                    fallback={provider.business_name}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {provider.business_name}
                      </h3>
                      {provider.is_verified && (
                        <Badge variant="success" className="shrink-0">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <StarRating rating={provider.rating_avg} size="sm" readonly />
                      <span>({provider.review_count} reviews)</span>
                    </div>
                    {provider.profiles?.city && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="size-4 shrink-0" />
                        {provider.profiles.city}
                      </div>
                    )}
                  </div>
                </div>
                {provider.description && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                    {truncate(provider.description, 120)}
                  </p>
                )}
                {provider.services && provider.services.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {provider.services.slice(0, 3).map((s) => (
                      <Badge key={s.id} variant="default" className="text-xs">
                        {s.service_categories?.name ?? s.title}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                <span className="text-sm text-gray-600">View profile</span>
                <ChevronRight className="size-5 text-gray-400" />
              </div>
            </Card>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
