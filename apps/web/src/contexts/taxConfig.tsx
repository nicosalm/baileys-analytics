import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { TaxRule, TaxConfigState, PropertyTaxConfig } from '@/types/tax'
import { api } from '@/lib/api'
import { useToast } from './toast'

type TaxConfigAction =
  | { type: 'LOADING' }
  | { type: 'LOADED'; rules: TaxRule[]; propertyConfigs: PropertyTaxConfig[] }
  | { type: 'ERROR'; error: string }
  | { type: 'ADD_RULE'; rule: TaxRule }
  | { type: 'UPDATE_RULE'; rule: TaxRule }
  | { type: 'DELETE_RULE'; ruleId: string }
  | { type: 'TOGGLE_RULE'; ruleId: string }

const reducer = (state: TaxConfigState, action: TaxConfigAction): TaxConfigState => {
  switch (action.type) {
    case 'LOADING':
      return { status: 'loading' }

    case 'LOADED':
      return {
        status: 'loaded',
        rules: action.rules,
        propertyConfigs: action.propertyConfigs
      }

    case 'ERROR':
      return { status: 'error', error: action.error }

    case 'ADD_RULE':
      if (state.status !== 'loaded') return state
      return {
        ...state,
        rules: [...state.rules, action.rule]
      }

    case 'UPDATE_RULE':
      if (state.status !== 'loaded') return state
      return {
        ...state,
        rules: state.rules.map(r =>
          r.id === action.rule.id ? action.rule : r
        )
      }

    case 'DELETE_RULE':
      if (state.status !== 'loaded') return state
      return {
        ...state,
        rules: state.rules.filter(r => r.id !== action.ruleId)
      }

    case 'TOGGLE_RULE':
      if (state.status !== 'loaded') return state
      return {
        ...state,
        rules: state.rules.map(r =>
          r.id === action.ruleId ? { ...r, isActive: !r.isActive } : r
        )
      }

    default:
      return state
  }
}

type TaxConfigContextType = {
  state: TaxConfigState
  dispatch: React.Dispatch<TaxConfigAction>
  refreshConfig: () => Promise<void>
}

const TaxConfigContext = createContext<TaxConfigContextType | null>(null)

export const TaxConfigProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, { status: 'loading' })
  const { addToast } = useToast()

  const refreshConfig = async () => {
    dispatch({ type: 'LOADING' })

    const [rulesResult, configsResult] = await Promise.all([
      api.getTaxRules(),
      api.getPropertyTaxConfigs()
    ])

    if (rulesResult.success && configsResult.success) {
      dispatch({
        type: 'LOADED',
        rules: rulesResult.data,
        propertyConfigs: configsResult.data
      })
    } else {
      let error = 'Failed to load tax configuration'
      if (!rulesResult.success) {
        error = rulesResult.error
      } else if (!configsResult.success) {
        error = configsResult.error
      }
      dispatch({ type: 'ERROR', error })
      addToast('error', `Failed to load tax configuration: ${error}`)
    }
  }

  useEffect(() => {
    refreshConfig()
  }, [])

  return (
    <TaxConfigContext.Provider value={{ state, dispatch, refreshConfig }}>
      {children}
    </TaxConfigContext.Provider>
  )
}

export const useTaxConfig = () => {
  const context = useContext(TaxConfigContext)
  if (!context) {
    throw new Error('useTaxConfig must be used within TaxConfigProvider')
  }
  return context
}
