import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 600, delay = 0) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)
  const raf = useRef<number>(0)
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const from = prev.current
    const to = target
    prev.current = target

    if (from === to) return

    const run = () => {
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setValue(from + (to - from) * eased)
        if (t < 1) raf.current = requestAnimationFrame(step)
      }
      raf.current = requestAnimationFrame(step)
    }

    if (delay > 0) {
      timeout.current = setTimeout(run, delay)
    } else {
      run()
    }

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      if (timeout.current) clearTimeout(timeout.current)
    }
  }, [target, duration, delay])

  return value
}
