import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'

export function Layout() {
  const { pathname } = useLocation()
  const { user } = useAuth()

  const isHome = pathname === '/'
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isChatPage = pathname.startsWith('/chat')

  const showSidebar = !!user && !isHome && !isAuthPage

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#F0EFFF' }}>
      <Header />

      {/* pt-14 = 56 px for fixed header (h-14) */}
      <main className="flex-1 pt-14">
        {isHome ? (
          /* Home: full-bleed hero + sections on white */
          <div key={pathname} className="animate-page-enter bg-white">
            <Outlet />
          </div>
        ) : isAuthPage ? (
          /* Auth pages: centered, white card on gray bg */
          <div key={pathname} className="animate-page-enter min-h-[calc(100vh-3.5rem)] bg-white">
            <Outlet />
          </div>
        ) : showSidebar ? (
          /* Inner authenticated pages: sidebar + content */
          <div className={isChatPage ? 'mx-auto max-w-[1300px] px-4 pt-4 sm:px-6 lg:px-8' : 'mx-auto max-w-[1300px] px-4 py-4 sm:px-6 lg:px-8'}>
            <div className="flex gap-4 items-start">
              <div className="hidden lg:block w-[260px] shrink-0">
                <Sidebar />
              </div>
              <div key={pathname} className="animate-page-enter flex-1 min-w-0">
                <Outlet />
              </div>
            </div>
          </div>
        ) : (
          /* Inner unauthenticated pages: centered content */
          <div key={pathname} className="animate-page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        )}
      </main>

      {!isHome && !isChatPage && <Footer />}
    </div>
  )
}
