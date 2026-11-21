import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'info'

const addToast = (type: ToastType, message: string) => {
  switch (type) {
    case 'success':
      toast.success(message)
      break
    case 'error':
      toast.error(message)
      break
    case 'info':
      toast.info(message)
      break
  }
}

const showToast = (message: string, type: ToastType = 'info') => {
  addToast(type, message)
}

export const useToast = () => {
  return { addToast, showToast }
}
