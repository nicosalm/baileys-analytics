import { useId, useState } from 'react'
import { BRAND } from '@/constants'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { x: 5, y: 29, height: 13 },
  { x: 19.25, y: 21, height: 21 },
  { x: 33.5, y: 13, height: 29 },
  { x: 47.75, y: 0, height: 42 },
]

const WATER = [
  { y: 45, height: 5.5 },
  { y: 53.5, height: 4 },
]

// four rising columns clipped to a sun, over two water lines; colors come from --logo-fg and --logo-water.
// the horizon clip hides the columns while they sink below the water during the hover animation.
export const LogoShapes = ({ clipId, onRiseEnd }: { clipId: string; onRiseEnd?: () => void }) => (
  <>
    <clipPath id={clipId}>
      <circle cx="32" cy="31" r="27" />
    </clipPath>
    <clipPath id={`${clipId}-horizon`}>
      <rect x="0" y="0" width="64" height="43" />
    </clipPath>
    <g clipPath={`url(#${clipId})`}>
      <g clipPath={`url(#${clipId}-horizon)`} style={{ fill: 'var(--logo-fg)' }}>
        {COLUMNS.map((column, i) => (
          <rect
            key={column.x}
            className="logo-column"
            x={column.x}
            y={column.y}
            width="11.25"
            height={column.height}
            style={{ animationDelay: `${i * 30}ms` }}
          />
        ))}
      </g>
      <g style={{ fill: 'var(--logo-water)' }}>
        {WATER.map((line, i) => (
          <rect
            key={line.y}
            className="logo-water"
            x="-4"
            y={line.y}
            width="72"
            height={line.height}
            style={{ animationDelay: `${100 + i * 120}ms` }}
            onAnimationEnd={i === WATER.length - 1 ? onRiseEnd : undefined}
          />
        ))}
      </g>
    </g>
  </>
)

export const useClipId = () => `logo-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`

export const Logo = ({ className = 'w-9 h-9' }: { className?: string }) => {
  const clipId = useClipId()
  const [rising, setRising] = useState(false)

  return (
    <svg
      className={cn(className, rising && 'logo-rising')}
      viewBox="0 0 64 64"
      role="img"
      aria-label={BRAND.name}
      onMouseEnter={() => setRising(true)}
    >
      <LogoShapes clipId={clipId} onRiseEnd={() => setRising(false)} />
    </svg>
  )
}
