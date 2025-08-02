import { createContext, useContext, useReducer, ReactNode } from 'react'
import {
  DrillDownContext as DrillDownContextType,
  DrillDownAction,
  drillDownReducer,
  initialDrillDownContext
} from '@/types/drillDown'

type DrillDownContextValue = {
  state: DrillDownContextType
  dispatch: (action: DrillDownAction) => void
}

const DrillDownContext = createContext<DrillDownContextValue | null>(null)

export const useDrillDown = () => {
  const context = useContext(DrillDownContext)
  if (!context) throw new Error('useDrillDown must be used within DrillDownProvider')
  return context
}

export const DrillDownProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(drillDownReducer, initialDrillDownContext)

  return (
    <DrillDownContext.Provider value={{ state, dispatch }}>
      {children}
    </DrillDownContext.Provider>
  )
}
