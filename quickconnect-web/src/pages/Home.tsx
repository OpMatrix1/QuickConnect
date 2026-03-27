import { useState } from 'react'
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
} from 'lucide-react'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { SERVICE_CATEGORIES } from '@/lib/utils'

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

const CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  Plumbing:                  { bg: 'bg-blue-50',   icon: 'text-blue-600' },
  Electrical:                { bg: 'bg-yellow-50', icon: 'text-yellow-600' },
  Cleaning:                  { bg: 'bg-cyan-50',   icon: 'text-cyan-600' },
  Painting:                  { bg: 'bg-pink-50',   icon: 'text-pink-600' },
  Carpentry:                 { bg: 'bg-orange-50', icon: 'text-orange-600' },
  'Gardening & Landscaping': { bg: 'bg-green-50',  icon: 'text-green-600' },
  'Moving & Transport':      { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
  'Tutoring & Education':    { bg: 'bg-violet-50', icon: 'text-violet-600' },
  Photography:               { bg: 'bg-rose-50',   icon: 'text-rose-600' },
  Catering:                  { bg: 'bg-amber-50',  icon: 'text-amber-600' },
  'Beauty & Salon':          { bg: 'bg-fuchsia-50',icon: 'text-fuchsia-600' },
  'Auto Repair & Mechanic':  { bg: 'bg-slate-50',  icon: 'text-slate-600' },
  'IT & Computer Repair':    { bg: 'bg-sky-50',    icon: 'text-sky-600' },
  Construction:              { bg: 'bg-stone-50',  icon: 'text-stone-600' },
  Welding:                   { bg: 'bg-red-50',    icon: 'text-red-600' },
  Tiling:                    { bg: 'bg-teal-50',   icon: 'text-teal-600' },
  'Air Conditioning & HVAC': { bg: 'bg-cyan-50',   icon: 'text-cyan-600' },
  'Security Services':       { bg: 'bg-gray-50',   icon: 'text-gray-600' },
  'Event Planning':          { bg: 'bg-lime-50',   icon: 'text-lime-600' },
  'Tailoring & Fashion':     { bg: 'bg-purple-50', icon: 'text-purple-600' },
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
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) navigate(`${ROUTES.PROVIDERS}?q=${encodeURIComponent(q)}`)
  }

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
              Browse all 20 service types available across Botswana
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
          {SERVICE_CATEGORIES.slice(0, 10).map((category, i) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            const color = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-50', icon: 'text-gray-600' }
            return (
              <Reveal key={category} delay={i * 55}>
                <Link
                  to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(category)}`}
                  className="press-feedback group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm hover:shadow-md hover:border-primary-200 hover:-translate-y-1 transition-all duration-200"
                >
                  <span className={`flex size-12 items-center justify-center rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
                    <Icon className="size-6" />
                  </span>
                  <span className="text-xs font-medium text-gray-700 leading-tight group-hover:text-primary-600 transition-colors">
                    {category}
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </div>

        {/* All categories grid - second row */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SERVICE_CATEGORIES.slice(10).map((category, i) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            const color = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-50', icon: 'text-gray-600' }
            return (
              <Reveal key={category} delay={i * 55}>
                <Link
                  to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(category)}`}
                  className="press-feedback group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm hover:shadow-md hover:border-primary-200 hover:-translate-y-1 transition-all duration-200"
                >
                  <span className={`flex size-12 items-center justify-center rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
                    <Icon className="size-6" />
                  </span>
                  <span className="text-xs font-medium text-gray-700 leading-tight group-hover:text-primary-600 transition-colors">
                    {category}
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </div>
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
            <Link
              to={ROUTES.REGISTER}
              className="press-feedback inline-flex items-center justify-center gap-2 rounded-full bg-highlight-300 px-8 py-3 text-sm font-semibold text-primary-900 hover:bg-highlight-400 transition-colors shadow-lg shadow-highlight-300/30"
            >
              Create a Free Account
              <ArrowRight className="size-4" />
            </Link>
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
