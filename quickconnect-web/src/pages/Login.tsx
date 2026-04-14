import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, user, loading: authLoading } = useAuth()
  const successMessage = (location.state as { message?: string } | null)?.message

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate(ROUTES.HOME, { replace: true })
    }
  }, [authLoading, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const errs: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) setError(signInError)
    } catch {
      setError('Unable to connect. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div>
          <Link
            to={ROUTES.HOME}
            className="animate-fade-up inline-flex items-center gap-2 text-2xl font-bold text-primary-600"
          >
            <span className="bg-primary-500 px-2 py-0.5 text-white rounded">QC</span>
            {APP_NAME}
          </Link>

          <div className="animate-fade-up mt-10" style={{ animationDelay: '80ms' }}>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-gray-600">Sign in to your account to continue</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="animate-fade-up mt-8 space-y-6"
            style={{ animationDelay: '160ms' }}
          >
            {successMessage && (
              <div className="rounded-lg bg-success-50 p-4 text-sm text-success-600">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">{error}</div>
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
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })) }}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/20 ${fieldErrors.email ? 'border-danger-500 focus:border-danger-500' : 'border-gray-300 focus:border-primary-500'}`}
                  placeholder="you@example.com"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-danger-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })) }}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/20 ${fieldErrors.password ? 'border-danger-500 focus:border-danger-500' : 'border-gray-300 focus:border-primary-500'}`}
                  placeholder="••••••••"
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-danger-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              icon={<ArrowRight className="size-5" />}
            >
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.REGISTER} className="font-medium text-primary-600 hover:text-primary-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
