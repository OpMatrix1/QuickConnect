import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  ThumbsUp,
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
    <div className="bg-white">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center min-h-[560px] px-4 pt-10 pb-16 text-white overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d3326 0%, #1a4a35 40%, #0f3d2e 70%, #0a2a1f 100%)',
        }}
      >
        {/* subtle texture dots */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative w-full max-w-3xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
            Find trusted local services
            <br />
            <span className="text-primary-400">anywhere in Botswana</span>
          </h1>
          <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">
            Post what you need. Get quotes from verified providers. Pick the best — all in one place.
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="mt-8 flex items-center bg-white rounded-full shadow-2xl overflow-hidden max-w-xl mx-auto"
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
              className="m-1.5 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* Popular tags */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-white/60">Popular:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`${ROUTES.PROVIDERS}?category=${encodeURIComponent(tag)}`)}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/85 hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Floating trust pill */}
        <div className="relative mt-10 flex items-center gap-3 rounded-full bg-white/10 border border-white/20 px-5 py-2.5 backdrop-blur-sm">
          <div className="flex -space-x-2">
            {['#1DBF73', '#19a463', '#158753'].map((c, i) => (
              <span
                key={i}
                className="flex size-7 items-center justify-center rounded-full ring-2 ring-white/20 text-white text-xs font-bold"
                style={{ background: c }}
              >
                {String.fromCharCode(65 + i)}
              </span>
            ))}
          </div>
          <div className="text-sm text-white/90">
            <span className="font-semibold">500+ verified providers</span>
            {' '}trusted by Batswana
          </div>
          <div className="flex items-center gap-0.5 text-yellow-400">
            {[...Array(5)].map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
          </div>
        </div>
      </section>

      {/* ── POPULAR CATEGORIES ───────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
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
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SERVICE_CATEGORIES.slice(0, 10).map((category) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            const color = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-50', icon: 'text-gray-600' }
            return (
              <Link
                key={category}
                to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(category)}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
              >
                <span className={`flex size-12 items-center justify-center rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
                  <Icon className="size-6" />
                </span>
                <span className="text-xs font-medium text-gray-700 leading-tight group-hover:text-primary-600 transition-colors">
                  {category}
                </span>
              </Link>
            )
          })}
        </div>

        {/* All categories grid - second row */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SERVICE_CATEGORIES.slice(10).map((category) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            const color = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-50', icon: 'text-gray-600' }
            return (
              <Link
                key={category}
                to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(category)}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
              >
                <span className={`flex size-12 items-center justify-center rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
                  <Icon className="size-6" />
                </span>
                <span className="text-xs font-medium text-gray-700 leading-tight group-hover:text-primary-600 transition-colors">
                  {category}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              How {APP_NAME} works
            </h2>
            <p className="mt-2 text-gray-500">Three easy steps to get the job done</p>
          </div>

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
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl bg-white p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <span className="absolute -top-3 left-6 rounded-full bg-white border border-gray-200 px-3 py-0.5 text-xs font-bold text-gray-400 shadow-sm">
                  STEP {item.step}
                </span>
                <span className={`inline-flex size-12 items-center justify-center rounded-xl ${item.color} mb-4`}>
                  <item.icon className="size-6" />
                </span>
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              to={ROUTES.CREATE_POST}
              className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
            >
              Post What You Need — It's Free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ───────────────────────────────────── */}
      <section className="border-y border-gray-100 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: '500+',  label: 'Verified Providers',    icon: BadgeCheck },
              { value: '1,000+', label: 'Services Completed',   icon: CheckCircle },
              { value: '10',    label: 'Cities in Botswana',    icon: Users },
              { value: '4.8★',  label: 'Average Rating',        icon: ThumbsUp },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center text-center gap-1">
                <stat.icon className="size-6 text-primary-500 mb-1" />
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{stat.value}</p>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY QUICKCONNECT ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Why customers love {APP_NAME}
          </h2>
          <p className="mt-2 text-gray-500 text-sm">
            Built from the ground up for Botswana's service economy
          </p>
        </div>

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
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────── */}
      <section
        className="py-16 text-white text-center"
        style={{
          background: 'linear-gradient(135deg, #0d3326 0%, #1a4a35 50%, #0f3d2e 100%)',
        }}
      >
        <div className="mx-auto max-w-2xl px-4">
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
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/30"
            >
              Create a Free Account
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to={ROUTES.LOOKING_FOR}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              Browse Requests
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
