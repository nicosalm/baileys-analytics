import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/toast'

// starts the OwnerRez OAuth redirect; the callback page finishes the connection
export const useConnectOwnerRez = () => {
  const [connecting, setConnecting] = useState(false)
  const { addToast } = useToast()

  // the back button restores this page from bfcache with the spinner still showing
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setConnecting(false)
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    const result = await api.initiateOAuth()
    if (result.success) {
      window.location.href = result.data.authUrl
      return
    }
    addToast('error', 'Failed to start the OwnerRez connection')
    setConnecting(false)
  }, [addToast])

  return { connect, connecting }
}
