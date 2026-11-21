import { createContext, useContext, useState, type ReactNode } from 'react'

export type ModalType =
  | { type: 'property'; propertyId: string; propertyName: string; from?: string; to?: string }
  | {
      type: 'guest'
      guestId: string
      guestName: string
      performanceData?: { isTopSpender?: boolean; isFrequent?: boolean; isNew?: boolean }
    }
  | { type: 'period'; month: string; year: string; day?: string; originalDate?: string; granularity?: 'daily' | 'weekly' | 'monthly' }
  | { type: 'booking'; bookingId: string; guestName?: string }
  | { type: 'property-month'; propertyId: string; propertyName: string; month: string; year: string }
  | { type: 'financial-summary'; propertyId?: string; propertyName?: string }
  | {
      type: 'operating-expense-entry'
      propertyId: string
      propertyName: string
      month?: string
      templateData?: { category: string; amount: number; description?: string }[]
    }
  | null

interface ModalContextType {
  activeModal: ModalType
  openModal: (modal: ModalType) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within ModalProvider')
  return context
}

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const openModal = (modal: ModalType) => setActiveModal(modal)
  const closeModal = () => setActiveModal(null)

  return <ModalContext.Provider value={{ activeModal, openModal, closeModal }}>{children}</ModalContext.Provider>
}
