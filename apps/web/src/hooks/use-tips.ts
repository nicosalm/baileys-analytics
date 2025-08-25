import { useState, useEffect } from 'react'

const TIPS_STORAGE_KEY = 'baileys-show-tips'

export const useTips = () => {
  const [showTips, setShowTips] = useState(() => {
    const stored = localStorage.getItem(TIPS_STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  useEffect(() => {
    localStorage.setItem(TIPS_STORAGE_KEY, showTips.toString())
  }, [showTips])

  const toggleTips = () => setShowTips(prev => !prev)

  return { showTips, setShowTips, toggleTips }
}