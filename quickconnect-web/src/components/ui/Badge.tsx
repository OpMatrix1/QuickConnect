import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
  className?: string
}

const variantStyles = {
  default:
    'bg-gray-100 text-gray-700',
  primary:
    'bg-primary-100 text-primary-700',
  success:
    'bg-success-50 text-success-600',
  warning:
    'bg-warning-50 text-warning-600',
  danger:
    'bg-danger-50 text-danger-600',
  info:
    'bg-blue-100 text-blue-700',
}

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
