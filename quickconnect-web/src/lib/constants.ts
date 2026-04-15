export const APP_NAME = 'QuickConnect'
export const APP_DESCRIPTION = 'Find trusted local service providers across Botswana'
export const APP_CURRENCY = 'BWP'
export const APP_CURRENCY_SYMBOL = 'P'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  LOOKING_FOR: '/looking-for',
  CREATE_POST: '/looking-for/create',
  EDIT_POST: '/looking-for/:id/edit',
  POST_DETAIL: '/looking-for/:id',
  PROVIDERS: '/providers',
  PROVIDER_PROFILE: '/providers/:id',
  MY_BOOKINGS: '/bookings',
  BOOKING_DETAIL: '/bookings/:id',
  CHAT: '/chat',
  CHAT_CONVERSATION: '/chat/:id',
  PROFILE: '/profile',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_CATEGORIES: '/admin/categories',
  WALLET: '/wallet',
  QUOTES: '/quotes',
} as const
