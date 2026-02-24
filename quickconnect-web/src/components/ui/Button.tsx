import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  icon?: ReactNode
}

const variantStyles = {
  primary:
    'bg-primary-500 text-white shadow-sm hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:bg-primary-700',
  secondary:
    'bg-accent-500 text-white shadow-sm hover:bg-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 active:bg-accent-700',
  outline:
    'border-2 border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:bg-gray-100',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 active:bg-gray-200',
  danger:
    'bg-danger-500 text-white shadow-sm hover:bg-danger-600 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 active:bg-danger-700',
}

const sizeStyles = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      fullWidth = false,
      icon,
      children,
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-[1em] animate-spin shrink-0" aria-hidden />
        ) : (
          icon && <span className="shrink-0 [&>svg]:size-[1em]">{icon}</span>
        )}
        {children && <span>{children}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
