import { createContext, useContext, useState, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: string
  type: ToastType
  message: string
}

type ToastContextValue = {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

let toastCounter = 0

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (type: ToastType, message: string) => {
    // Generate unique ID first
    const id = `toast-${Date.now()}-${toastCounter++}-${Math.random().toString(36).substr(2, 9)}`
    
    // Check if a similar toast already exists to prevent duplicates
    setToasts(prev => {
      const exists = prev.some(t => t.message === message && t.type === type)
      if (exists) return prev
      
      // Auto remove this specific toast after 5 seconds
      setTimeout(() => {
        removeToast(id)
      }, 5000)
      
      return [...prev, { id, type, message }]
    })
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const showToast = (message: string, type: ToastType = 'info') => {
    addToast(type, message)
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) => {
  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  }

  return (
    <div className="fixed bottom-6 right-6 space-y-3 z-50">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`bg-white rounded-lg shadow-xl border max-w-sm flex items-center gap-3 p-4 ${
            toast.type === 'success' ? 'border-green-200' :
            toast.type === 'error' ? 'border-red-200' :
            'border-blue-200'
          }`}
        >
          <span className={`flex-shrink-0 ${
            toast.type === 'success' ? 'text-green-600' :
            toast.type === 'error' ? 'text-red-600' :
            'text-blue-600'
          }`}>{icons[toast.type]}</span>
          <span className="flex-1 text-sm font-medium text-gray-900">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
