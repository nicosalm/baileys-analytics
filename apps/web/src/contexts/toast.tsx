import { createContext, useContext, useState, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import '../styles/toast.css'

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

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
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
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`p-4 rounded shadow-lg max-w-sm flex items-center ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}
        >
          <span className="mr-2">{icons[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-4 text-white hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
