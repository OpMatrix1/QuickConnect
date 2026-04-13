import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Reveal } from '@/components/ui/Reveal'
import {
  Wrench,
  Zap,
  Sparkles,
  Paintbrush,
  Hammer,
  TreeDeciduous,
  Truck,
  GraduationCap,
  Camera,
  UtensilsCrossed,
  Scissors,
  Car,
  Monitor,
  HardHat,
  Flame,
  Grid3X3,
  Thermometer,
  Shield,
  Calendar,
  Shirt,
  Search,
  Star,
  CheckCircle,
  Users,
  BadgeCheck,
  MessageCircle,
  ArrowRight,
  ChevronRight,
  MapPin,
  X,
} from 'lucide-react'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { SERVICE_CATEGORIES, truncate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Profile, ServiceProvider, Service, ServiceCategory } from '@/lib/types'
import { Avatar, StarRating, Badge, Spinner } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

interface ProviderWithDetails extends ServiceProvider {
  profiles: Profile
  services: (Service & { service_categories: ServiceCategory | null })[]
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Plumbing: Wrench,
  Electrical: Zap,
  Cleaning: Sparkles,
  Painting: Paintbrush,
  Carpentry: Hammer,
  'Gardening & Landscaping': TreeDeciduous,
  'Moving & Transport': Truck,
  'Tutoring & Education': GraduationCap,
  Photography: Camera,
  Catering: UtensilsCrossed,
  'Beauty & Salon': Scissors,
  'Auto Repair & Mechanic': Car,
  'IT & Computer Repair': Monitor,
  Construction: HardHat,
  Welding: Flame,
  Tiling: Grid3X3,
  'Air Conditioning & HVAC': Thermometer,
  'Security Services': Shield,
  'Event Planning': Calendar,
  'Tailoring & Fashion': Shirt,
}

const CATEGORY_COLORS: Record<string, { bg: string; icon: string; selected: string }> = {
  Plumbing:                  { bg: 'bg-blue-50',    icon: 'text-blue-600',    selected: 'bg-blue-100 border-blue-400' },
  Electrical:                { bg: 'bg-yellow-50',  icon: 'text-yellow-600',  selected: 'bg-yellow-100 border-yellow-400' },
  Cleaning:                  { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    selected: 'bg-cyan-100 border-cyan-400' },
  Painting:                  { bg: 'bg-pink-50',    icon: 'text-pink-600',    selected: 'bg-pink-100 border-pink-400' },
  Carpentry:                 { bg: 'bg-orange-50',  icon: 'text-orange-600',  selected: 'bg-orange-100 border-orange-400' },
  'Gardening & Landscaping': { bg: 'bg-green-50',   icon: 'text-green-600',   selected: 'bg-green-100 border-green-400' },
  'Moving & Transport':      { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  selected: 'bg-indigo-100 border-indigo-400' },
  'Tutoring & Education':    { bg: 'bg-violet-50',  icon: 'text-violet-600',  selected: 'bg-violet-100 border-violet-400' },
  Photography:               { bg: 'bg-rose-50',    icon: 'text-rose-600',    selected: 'bg-rose-100 border-rose-400' },
  Catering:                  { bg: 'bg-amber-50',   icon: 'text-amber-600',   selected: 'bg-amber-100 border-amber-400' },
  'Beauty & Salon':          { bg: 'bg-fuchsia-50', icon: 'text-fuchsia-600', selected: 'bg-fuchsia-100 border-fuchsia-400' },
  'Auto Repair & Mechanic':  { bg: 'bg-slate-50',   icon: 'text-slate-600',   selected: 'bg-slate-100 border-slate-400' },
  'IT & Computer Repair':    { bg: 'bg-sky-50',     icon: 'text-sky-600',     selected: 'bg-sky-100 border-sky-400' },
  Construction:              { bg: 'bg-stone-50',   icon: 'text-stone-600',   selected: 'bg-stone-100 border-stone-400' },
  Welding:                   { bg: 'bg-red-50',     icon: 'text-red-600',     selected: 'bg-red-100 border-red-400' },
  Tiling:                    { bg: 'bg-teal-50',    icon: 'text-teal-600',    selected: 'bg-teal-100 border-teal-400' },
  'Air Conditioning & HVAC': { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    selected: 'bg-cyan-100 border-cyan-400' },
  'Security Services':       { bg: 'bg-gray-50',    icon: 'text-gray-600',    selected: 'bg-gray-100 border-gray-400' },
  'Event Planning':          { bg: 'bg-lime-50',    icon: 'text-lime-600',    selected: 'bg-lime-100 border-lime-400' },
  'Tailoring & Fashion':     { bg: 'bg-purple-50',  icon: 'text-purple-600',  selected: 'bg-purple-100 border-purple-400' },
}

const POPULAR_SEARCHES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Painting',
  'Moving & Transport',
  'Photography',
]

