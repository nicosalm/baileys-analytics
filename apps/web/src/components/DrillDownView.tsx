import { useDrillDown } from '@/contexts/drillDown'
import { PropertyDetailView } from './PropertyDetailView'
import { BookingDetailView } from './BookingDetailView'
import { MonthDetailView } from './MonthDetailView'
import { PropertyMonthDetailView } from './PropertyMonthDetailView'
import { GuestDetailView } from './GuestDetailView'
import { Breadcrumbs } from './Breadcrumbs'

export const DrillDownView = ({ children }: { children: React.ReactNode }) => {
  const { state } = useDrillDown()

  const renderView = () => {
    switch (state.level.type) {
      case 'root':
        return children
      case 'property':
        return <PropertyDetailView propertyId={state.level.propertyId} />
      case 'month':
        return <MonthDetailView month={state.level.month} year={state.level.year} />
      case 'booking':
        return <BookingDetailView bookingId={state.level.bookingId} />
      case 'property-month':
        return (
          <PropertyMonthDetailView
            propertyId={state.level.propertyId}
            month={state.level.month}
            year={state.level.year}
          />
        )
      case 'guest':
        return <GuestDetailView guestId={state.level.guestId} />
      default:
        return children
    }
  }

  return (
    <div>
      <Breadcrumbs />
      {renderView()}
    </div>
  )
}
