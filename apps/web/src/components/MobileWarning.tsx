import { useState, useEffect } from 'react'
import { Compass, Smartphone } from 'lucide-react'
import { BRAND } from '@/constants'

const STORAGE_KEY = 'mobileWarningDismissed'

export const MobileWarning = () => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768
      const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true'
      setShow(isMobile && !isDismissed)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 ${BRAND.logoGradient} rounded-2xl flex items-center justify-center shadow-lg`}>
            <Compass className="w-9 h-9 text-white" />
          </div>
        </div>

        <div className="mb-6">
          <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {BRAND.name} works best on wider screens
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Switch to a desktop, laptop, or tablet for the best experience.
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]`}
        >
          I understand, continue
        </button>
      </div>
    </div>
  )
}
