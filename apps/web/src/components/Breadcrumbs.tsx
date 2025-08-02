import { ChevronRight, Home } from 'lucide-react'
import { useDrillDown } from '@/contexts/drillDown'

export const Breadcrumbs = () => {
  const { state, dispatch } = useDrillDown()

  if (state.breadcrumbs.length === 0) return null

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <button
        onClick={() => dispatch({ type: 'RESET' })}
        className="flex items-center hover:text-blue-600"
      >
        <Home className="w-4 h-4" />
      </button>

      {state.breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="w-4 h-4 mx-1" />
          <button
            onClick={() => dispatch({ type: 'NAVIGATE_TO_LEVEL', level: crumb.level })}
            className={`hover:text-blue-600 ${
              index === state.breadcrumbs.length - 1 ? 'font-medium text-gray-900' : ''
            }`}
          >
            {crumb.label}
          </button>
        </div>
      ))}
    </nav>
  )
}
