import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Bell, User, LayoutDashboard, LogOut, ShieldCheck, Search, Wallet } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'

export function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isHome = pathname === '/'

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`${ROUTES.PROVIDERS}?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { to: ROUTES.LOOKING_FOR, label: 'Looking For' },
    { to: ROUTES.PROVIDERS, label: 'Providers' },
    { to: ROUTES.MY_BOOKINGS, label: 'My Bookings' },
  ]

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        isHome
          ? 'bg-transparent border-b border-white/20 text-white'
          : 'bg-white border-b border-gray-200 text-gray-800 shadow-sm'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          to={ROUTES.HOME}
          className={cn(
            'flex items-center gap-2 shrink-0 font-bold text-lg tracking-tight',
            isHome ? 'text-white' : 'text-gray-900'
          )}
        >
          <span className="flex items-center justify-center size-8 rounded bg-primary-500 text-white font-extrabold text-sm">
            QC
          </span>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        {/* Search bar — hidden on home (hero has its own) */}
        {!isHome && (
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-lg items-center rounded-full border border-gray-300 bg-white overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What service are you looking for?"
              className="flex-1 px-4 py-2 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
            />
            <button
              type="submit"
              className="flex items-center justify-center w-10 h-10 bg-primary-500 text-white hover:bg-primary-600 transition-colors rounded-full m-0.5"
              aria-label="Search"
            >
              <Search className="size-4" />
            </button>
          </form>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user ? (
            <>
              {/* Notification bell */}
              <Link
                to={ROUTES.CHAT}
                className={cn(
                  'relative rounded-full p-2 transition-colors',
                  isHome
                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )}
                aria-label="Messages"
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
                  className={cn(
                    'flex items-center gap-2 rounded-full p-1 transition-colors',
                    isHome ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  )}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="size-9 rounded-full object-cover ring-2 ring-primary-500/30"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm">
                      {getInitials(profile?.full_name ?? 'U')}
                    </span>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {profile?.full_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                    </div>
                    <Link
                      to={ROUTES.DASHBOARD}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="size-4 text-gray-400" />
                      Dashboard
                    </Link>
                    <Link
                      to={ROUTES.PROFILE}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="size-4 text-gray-400" />
                      Profile
                    </Link>
                    <Link
                      to={ROUTES.WALLET}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Wallet className="size-4 text-gray-400" />
                      My Wallet
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link
                        to={ROUTES.ADMIN}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ShieldCheck className="size-4 text-gray-400" />
                        Admin
                      </Link>
                    )}
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50"
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
              {!isHome && navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2 py-1 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={ROUTES.LOGIN}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  isHome
                    ? 'text-white border border-white/60 hover:bg-white/10'
                    : 'text-gray-700 hover:text-gray-900'
                )}
              >
                Sign In
              </Link>
              <Link
                to={ROUTES.REGISTER}
                className="rounded-md bg-primary-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Join
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              'rounded-lg p-2 transition-colors md:hidden',
              isHome
                ? 'text-white hover:bg-white/10'
                : 'text-gray-600 hover:bg-gray-100'
            )}
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
        <div className="flex flex-col gap-1 p-6 pt-20">
          {/* Mobile search */}
          <form onSubmit={handleSearch} className="flex items-center rounded-lg border border-gray-300 overflow-hidden mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
            />
            <button type="submit" className="p-2 bg-primary-500 text-white">
              <Search className="size-4" />
            </button>
          </form>

          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-2">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary-500 text-white text-lg font-semibold">
                    {getInitials(profile?.full_name ?? 'U')}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                </div>
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={ROUTES.DASHBOARD}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Dashboard
              </Link>
              <Link
                to={ROUTES.PROFILE}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Profile
              </Link>
              <Link
                to={ROUTES.WALLET}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                My Wallet
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  to={ROUTES.ADMIN}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="mt-4 rounded-lg px-4 py-3 text-left text-sm font-medium text-danger-600 hover:bg-danger-50"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4">
                <Link
                  to={ROUTES.LOGIN}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.REGISTER}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-600"
                >
                  Join — It's Free
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
