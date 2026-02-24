import { cn } from '@/lib/utils'

export interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
}

const sizeStyles = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
}

const fallbackColors = [
  'bg-primary-500',
  'bg-accent-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-danger-500',
]

function getFallbackColor(fallback: string): string {
  const index = fallback.charCodeAt(0) % fallbackColors.length
  return fallbackColors[index]
}

export function Avatar({
  src,
  alt = '',
  size = 'md',
  fallback = '?',
}: AvatarProps) {
  const initials = fallback.slice(0, 2).toUpperCase()

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white',
        sizeStyles[size]
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
        />
      ) : (
        <span
          className={cn(
            'flex size-full items-center justify-center',
            getFallbackColor(fallback)
          )}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
