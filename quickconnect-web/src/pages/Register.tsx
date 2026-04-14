import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Phone, MapPin, Building2, Info } from 'lucide-react'
import { cn, CITIES } from '@/lib/utils'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { PROVIDER_SIGNUP_LISTING_NOTICE } from '@/lib/providerListing'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

type Role = 'customer' | 'provider'

export function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [role, setRole] = useState<Role>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters')
      return
    }

    if (phone) {
      const cleaned = phone.replace(/[\s()+-]/g, '')
      // Accept 8-digit local numbers or with +267 prefix (total 11 digits with country code)
      if (!/^(267)?[0-9]{8}$/.test(cleaned)) {
        setError('Enter a valid Botswana phone number (e.g. 71 234 567 or +267 71 234 567)')
        return
      }
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!termsAccepted) {
      setError('You must accept the terms and conditions')
      return
    }

    setSubmitting(true)
    try {
      const { error: signUpError } = await signUp(email, password, fullName, role, businessName || undefined)
      if (signUpError) {
        setError(signUpError)
        return
      }
    } catch (err) {
      setError('Unable to connect. Please check your internet and try again.')
      return
    } finally {
      setSubmitting(false)
    }

    navigate(ROUTES.LOGIN, { state: { message: 'Account created! Please check your email to verify your account before signing in.' } })
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        to={ROUTES.HOME}
        className="animate-fade-up inline-flex items-center gap-2 text-2xl font-bold text-primary-600"
      >
        <span className="bg-primary-500 px-2 py-0.5 text-white rounded">QC</span>
        {APP_NAME}
      </Link>

      <div className="animate-fade-up mt-10" style={{ animationDelay: '80ms' }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-2 text-gray-600">
          Join QuickConnect to find or offer services in Botswana
        </p>
      </div>

      {/* Role selection */}
      <div className="animate-fade-up mt-6 flex rounded-lg border border-gray-200 p-1" style={{ animationDelay: '160ms' }}>
        <button
          type="button"
          onClick={() => setRole('customer')}
          className={cn(
            'flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors',
            role === 'customer'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          Customer
        </button>
        <button
          type="button"
          onClick={() => setRole('provider')}
          className={cn(
            'flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors',
            role === 'provider'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          Service Provider
        </button>
      </div>

      {role === 'provider' && (
        <div
          className="animate-fade-up mt-6 rounded-lg border border-primary-200 bg-primary-50/90 p-4 text-sm text-primary-900"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex gap-3">
            <Info className="size-5 shrink-0 text-primary-600" aria-hidden />
            <p className="leading-relaxed">{PROVIDER_SIGNUP_LISTING_NOTICE}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="animate-fade-up mt-8 space-y-5" style={{ animationDelay: '240ms' }}>
        {error && (
          <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Full Name *
          </label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="John Doe"
            />
          </div>
        </div>

        {role === 'provider' && (
          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
              Business Name
            </label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="ABC Plumbing Services"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email *
          </label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone (optional)
          </label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="+267 7X XXX XXXX"
            />
          </div>
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700">
            City (optional)
          </label>
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <select
              id="city"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="block w-full appearance-none rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Select a city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password *
          </label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="••••••••"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">At least 6 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password *
          </label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="••••••••"
            />
          </div>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 size-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">
            I accept the{' '}
            <a href="#" className="font-medium text-primary-600 hover:text-primary-700">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="font-medium text-primary-600 hover:text-primary-700">
              Privacy Policy
            </a>
          </span>
        </label>

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
