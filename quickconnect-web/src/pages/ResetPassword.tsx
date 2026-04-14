import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

export function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword, signOut, session, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!session) {
      setError('Recovery link is invalid or expired. Request a new password reset email.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const { error: updatePasswordError } = await updatePassword(password)
      if (updatePasswordError) {
        setError(updatePasswordError)
        return
      }

      // Recovery flow creates a session so updateUser can run; clear it so the user must sign in with the new password.
      await signOut()

      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { message: 'Password updated successfully. You can sign in now.' },
      })
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
            Set a new password
          </h1>
          <p className="mt-2 text-gray-600">
            Enter and confirm your new password to finish recovery.
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
          {!authLoading && !session && !error && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              Recovery link is missing or expired. Request a new one from the forgot password page.
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!session}>
            Update password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Need a new link?{' '}
          <Link to={ROUTES.FORGOT_PASSWORD} className="font-medium text-primary-600 hover:text-primary-700">
            Reset password
          </Link>
        </p>
      </div>
    </div>
  )
}
