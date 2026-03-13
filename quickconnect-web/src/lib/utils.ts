import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-BW', {
    style: 'currency',
    currency: 'BWP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-BW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export const URGENCY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700' },
} as const

export const BOOKING_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
} as const

export const POST_STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  matched: { label: 'Matched', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
} as const

export const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  held: { label: 'In Escrow', color: 'bg-blue-100 text-blue-700' },
  released: { label: 'Released', color: 'bg-green-100 text-green-700' },
  refunded: { label: 'Refunded', color: 'bg-orange-100 text-orange-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  disputed: { label: 'Disputed', color: 'bg-purple-100 text-purple-700' },
} as const

export const CATEGORY_REQUEST_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700' },
} as const

export const SERVICE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Painting',
  'Carpentry',
  'Gardening & Landscaping',
  'Moving & Transport',
  'Tutoring & Education',
  'Photography',
  'Catering',
  'Beauty & Salon',
  'Auto Repair & Mechanic',
  'IT & Computer Repair',
  'Construction',
  'Welding',
  'Tiling',
  'Air Conditioning & HVAC',
  'Security Services',
  'Event Planning',
  'Tailoring & Fashion',
] as const

export const CITIES = [
  'Gaborone',
  'Francistown',
  'Maun',
  'Kasane',
  'Serowe',
  'Mahalapye',
  'Palapye',
  'Lobatse',
  'Selebi-Phikwe',
  'Molepolole',
] as const
