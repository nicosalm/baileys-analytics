import { lazy, Suspense } from 'react'
import { useModal } from '@/contexts/modal'
import { LoadingState } from './LoadingState'

// Lazy load all modals for better performance
const PropertyDetailModal = lazy(() => import('./modals/PropertyDetailModal').then((m) => ({ default: m.PropertyDetailModal })))
const GuestDetailModal = lazy(() => import('./modals/GuestDetailModal').then((m) => ({ default: m.GuestDetailModal })))
const PeriodDetailModal = lazy(() => import('./modals/PeriodDetailModal').then((m) => ({ default: m.PeriodDetailModal })))
const BookingDetailModal = lazy(() => import('./modals/BookingDetailModal').then((m) => ({ default: m.BookingDetailModal })))
const OperatingExpenseEntryModal = lazy(() =>
  import('./modals/OperatingExpenseEntryModal').then((m) => ({ default: m.OperatingExpenseEntryModal })),
)

export const ModalManager = () => {
  const { activeModal } = useModal()

  if (!activeModal) return null

  const renderModal = () => {
    switch (activeModal.type) {
      case 'property':
        return (
          <PropertyDetailModal
            propertyId={activeModal.propertyId}
            propertyName={activeModal.propertyName}
            from={activeModal.from}
            to={activeModal.to}
          />
        )

      case 'guest':
        return (
          <GuestDetailModal guestId={activeModal.guestId} guestName={activeModal.guestName} performanceData={activeModal.performanceData} />
        )

      case 'period':
        return (
          <PeriodDetailModal
            month={activeModal.month}
            year={activeModal.year}
            day={activeModal.day}
            originalDate={activeModal.originalDate}
            granularity={activeModal.granularity}
          />
        )

      case 'booking':
        return <BookingDetailModal bookingId={activeModal.bookingId} guestName={activeModal.guestName} />

      case 'property-month': {
        const monthDate = new Date(parseInt(activeModal.year, 10), parseInt(activeModal.month, 10) - 1)
        const monthFrom = `${activeModal.year}-${activeModal.month.padStart(2, '0')}-01`
        const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
        const monthTo = `${activeModal.year}-${activeModal.month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        return (
          <PropertyDetailModal propertyId={activeModal.propertyId} propertyName={activeModal.propertyName} from={monthFrom} to={monthTo} />
        )
      }

      case 'operating-expense-entry':
        return (
          <OperatingExpenseEntryModal
            propertyId={activeModal.propertyId}
            propertyName={activeModal.propertyName}
            month={activeModal.month}
            templateData={activeModal.templateData}
          />
        )

      default:
        return null
    }
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-8">
            <LoadingState />
          </div>
        </div>
      }
    >
      {renderModal()}
    </Suspense>
  )
}
