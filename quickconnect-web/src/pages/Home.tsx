import { Link } from 'react-router-dom'
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
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  FileText,
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

export function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600 px-6 py-20 sm:px-12 sm:py-28 lg:px-16 lg:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-60" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Find Trusted Local Services in Botswana
          </h1>
          <p className="mt-6 text-lg text-white/90 sm:text-xl">
            Post what you need with our &ldquo;Looking For&rdquo; feature. Get quotes from verified providers, compare, and pick the best—all in one place.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              to={ROUTES.CREATE_POST}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-primary-600 shadow-lg hover:bg-white/95 transition-colors"
            >
              Post What You Need
              <ArrowRight className="size-5" />
            </Link>
            <Link
              to={ROUTES.PROVIDERS}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/80 bg-white/10 px-6 py-4 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
            >
              Browse Providers
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mt-24">
        <h2 className="text-center text-3xl font-bold text-gray-900 sm:text-4xl">
          How It Works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
          Three simple steps to connect with the best service providers in your area
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: 1,
              title: 'Post Your Need',
              description: 'Describe what you need—plumbing, electrical, cleaning, or any service. Set your budget and location.',
              icon: FileText,
            },
            {
              step: 2,
              title: 'Get Quotes',
              description: 'Verified providers in your area will send you quotes. Compare prices, ratings, and availability.',
              icon: MessageSquare,
            },
            {
              step: 3,
              title: 'Pick the Best',
              description: 'Choose the provider that fits your needs. Book, chat, and get the job done.',
              icon: CheckCircle2,
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="absolute -top-4 left-8 flex size-10 items-center justify-center rounded-full bg-primary-500 text-lg font-bold text-white">
                {item.step}
              </span>
              <div className="mt-4">
                <item.icon className="size-12 text-primary-500" />
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-gray-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Categories */}
      <section className="mt-24">
        <h2 className="text-center text-3xl font-bold text-gray-900 sm:text-4xl">
          Popular Categories
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
          From plumbing to photography—find the right service for every need
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SERVICE_CATEGORIES.slice(0, 10).map((category) => {
            const Icon = CATEGORY_ICONS[category] ?? Wrench
            return (
              <Link
                key={category}
                to={`${ROUTES.PROVIDERS}?category=${encodeURIComponent(category)}`}
                className="group flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md hover:bg-primary-50/30"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-primary-100 text-primary-600 group-hover:bg-primary-200 transition-colors">
                  <Icon className="size-7" />
                </span>
                <span className="mt-3 text-center text-sm font-medium text-gray-700 group-hover:text-primary-600">
                  {category}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="mt-24 rounded-2xl bg-gray-50 px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { value: '500+', label: 'Providers' },
            { value: '1000+', label: 'Services Completed' },
            { value: '20+', label: 'Cities' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-bold text-primary-600 sm:text-5xl">{stat.value}</p>
              <p className="mt-1 text-lg font-medium text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="mt-24">
        <h2 className="text-center text-3xl font-bold text-gray-900 sm:text-4xl">
          Why Choose {APP_NAME}
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              title: 'Verified Providers',
              description: 'All providers are vetted for quality and reliability.',
              icon: Shield,
            },
            {
              title: 'Secure Payments',
              description: 'Pay safely with Orange Money, BTC MyZaka, and Mascom MyZaka.',
              icon: CheckCircle2,
            },
            {
              title: 'Real-time Chat',
              description: 'Communicate directly with providers before and after booking.',
              icon: MessageSquare,
            },
          ].map((badge) => (
            <div
              key={badge.title}
              className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-success-50 text-success-600">
                <badge.icon className="size-8" />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">{badge.title}</h3>
              <p className="mt-2 text-gray-600">{badge.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-24 rounded-2xl bg-primary-500 px-6 py-16 text-center sm:px-12">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Ready to get started?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/90">
          Join thousands of Batswana who trust QuickConnect for their service needs.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            to={ROUTES.REGISTER}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-primary-600 hover:bg-white/95 transition-colors"
          >
            Create Free Account
            <ArrowRight className="size-5" />
          </Link>
          <Link
            to={ROUTES.LOOKING_FOR}
            className="inline-flex items-center justify-center rounded-xl border-2 border-white/80 px-6 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Browse Looking For Posts
          </Link>
        </div>
      </section>
    </div>
  )
}
