import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

const RESEND_COOLDOWN_SEC = 30

export function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)

  useEffect(() => {
    if (cooldownSec === 0) return
    const t = window.setTimeout(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearTimeout(t)
  }, [cooldownSec])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }

    setSubmitting(true)
    try {
      const { error: forgotPasswordError } = await forgotPassword(email.trim())
      if (forgotPasswordError) {
        setError(forgotPasswordError)
        return
      }
      setSuccess(true)
      setCooldownSec(RESEND_COOLDOWN_SEC)
    } catch {
      setError('Unable to connect. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          to={ROUTES.HOME}
          className="animate-fade-up inline-flex items-center gap-2 text-2xl font-bold text-primary-600"
        >
          <span className="rounded bg-primary-500 px-2 py-0.5 text-white">QC</span>
          {APP_NAME}
        </Link>

        <div className="animate-fade-up mt-10" style={{ animationDelay: '80ms' }}>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Forgot your password?
          </h1>
          <p className="mt-2 text-gray-600">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="animate-fade-up mt-8 space-y-6"
          style={{ animationDelay: '160ms' }}
        >
          {error && (
            <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-success-50 p-4 text-sm text-success-600">
              <p className="font-medium">Password reset link sent.</p>
              <p className="mt-2 text-success-700">
                Check your inbox and, if you don&apos;t see it in a minute, look in spam or junk.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={submitting}
            disabled={cooldownSec > 0}
          >
            {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
