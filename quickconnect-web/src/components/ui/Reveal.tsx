import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/useInView'

interface Props {
  children: ReactNode
  className?: string
  /** Delay in ms before the reveal transition starts (for stagger effects) */
  delay?: number
  /** 'up' = slide up + fade (default), 'scale' = scale + fade */
  animation?: 'up' | 'scale'
}

/**
 * Wraps children and animates them in once they scroll into the viewport.
 * Uses CSS `.reveal` / `.reveal-scale` + `.visible` classes from index.css.
 */
export function Reveal({ children, className, delay = 0, animation = 'up' }: Props) {
  const { ref, inView } = useInView()

  return (
    <div
      ref={ref}
      className={cn(animation === 'scale' ? 'reveal-scale' : 'reveal', inView && 'visible', className)}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
