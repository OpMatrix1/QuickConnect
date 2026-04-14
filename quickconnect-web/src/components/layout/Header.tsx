import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Menu, X, Bell, User, LayoutDashboard, LogOut, ShieldCheck, Wallet,
  Search, Home as HomeIcon, FileText, Users, CalendarCheck, MessageCircle, ClipboardList,
} from 'lucide-react'
import { cn, getInitials, formatRelativeTime } from '@/lib/utils'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import {
  getExistingPushSubscription,
  isWebPushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
} from '@/lib/webPush'

const NAV_TABS = [
  { to: ROUTES.HOME,        icon: HomeIcon,        label: 'Home',        authOnly: false },
  { to: ROUTES.LOOKING_FOR, icon: FileText,         label: 'Looking For', authOnly: false },
  { to: ROUTES.PROVIDERS,   icon: Users,            label: 'Providers',   authOnly: false },
  { to: ROUTES.MY_BOOKINGS, icon: CalendarCheck,    label: 'My Bookings', authOnly: false },
  { to: ROUTES.DASHBOARD,   icon: LayoutDashboard,  label: 'Dashboard',   authOnly: true  },
]

export function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const { notifications, unreadCount, markAllAsRead } = useNotifications()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [webPushOn, setWebPushOn] = useState(false)
  const [webPushBusy, setWebPushBusy] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const refreshWebPushState = useCallback(async () => {
    if (!isWebPushSupported()) {
      setWebPushOn(false)
      return
    }
    const sub = await getExistingPushSubscription()
    setWebPushOn(!!sub && Notification.permission === 'granted')
  }, [])

  useEffect(() => {
    if (user) void refreshWebPushState()
  }, [user, refreshWebPushState])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark all as read as soon as the panel is opened
  useEffect(() => {
    if (notifOpen && unreadCount > 0) {
      markAllAsRead()
    }
  }, [notifOpen, unreadCount, markAllAsRead])

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm h-14">
      <div className="flex h-full items-center max-w-[1600px] mx-auto px-2 sm:px-4 gap-2">

        {/* ── LEFT: Logo + Search ─────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-2 shrink-0"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-500 text-white font-extrabold text-sm select-none">
              QC
            </span>
            <span className="hidden lg:inline font-bold text-primary-600 text-lg tracking-tight">
              {APP_NAME}
            </span>
          </Link>

          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 w-52 focus-within:ring-2 focus-within:ring-primary-500 focus-within:bg-white transition-all"
          >
            <Search className="size-4 text-gray-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search QuickConnect"
              className="flex-1 min-w-0 text-sm text-gray-800 placeholder-gray-500 bg-transparent outline-none"
            />
          </form>
        </div>

        {/* ── CENTER: Nav Tabs ─────────────────────────────── */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
          {NAV_TABS.filter(({ authOnly }) => !authOnly || !!user).map(({ to, icon: Icon, label }) => {
            const isActive = to === ROUTES.HOME
              ? pathname === '/'
              : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 h-12 w-[88px] rounded-lg transition-colors',
                  isActive
                    ? 'text-primary-500'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
                {isActive && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[3px] rounded-t-full bg-primary-500" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── RIGHT: User Controls ─────────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto md:ml-0">
          {user ? (
            <>
              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 flex w-80 max-h-[420px] flex-col rounded-xl border border-gray-200 bg-white shadow-xl z-50">
                    <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</p>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              'px-4 py-3 border-b border-gray-50 last:border-0 transition-colors',
                              !n.is_read ? 'bg-primary-50/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {!n.is_read && (
                                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
                              )}
                              <div className={!n.is_read ? '' : 'pl-4'}>
                                <p className="text-sm font-medium text-gray-900 leading-snug">{n.title}</p>
                                {n.body && (
                                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>
                                )}
                                <p className="mt-1 text-[11px] text-gray-400">{formatRelativeTime(n.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {user && isWebPushSupported() && (
                      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-3 py-2.5">
                        <p className="text-[11px] text-gray-600 leading-snug mb-2">
                          Alerts when you are away (Android &amp; desktop browsers).
                        </p>
                        {webPushOn ? (
                          <button
                            type="button"
                            disabled={webPushBusy}
                            onClick={async () => {
                              setWebPushBusy(true)
                              try {
                                await unsubscribeWebPush()
                                setWebPushOn(false)
                              } finally {
                                setWebPushBusy(false)
                              }
                            }}
                            className="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 disabled:opacity-50"
                          >
                            {webPushBusy ? 'Updating…' : 'Turn off browser alerts'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={webPushBusy}
                            onClick={async () => {
                              if (!user) return
                              setWebPushBusy(true)
                              try {
                                const res = await subscribeWebPush(user.id)
                                if (res.ok) setWebPushOn(true)
                              } finally {
                                setWebPushBusy(false)
                              }
                            }}
                            className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                          >
                            {webPushBusy ? 'Enabling…' : 'Turn on browser alerts'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex size-10 items-center justify-center rounded-full hover:ring-2 hover:ring-gray-300 transition-all"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm">
                      {getInitials(profile?.full_name ?? 'U')}
                    </span>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {profile?.full_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                    </div>
                    <Link
                      to={ROUTES.DASHBOARD}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="size-4 text-gray-400" />
                      Dashboard
                    </Link>
                    <Link
                      to={ROUTES.PROFILE}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="size-4 text-gray-400" />
                      Profile
                    </Link>
                    <Link
                      to={ROUTES.WALLET}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Wallet className="size-4 text-gray-400" />
                      My Wallet
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link
                        to={ROUTES.ADMIN}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ShieldCheck className="size-4 text-gray-400" />
                        Admin
                      </Link>
                    )}
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut className="size-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to={ROUTES.LOGIN}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to={ROUTES.REGISTER}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Join Free
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile overlay ───────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* ── Mobile drawer ────────────────────────────────── */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col gap-1 p-5 pt-16">
          {/* Mobile search */}
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 mb-3"
          >
            <Search className="size-4 text-gray-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-500"
            />
          </form>

          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-2">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="size-12 rounded-full object-cover" />
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
              {NAV_TABS.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Icon className="size-5 text-gray-500" />
                  {label}
                </Link>
              ))}
              <Link to={ROUTES.PROFILE} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                <User className="size-5 text-gray-500" />Profile
              </Link>
              <Link to={ROUTES.WALLET} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                <Wallet className="size-5 text-gray-500" />My Wallet
              </Link>
              <Link to={ROUTES.CHAT} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                <MessageCircle className="size-5 text-gray-500" />Messages
              </Link>
              <Link to={ROUTES.QUOTES} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                <ClipboardList className="size-5 text-gray-500" />My Quotes
              </Link>
              {profile?.role === 'admin' && (
                <Link to={ROUTES.ADMIN} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  <ShieldCheck className="size-5 text-gray-500" />Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-danger-600 hover:bg-danger-50"
              >
                <LogOut className="size-5" />Sign Out
              </button>
            </>
          ) : (
            <>
              {NAV_TABS.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Icon className="size-5 text-gray-500" />
                  {label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4">
                <Link
                  to={ROUTES.LOGIN}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.REGISTER}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-600"
                >
                  Join Free
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
