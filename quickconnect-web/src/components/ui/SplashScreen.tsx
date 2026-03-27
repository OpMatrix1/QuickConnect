import { useEffect, useState } from 'react'

interface Props {
  onDone: () => void
}

export function SplashScreen({ onDone }: Props) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), 2200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none${exiting ? ' animate-splash-exit' : ''}`}
      style={{ background: 'linear-gradient(160deg, #1c0770 0%, #261cc1 55%, #3a5ae8 100%)' }}
      onAnimationEnd={(e) => {
        if (e.animationName === 'splash-exit') onDone()
      }}
    >
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-80 rounded-full bg-primary-300/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 size-64 -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Glow halo behind icon */}
        <div
          className="animate-splash-glow absolute size-40 rounded-[32px] bg-primary-500/25 blur-2xl"
          aria-hidden
        />

        {/* QC logo icon */}
        <div
          className="animate-splash-icon relative flex size-28 items-center justify-center rounded-[28px] bg-highlight-300 font-extrabold text-primary-900 shadow-[0_12px_48px_rgba(38,28,193,0.65)]"
          style={{ fontSize: '2.75rem', letterSpacing: '-0.5px' }}
        >
          QC
          {/* Shine overlay */}
          <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-white/20 to-transparent" />
        </div>

        {/* App name + tagline */}
        <div
          className="animate-splash-text text-center"
          style={{ animationDelay: '380ms' }}
        >
          <p className="text-[1.75rem] font-bold tracking-tight text-white">
            QuickConnect
          </p>
          <p className="mt-1.5 text-sm text-white/55">
            Find local services in Botswana
          </p>
        </div>
      </div>

      {/* Loading dots */}
      <div
        className="animate-splash-text absolute bottom-14 flex items-center gap-2"
        style={{ animationDelay: '700ms' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-white/35"
            style={{ animation: `bounce 1.3s ease-in-out ${i * 180}ms infinite` }}
          />
        ))}
      </div>
    </div>
  )
}
