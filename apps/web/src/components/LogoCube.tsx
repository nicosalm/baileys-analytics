import { useRef, useCallback, useEffect } from 'react'
import { BRAND } from '@/constants'

const FILLS = ['#dbeafe', '#60a5fa', '#3b82f6', '#1e3a8a']
const POSITIONS: [number, number][] = [
  [0, 0],
  [500, 0],
  [0, 500],
  [500, 500],
]

const TRANSFORMS = [
  ['translate(0,0)', 'translate(100%,0)', 'translate(100%,100%)', 'translate(0,100%)'],
  ['translate(0,0)', 'translate(0,100%)', 'translate(-100%,100%)', 'translate(-100%,0)'],
  ['translate(0,0)', 'translate(0,-100%)', 'translate(100%,-100%)', 'translate(100%,0)'],
  ['translate(0,0)', 'translate(-100%,0)', 'translate(-100%,-100%)', 'translate(0,-100%)'],
]

export const LogoCube = ({ className = 'w-9 h-9' }: { className?: string }) => {
  const rectsRef = useRef<(SVGRectElement | null)[]>([])
  const intervalRef = useRef<number | null>(null)

  const handleMouseEnter = useCallback(() => {
    let step = 1
    rectsRef.current.forEach((rect, i) => {
      if (rect) rect.style.transform = TRANSFORMS[i][1]
    })
    intervalRef.current = window.setInterval(() => {
      step = (step + 1) % 4
      rectsRef.current.forEach((rect, i) => {
        if (rect) rect.style.transform = TRANSFORMS[i][step]
      })
    }, 900)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    rectsRef.current.forEach((rect) => {
      if (rect) rect.style.transform = 'translate(0,0)'
    })
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <svg
      className={className}
      viewBox="0 0 1000 1000"
      aria-label={BRAND.name}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {FILLS.map((fill, i) => (
        <rect
          key={i}
          ref={(el) => {
            rectsRef.current[i] = el
          }}
          x={POSITIONS[i][0]}
          y={POSITIONS[i][1]}
          width="500"
          height="500"
          fill={fill}
          style={{
            transformBox: 'fill-box',
            transition: 'transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        />
      ))}
    </svg>
  )
}
