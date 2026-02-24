import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, Bell, User, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'

export function Header() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    setMobileOpen(false)
    navigate(ROUTES.HOME)
  }

  const navLinks = [
    { to: ROUTES.LOOKING_FOR, label: 'Looking For' },
    { to: ROUTES.PROVIDERS, label: 'Providers' },
    { to: ROUTES.MY_BOOKINGS, label: 'My Bookings' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-2 text-xl font-bold text-primary-600 hover:text-primary-700"
        >
          <span className="bg-primary-500 px-2 py-0.5 text-white rounded">QC</span>
          {APP_NAME}
        </Link>

        {/* Center nav - desktop, logged in only */}
        <div className="hidden md:flex md:items-center md:gap-6">
          {user &&
            navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Notification bell */}
              <Link
                to={ROUTES.CHAT}
                className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-primary-600 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 transition-colors"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold">
                      {getInitials(profile?.full_name ?? 'U')}
                    </span>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <Link
                      to={ROUTES.DASHBOARD}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="size-4" />
                      Dashboard
                    </Link>
                    <Link
                      to={ROUTES.PROFILE}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="size-4" />
                      Profile
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link
                        to={ROUTES.ADMIN}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ShieldCheck className="size-4" />
                        Admin
                      </Link>
                    )}
                    <hr className="my-1 border-gray-200" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut className="size-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden md:flex md:items-center md:gap-2">
              <Link
                to={ROUTES.LOGIN}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Login
              </Link>
              <Link
                to={ROUTES.REGISTER}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile slide-out drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col gap-4 p-6 pt-20">
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-lg font-semibold">
                    {getInitials(profile?.full_name ?? 'U')}
                  </span>
                )}
                <div>
                  <p className="font-medium text-gray-900">{profile?.full_name}</p>
                  <p className="text-sm text-gray-500">{profile?.role}</p>
                </div>
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={ROUTES.DASHBOARD}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
              >
                Dashboard
              </Link>
              <Link
                to={ROUTES.PROFILE}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
              >
                Profile
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  to={ROUTES.ADMIN}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="mt-auto rounded-lg px-4 py-3 text-left text-danger-600 hover:bg-danger-50"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to={ROUTES.LOGIN}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
              >
                Login
              </Link>
              <Link
                to={ROUTES.REGISTER}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-primary-500 px-4 py-3 text-center font-medium text-white hover:bg-primary-600"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
