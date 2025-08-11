import { useModal } from '@/contexts/modal'
import { PropertyDetailModal } from './modals/PropertyDetailModal'
import { GuestDetailModal } from './modals/GuestDetailModal'
import { MonthDetailModal } from './modals/MonthDetailModal'
import { BookingDetailModal } from './modals/BookingDetailModal'
import { FinancialSummaryModal } from './modals/FinancialSummaryModal'
import { ReportBuilderModal } from './modals/ReportBuilderModal'
import { ReportPreviewModal } from './modals/ReportPreviewModal'
import { ReportHistoryModal } from './modals/ReportHistoryModal'

export const ModalManager = () => {
  const { activeModal } = useModal()

  if (!activeModal) return null

  switch (activeModal.type) {
    case 'property':
      return (
        <PropertyDetailModal
          propertyId={activeModal.propertyId}
          propertyName={activeModal.propertyName}
        />
      )
    
    case 'guest':
      return (
        <GuestDetailModal
          guestId={activeModal.guestId}
          guestName={activeModal.guestName}
        />
      )
    
    case 'month':
      return (
        <MonthDetailModal
          month={activeModal.month}
          year={activeModal.year}
        />
      )
    
    case 'booking':
      return (
        <BookingDetailModal
          bookingId={activeModal.bookingId}
          guestName={activeModal.guestName}
        />
      )
    
    case 'property-month':
      // For property-month, we can show property modal with date filter
      // Or create a specialized modal if needed
      return (
        <PropertyDetailModal
          propertyId={activeModal.propertyId}
          propertyName={activeModal.propertyName}
        />
      )
    
    case 'financial-summary':
      return (
        <FinancialSummaryModal
          propertyId={activeModal.propertyId}
          propertyName={activeModal.propertyName}
        />
      )
    
    case 'report-builder':
      return (
        <ReportBuilderModal
          template={activeModal.template}
        />
      )
    
    case 'report-preview':
      return (
        <ReportPreviewModal
          templateId={activeModal.templateId}
          templateName={activeModal.templateName}
        />
      )
    
    case 'report-history':
      return (
        <ReportHistoryModal
          templateId={activeModal.templateId}
          templateName={activeModal.templateName}
        />
      )
    
    default:
      return null
  }
}