import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme'

const SLIDES = [
  { id: 'overview', label: 'Overview', caption: 'Revenue, bookings, occupancy, and guests for any date range, against your goals.' },
  {
    id: 'financials',
    label: 'Financials',
    caption: 'P&L by property and month, with platform fees, taxes, and operating costs broken out.',
  },
  { id: 'properties', label: 'Properties', caption: 'Every property ranked by revenue, margin, RevPAN, and occupancy.' },
  { id: 'occupancy', label: 'Occupancy', caption: 'Occupancy by month and property, with booking pace against last year.' },
  { id: 'guests', label: 'Guests', caption: 'Every guest with contact details, tags, sources, and full stay history.' },
] as const

const INTERVAL_MS = 7000

export function ProductTour() {
  const [active, setActive] = useState(0)
  // only slides that have been shown, plus the next one, load their screenshot
  const [loaded, setLoaded] = useState(() => new Set([0, 1]))
  const { resolvedTheme } = useTheme()
  const [paused, setPaused] = useState(false)
  const reducedMotion = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const autoplay = !paused && !reducedMotion.current

  useEffect(() => {
    const next = (active + 1) % SLIDES.length
    setLoaded((prev) => (prev.has(active) && prev.has(next) ? prev : new Set([...prev, active, next])))
  }, [active])

  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [active, autoplay])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (active + (e.key === 'ArrowRight' ? 1 : SLIDES.length - 1)) % SLIDES.length
    setActive(next)
    document.getElementById(`tour-tab-${SLIDES[next].id}`)?.focus()
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div role="tablist" aria-label="Dashboards" onKeyDown={onKeyDown} className="flex w-max mx-auto gap-1">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              id={`tour-tab-${slide.id}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={`tour-panel-${slide.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                'relative px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer',
                i === active ? 'text-landing-fg bg-landing-fg/10' : 'text-landing-caption hover:text-landing-fg/80',
              )}
            >
              {slide.label}
              {i === active && autoplay && (
                <span
                  key={active}
                  className="absolute left-4 right-4 bottom-1 h-px origin-left bg-landing-fg/50 tour-progress"
                  style={{ animationDuration: `${INTERVAL_MS}ms` }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden ring-1 ring-landing-fg/10 shadow-2xl bg-landing-card aspect-[1440/900]">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            id={`tour-panel-${slide.id}`}
            role="tabpanel"
            aria-labelledby={`tour-tab-${slide.id}`}
            aria-hidden={i !== active}
            className={cn('absolute inset-0 transition-opacity duration-400', i === active ? 'opacity-100' : 'opacity-0')}
          >
            {loaded.has(i) && (
              <picture>
                <source
                  type="image/avif"
                  srcSet={`/tour/${slide.id}-${resolvedTheme}-1440.avif 1440w, /tour/${slide.id}-${resolvedTheme}-2880.avif 2880w`}
                  sizes="(min-width: 1024px) 960px, 100vw"
                />
                <source
                  type="image/webp"
                  srcSet={`/tour/${slide.id}-${resolvedTheme}-1440.webp 1440w, /tour/${slide.id}-${resolvedTheme}-2880.webp 2880w`}
                  sizes="(min-width: 1024px) 960px, 100vw"
                />
                <img
                  src={`/tour/${slide.id}-${resolvedTheme}-1440.webp`}
                  alt={`${slide.label} dashboard`}
                  width={1440}
                  height={900}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  className="w-full h-full object-cover object-top"
                />
              </picture>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-landing-caption text-center min-h-5" aria-live="polite">
        {SLIDES[active].caption}
      </p>
    </div>
  )
}