export function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryProviders, setCategoryProviders] = useState<ProviderWithDetails[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) navigate(`${ROUTES.PROVIDERS}?q=${encodeURIComponent(q)}`)
  }

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null)
      setCategoryProviders([])
      return
    }
    setSelectedCategory(category)
  }

  useEffect(() => {
    if (!selectedCategory) return

    let cancelled = false
    setLoadingProviders(true)
    setCategoryProviders([])

    supabase
      .from('service_providers')
      .select(
        `*, profiles(*), services(id, title, price_min, price_max, price_type, service_categories(name))`
      )
      .order('rating_avg', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        const all = (data ?? []) as unknown as ProviderWithDetails[]
        const filtered = all.filter((p) =>
          p.services?.some(
            (s) => s.service_categories?.name?.toLowerCase() === selectedCategory.toLowerCase()
          )
        )
        setCategoryProviders(filtered.slice(0, 6))
        setLoadingProviders(false)
      })

    return () => { cancelled = true }
  }, [selectedCategory])

  return (
    <div>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center min-h-[560px] px-4 pt-10 pb-16 text-white overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1c0770 0%, #261cc1 100%)',
        }}
      >

        <div className="relative w-full max-w-3xl text-center">
          <h1
            className="animate-fade-up text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          >
            Find trusted local services
            <br />
            <span className="text-highlight-300">anywhere in Botswana</span>
          </h1>
          <p
            className="animate-fade-up mt-4 max-w-xl mx-auto text-lg text-white/70"
            style={{ animationDelay: '150ms' }}
          >
            Post what you need. Get quotes from verified providers. Pick the best — all in one place.
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="animate-fade-up mt-8 flex items-center bg-white rounded-full shadow-2xl overflow-hidden max-w-xl mx-auto"
            style={{ animationDelay: '300ms' }}
          >
            <div className="flex items-center gap-2 flex-1 px-5 py-1">
              <Search className="size-5 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What service are you looking for?"
                className="flex-1 py-2.5 text-gray-800 text-sm placeholder-gray-400 outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              className="press-feedback m-1.5 rounded-full bg-highlight-300 px-6 py-2.5 text-sm font-semibold text-primary-900 hover:bg-highlight-400 transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* Popular tags */}
          <div
            className="animate-fade-up mt-5 flex flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: '450ms' }}
          >
            <span className="text-sm text-white/60">Popular:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`${ROUTES.PROVIDERS}?category=${encodeURIComponent(tag)}`)}
                className="press-feedback rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/85 hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

      </section>

      {/* ── POPULAR CATEGORIES ───────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Popular Categories</h2>
            <p className="mt-1 text-gray-500 text-sm">
              Browse all {SERVICE_CATEGORIES.length} service types available across Botswana
            </p>
          </div>
          <Link
            to={ROUTES.PROVIDERS}
            className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            See all <ChevronRight className="size-4" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SERVICE_CATEGORIES.map((category, i) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            const c = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-50', icon: 'text-gray-600', selected: 'bg-gray-100 border-gray-400' }
            const isSelected = selectedCategory === category
            return (
              <Reveal key={category} delay={i * 40}>
                <button
                  onClick={() => handleCategoryClick(category)}
                  className={`press-feedback group w-full flex flex-col items-center gap-3 rounded-2xl border p-5 text-center shadow-sm transition-all duration-200 ${
                    isSelected
                      ? `${c.selected} shadow-md -translate-y-1`
                      : 'border-gray-100 bg-white hover:shadow-md hover:border-primary-200 hover:-translate-y-1'
                  }`}
                >
                  <span className={`flex size-12 items-center justify-center rounded-xl ${c.bg} ${c.icon} group-hover:scale-110 transition-transform`}>
                    <Icon className="size-6" />
                  </span>
                  <span className={`text-xs font-medium leading-tight transition-colors ${isSelected ? 'text-gray-900 font-semibold' : 'text-gray-700 group-hover:text-primary-600'}`}>
                    {category}
                  </span>
                </button>
              </Reveal>
            )
          })}
        </div>

        {/* ── PROVIDERS IN SELECTED CATEGORY ─────────────── */}
        {selectedCategory && (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-6 animate-slide-down">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedCategory} Providers
                </h3>
                {!loadingProviders && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {categoryProviders.length === 0
                      ? 'No providers found in this category yet'
                      : `Showing top ${categoryProviders.length} providers`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(selectedCategory)}`}
                  className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  See all <ChevronRight className="size-4" />
                </Link>
                <button
                  onClick={() => { setSelectedCategory(null); setCategoryProviders([]) }}
                  className="flex items-center justify-center size-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {loadingProviders ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : categoryProviders.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 text-sm">No providers available in this category yet.</p>
                <Link
                  to={ROUTES.REGISTER}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Be the first to offer {selectedCategory} <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryProviders.map((provider) => (
                  <Link
                    key={provider.id}
                    to={ROUTES.PROVIDER_PROFILE.replace(':id', provider.id)}
                    className="press-feedback flex gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <Avatar
                      src={provider.profiles?.avatar_url}
                      fallback={provider.business_name}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {provider.business_name}
                        </p>
                        {provider.is_verified && (
                          <Badge variant="success" className="shrink-0 text-xs">✓</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StarRating rating={provider.rating_avg} size="sm" readonly />
                        <span className="text-xs text-gray-500">({provider.review_count})</span>
                      </div>
                      {provider.profiles?.city && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="size-3 shrink-0" />
                          {provider.profiles.city}
                        </div>
                      )}
                      {provider.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                          {truncate(provider.description, 80)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="bg-primary-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              How {APP_NAME} works
            </h2>
            <p className="mt-2 text-gray-500">Three easy steps to get the job done</p>
          </Reveal>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Post Your Need',
                description:
                  'Describe the service you need — set your budget, city, and urgency. It only takes a minute.',
                icon: Search,
                color: 'bg-primary-50 text-primary-600',
              },
              {
                step: '02',
                title: 'Get Quotes',
                description:
                  'Verified local providers will send you competitive quotes. Compare reviews, prices, and availability.',
                icon: MessageCircle,
                color: 'bg-blue-50 text-blue-600',
              },
              {
                step: '03',
                title: 'Pick & Book',
                description:
                  'Choose the best fit, book instantly, chat in real time, and pay securely with mobile money.',
                icon: CheckCircle,
                color: 'bg-violet-50 text-violet-600',
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 150} animation="scale">
                <div className="relative h-full rounded-2xl bg-white p-8 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                  <span className="absolute -top-3 left-6 rounded-full bg-white border border-gray-200 px-3 py-0.5 text-xs font-bold text-gray-400 shadow-sm">
                    STEP {item.step}
                  </span>
                  <span className={`inline-flex size-12 items-center justify-center rounded-xl ${item.color} mb-4`}>
                    <item.icon className="size-6" />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10 text-center" delay={200}>
            <Link
              to={ROUTES.CREATE_POST}
              className="press-feedback inline-flex items-center gap-2 rounded-full bg-highlight-300 px-8 py-3 text-sm font-semibold text-primary-900 hover:bg-highlight-400 transition-colors shadow-lg shadow-primary-500/25"
            >
              Post What You Need — It's Free
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>


      {/* ── WHY QUICKCONNECT ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Why customers love {APP_NAME}
          </h2>
          <p className="mt-2 text-gray-500 text-sm">
            Built from the ground up for Botswana's service economy
          </p>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: BadgeCheck,
              title: 'Verified Providers',
              description:
                'Every provider is vetted and reviewed. You see real ratings from real customers before you book.',
              color: 'text-primary-500 bg-primary-50',
            },
            {
              icon: Shield,
              title: 'Secure Mobile Payments',
              description:
                'Pay with confidence using Orange Money, BTC MyZaka, or Mascom MyZaka. Your money is protected.',
              color: 'text-blue-500 bg-blue-50',
            },
            {
              icon: MessageCircle,
              title: 'Real-time Messaging',
              description:
                'Chat directly with providers before and after booking. No phone tag, no guessing.',
              color: 'text-violet-500 bg-violet-50',
            },
            {
              icon: Search,
              title: '"Looking For" Requests',
              description:
                'Post your needs and let providers come to you with competitive quotes — it\'s like an RFP for everyday services.',
              color: 'text-amber-500 bg-amber-50',
            },
            {
              icon: Star,
              title: 'Honest Reviews',
              description:
                'Star ratings and detailed reviews help you find the best provider every time.',
              color: 'text-yellow-500 bg-yellow-50',
            },
            {
              icon: Users,
              title: 'Local Expertise',
              description:
                'Providers are based in your city — Gaborone, Francistown, Maun, and more. Fast, local, reliable.',
              color: 'text-rose-500 bg-rose-50',
            },
          ].map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                  <feature.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────── */}
      <section
        className="py-16 text-white text-center"
        style={{
          background: 'linear-gradient(160deg, #1c0770 0%, #261cc1 100%)',
        }}
      >
        <Reveal className="mx-auto max-w-2xl px-4">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-white/70 text-sm leading-relaxed">
            Join thousands of Batswana who trust {APP_NAME} for their service needs.
            Signing up is 100% free.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {!user && (
              <Link
                to={ROUTES.REGISTER}
                className="press-feedback inline-flex items-center justify-center gap-2 rounded-full bg-highlight-300 px-8 py-3 text-sm font-semibold text-primary-900 hover:bg-highlight-400 transition-colors shadow-lg shadow-highlight-300/30"
              >
                Create a Free Account
                <ArrowRight className="size-4" />
              </Link>
            )}
            <Link
              to={ROUTES.LOOKING_FOR}
              className="press-feedback inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              Browse Requests
            </Link>
          </div>
        </Reveal>
      </section>

    </div>
  )
}
