import { Link, useLocation } from 'react-router-dom'
import {
  Home as HomeIcon, FileText, Users, CalendarCheck,
  Wallet, User, LayoutDashboard, ShieldCheck, MessageCircle,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'

const NAV_ITEMS = [
  { to: ROUTES.HOME,        icon: HomeIcon,       label: 'Home',             always: true },
  { to: ROUTES.LOOKING_FOR, icon: FileText,        label: 'Looking For',      always: true },
  { to: ROUTES.PROVIDERS,   icon: Users,           label: 'Browse Providers', always: true },
  { to: ROUTES.MY_BOOKINGS, icon: CalendarCheck,   label: 'My Bookings',      always: false },
  { to: ROUTES.CHAT,        icon: MessageCircle,   label: 'Messages',         always: false },
  { to: ROUTES.WALLET,      icon: Wallet,          label: 'Wallet',           always: false },
  { to: ROUTES.PROFILE,     icon: User,            label: 'Profile',          always: false },
  { to: ROUTES.DASHBOARD,   icon: LayoutDashboard, label: 'Dashboard',        always: false },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const { user, profile } = useAuth()

  const visibleItems = NAV_ITEMS.filter(item => item.always || !!user)

  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-3 pr-1 scrollbar-thin">
      {/* Profile mini card */}
      {user && profile && (
        <Link
          to={ROUTES.PROFILE}
          className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-200 transition-colors mb-1 group"
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="size-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white text-sm font-semibold shrink-0">
              {getInitials(profile.full_name ?? 'U')}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
          </div>
        </Link>
      )}

      <div className="h-px bg-gray-300 my-2 mx-2" />

      {/* Nav items */}
      <nav className="space-y-0.5">
        {visibleItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === ROUTES.HOME
            ? pathname === '/'
            : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  isActive
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          )
        })}

        {/* Admin link */}
        {profile?.role === 'admin' && (
          <Link
            to={ROUTES.ADMIN}
            className={cn(
              'flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-200'
            )}
          >
            <span className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              pathname.startsWith('/admin')
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-200 text-gray-600'
            )}>
              <ShieldCheck className="size-5" />
            </span>
            Admin Panel
          </Link>
        )}
      </nav>

      {/* Footer links */}
      <div className="mt-4 px-3 border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          Privacy · Terms · Cookies
          <br />
          © 2026 QuickConnect
        </p>
      </div>
    </aside>
  )
}
