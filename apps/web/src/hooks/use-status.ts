import { useState, useEffect } from 'react'

type StatusState = 'operational' | 'issues' | 'unavailable'

export const useStatus = () => {
  const [status, setStatus] = useState<StatusState>('unavailable')

  useEffect(() => {
    const cached = sessionStorage.getItem('updown-status')
    if (cached) {
      setStatus(cached as StatusState)
      return
    }

    const controller = new AbortController()
    const statusApiKey = import.meta.env.VITE_UPDOWN_API_KEY
    if (!statusApiKey) {
      setStatus('unavailable')
      return
    }
    fetch(`https://updown.io/api/checks?api-key=${statusApiKey}`, {
      signal: controller.signal,
    })
      .then(res => res.json())
      .then((checks: Array<{ down: boolean }>) => {
        const state: StatusState = checks.some(c => c.down) ? 'issues' : 'operational'
        setStatus(state)
        sessionStorage.setItem('updown-status', state)
      })
      .catch(() => setStatus('unavailable'))

    return () => controller.abort()
  }, [])

  return status
}
