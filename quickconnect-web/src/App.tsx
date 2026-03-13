import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { Layout } from '@/components/layout/Layout'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { AdminCategories } from '@/pages/admin/AdminCategories'
import { Dashboard } from '@/pages/Dashboard'
import { Profile } from '@/pages/Profile'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminReports } from '@/pages/admin/AdminReports'
import { LookingFor } from '@/pages/LookingFor'
import { CreatePost } from '@/pages/CreatePost'
import { PostDetail } from '@/pages/PostDetail'
import { ProviderSearch } from '@/pages/ProviderSearch'
import { ProviderProfile } from '@/pages/ProviderProfile'
import { MyBookings } from '@/pages/MyBookings'
import { Chat } from '@/pages/Chat'
import { ROUTES } from '@/lib/constants'

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route element={<Layout />}>
              <Route path={ROUTES.HOME} element={<Home />} />
              <Route path={ROUTES.LOGIN} element={<Login />} />
              <Route path={ROUTES.REGISTER} element={<Register />} />
              <Route path={ROUTES.LOOKING_FOR} element={<LookingFor />} />
              <Route path={ROUTES.CREATE_POST} element={<CreatePost />} />
              <Route path={ROUTES.POST_DETAIL} element={<PostDetail />} />
              <Route path={ROUTES.PROVIDERS} element={<ProviderSearch />} />
              <Route path={ROUTES.PROVIDER_PROFILE} element={<ProviderProfile />} />
              <Route path={ROUTES.MY_BOOKINGS} element={<MyBookings />} />
              <Route path={ROUTES.CHAT} element={<Chat />} />
              <Route path={ROUTES.CHAT_CONVERSATION} element={<Chat />} />
              <Route path={ROUTES.PROFILE} element={<Profile />} />
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              <Route path={ROUTES.ADMIN} element={<AdminDashboard />} />
              <Route path={ROUTES.ADMIN_USERS} element={<AdminUsers />} />
              <Route path={ROUTES.ADMIN_REPORTS} element={<AdminReports />} />
              <Route path={ROUTES.ADMIN_CATEGORIES} element={<AdminCategories />} />
            </Route>
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
