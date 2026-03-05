import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)
  const raf = useRef<number>(0)

  useEffect(() => {
    const from = prev.current
    const to = target
    prev.current = target

    if (from === to) return

    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return value
}
