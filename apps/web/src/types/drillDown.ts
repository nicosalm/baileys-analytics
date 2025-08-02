export type DrillDownLevel =
  | { type: 'root' }
  | { type: 'property'; propertyId: string; propertyName: string }
  | { type: 'month'; month: string; year: string }
  | { type: 'booking'; bookingId: string }
  | { type: 'property-month'; propertyId: string; propertyName: string; month: string; year: string }

export type DrillDownContext = {
  level: DrillDownLevel
  breadcrumbs: Array<{ label: string; level: DrillDownLevel }>
}

export type DrillDownAction =
  | { type: 'DRILL_TO_PROPERTY'; propertyId: string; propertyName: string }
  | { type: 'DRILL_TO_MONTH'; month: string; year: string }
  | { type: 'DRILL_TO_BOOKING'; bookingId: string }
  | { type: 'DRILL_TO_PROPERTY_MONTH'; propertyId: string; propertyName: string; month: string; year: string }
  | { type: 'NAVIGATE_TO_LEVEL'; level: DrillDownLevel }
  | { type: 'RESET' }

export const drillDownReducer = (
  state: DrillDownContext,
  action: DrillDownAction
): DrillDownContext => {
  switch (action.type) {
    case 'DRILL_TO_PROPERTY':
      return {
        level: { type: 'property', propertyId: action.propertyId, propertyName: action.propertyName },
        breadcrumbs: [
          ...state.breadcrumbs,
          { label: action.propertyName, level: { type: 'property', propertyId: action.propertyId, propertyName: action.propertyName } }
        ]
      }

    case 'DRILL_TO_MONTH':
      return {
        level: { type: 'month', month: action.month, year: action.year },
        breadcrumbs: [
          ...state.breadcrumbs,
          { label: `${action.month}/${action.year}`, level: { type: 'month', month: action.month, year: action.year } }
        ]
      }

    case 'DRILL_TO_BOOKING':
      return {
        level: { type: 'booking', bookingId: action.bookingId },
        breadcrumbs: [
          ...state.breadcrumbs,
          { label: `Booking ${action.bookingId}`, level: { type: 'booking', bookingId: action.bookingId } }
        ]
      }

    case 'DRILL_TO_PROPERTY_MONTH':
      return {
        level: { type: 'property-month', propertyId: action.propertyId, propertyName: action.propertyName, month: action.month, year: action.year },
        breadcrumbs: [
          ...state.breadcrumbs,
          {
            label: `${action.propertyName} - ${action.month}/${action.year}`,
            level: { type: 'property-month', propertyId: action.propertyId, propertyName: action.propertyName, month: action.month, year: action.year }
          }
        ]
      }

    case 'NAVIGATE_TO_LEVEL':
      const levelIndex = state.breadcrumbs.findIndex(b =>
        JSON.stringify(b.level) === JSON.stringify(action.level)
      )
      if (levelIndex === -1) {
        return {
          level: { type: 'root' },
          breadcrumbs: []
        }
      }
      return {
        level: action.level,
        breadcrumbs: state.breadcrumbs.slice(0, levelIndex + 1)
      }

    case 'RESET':
      return {
        level: { type: 'root' },
        breadcrumbs: []
      }

    default:
      return state
  }
}

export const initialDrillDownContext: DrillDownContext = {
  level: { type: 'root' },
  breadcrumbs: []
}
