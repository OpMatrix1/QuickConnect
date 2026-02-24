import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const sizeStyles = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
}

export function StarRating({
  rating,
  onChange,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const displayRating = hoverRating ?? rating
  const isInteractive = Boolean(onChange) && !readonly

  const handleClick = (value: number) => {
    if (isInteractive && onChange) onChange(value)
  }

  return (
    <div
      role={isInteractive ? 'slider' : undefined}
      aria-valuenow={rating}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-readonly={readonly}
      className="inline-flex gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = displayRating >= value
        const halfFilled = displayRating >= value - 0.5 && displayRating < value

        return (
          <button
            key={value}
            type="button"
            disabled={!isInteractive}
            onClick={() => handleClick(value)}
            onMouseEnter={() => isInteractive && setHoverRating(value)}
            onMouseLeave={() => isInteractive && setHoverRating(null)}
            className={cn(
              'relative inline-block transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded',
              isInteractive && 'cursor-pointer',
              !isInteractive && 'cursor-default'
            )}
          >
            <Star
              className={cn(
                sizeStyles[size],
                'text-gray-200',
                (filled || halfFilled) && 'fill-gray-200'
              )}
            />
            {(filled || halfFilled) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: halfFilled ? '50%' : '100%' }}
              >
                <Star
                  className={cn(
                    sizeStyles[size],
                    'fill-warning-500 text-warning-500'
                  )}
                />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
