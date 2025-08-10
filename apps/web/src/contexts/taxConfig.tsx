import { createContext, useContext, ReactNode, useEffect } from 'react'
import { TaxRule, PropertyTaxConfig } from '@/types/tax'
import { useTaxRules, usePropertyTaxConfigs } from '@/hooks/use-api'
import { useToast } from './toast'

// Since we're using SWR hooks, the state will be managed by SWR's caching

type TaxConfigContextType = {
  rules: TaxRule[] | undefined
  propertyConfigs: PropertyTaxConfig[] | undefined
  isLoading: boolean
  error: any
  mutateRules: () => void
  mutatePropertyConfigs: () => void
}

const TaxConfigContext = createContext<TaxConfigContextType | null>(null)

export const TaxConfigProvider = ({ children }: { children: ReactNode }) => {
  const { addToast } = useToast()
  
  const {
    data: rules,
    error: rulesError,
    isLoading: rulesLoading,
    mutate: mutateRules
  } = useTaxRules()
  
  const {
    data: propertyConfigs,
    error: configsError,
    isLoading: configsLoading,
    mutate: mutatePropertyConfigs
  } = usePropertyTaxConfigs()
  
  const isLoading = rulesLoading || configsLoading
  const error = rulesError || configsError
  
  // Show error toast when there's an error
  useEffect(() => {
    if (error && !isLoading) {
      addToast('error', `Failed to load tax configuration: ${error.message}`)
    }
  }, [error, isLoading, addToast])

  return (
    <TaxConfigContext.Provider value={{ 
      rules, 
      propertyConfigs, 
      isLoading, 
      error, 
      mutateRules, 
      mutatePropertyConfigs 
    }}>
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
