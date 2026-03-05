import { useState, useRef, useEffect, useCallback } from 'react'
import { BRAND } from '@/constants'

const FILLS = ['#dbeafe', '#60a5fa', '#3b82f6', '#1e3a8a']

const TRANSFORMS = [
  ['translate(0,0)', 'translate(100%,0)', 'translate(100%,100%)', 'translate(0,100%)'],
  ['translate(0,0)', 'translate(0,100%)', 'translate(-100%,100%)', 'translate(-100%,0)'],
  ['translate(0,0)', 'translate(0,-100%)', 'translate(100%,-100%)', 'translate(100%,0)'],
  ['translate(0,0)', 'translate(-100%,0)', 'translate(-100%,-100%)', 'translate(0,-100%)'],
]

export const LogoCube = ({ className = 'w-9 h-9' }: { className?: string }) => {
  const [step, setStep] = useState(0)
  const interval = useRef<number | null>(null)

  const handleMouseEnter = useCallback(() => {
    setStep(1)
    interval.current = window.setInterval(() => {
      setStep(s => (s + 1) % 4)
    }, 900)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (interval.current) {
      clearInterval(interval.current)
      interval.current = null
    }
    setStep(0)
  }, [])

  useEffect(() => {
    return () => { if (interval.current) clearInterval(interval.current) }
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
          x={i % 2 === 1 ? 500 : 0}
          y={i >= 2 ? 500 : 0}
          width="500"
          height="500"
          fill={fill}
          style={{
            transformBox: 'fill-box' as const,
            transition: 'transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1)',
            transform: TRANSFORMS[i][step],
          }}
        />
      ))}
    </svg>
  )
}
