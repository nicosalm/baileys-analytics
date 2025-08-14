import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useProperties } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { mutate as globalMutate } from 'swr'
import { 
  ChevronRight, ChevronLeft, Check, 
  Building2, MapPin, Globe
} from 'lucide-react'
import { format } from 'date-fns'
import { taxConfigSchema, type TaxConfig } from '@/schemas/taxConfig'

import { PropertySelectionStep } from './wizard-steps/PropertySelectionStep'
import { JurisdictionStep } from './wizard-steps/JurisdictionStep'
import { PlatformSettingsStep } from './wizard-steps/PlatformSettingsStep'
import { ReviewStep } from './wizard-steps/ReviewStep'

export type WizardData = TaxConfig

interface TaxConfigWizardStepperProps {
  defaultPropertyId?: string
  existingConfig?: any
}

const STEPS = [
  { id: 'property', label: 'Select Property', icon: Building2 },
  { id: 'jurisdictions', label: 'Tax Jurisdictions', icon: MapPin },
  { id: 'platforms', label: 'Platform Settings', icon: Globe },
  { id: 'review', label: 'Review & Save', icon: Check }
]

export const TaxConfigWizardStepper = ({ 
  defaultPropertyId,
  existingConfig 
}: TaxConfigWizardStepperProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  const { data: propertiesData } = useProperties()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [wizardData, setWizardData] = useState<WizardData>({
    propertyId: existingConfig?.propertyId || defaultPropertyId || '',
    propertyName: '',
    propertyAddress: '',
    configName: existingConfig?.configName || '',
    jurisdictions: existingConfig?.jurisdictions || [],
    taxableItems: existingConfig?.taxableItems || ['base_rent', 'cleaning_fee', 'platform_fee', 'other_fees'],
    platformSettings: existingConfig?.platformSettings || {
      airbnb: { remitsTax: true },
      vrbo: { remitsTax: false }
    },
    effectiveFrom: existingConfig?.effectiveFrom 
      ? format(new Date(existingConfig.effectiveFrom), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  })
  
  const properties = propertiesData || []
  
  useEffect(() => {
    if (wizardData.propertyId && properties.length > 0) {
      const property = properties.find((p: any) => p.id === wizardData.propertyId)
      if (property) {
        setWizardData(prev => ({
          ...prev,
          propertyName: property.name,
          propertyAddress: property.address || ''
        }))
      }
    }
  }, [wizardData.propertyId, properties])
  
  const canProceed = () => {
    switch (currentStep) {
      case 0: // Property selection
        return !!wizardData.propertyId
      case 1: // Jurisdictions
        return wizardData.jurisdictions.length > 0 && 
               wizardData.jurisdictions.every(j => j.name && j.rate > 0)
      case 2: // Platform settings
        return true // Platform settings are optional
      case 3: // Review
        return true
      default:
        return false
    }
  }
  
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      
      const configToValidate = {
        ...wizardData,
        configName: wizardData.configName || `Tax Config - ${wizardData.propertyName}`
      }
      
      const validationResult = taxConfigSchema.safeParse(configToValidate)
      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0]
        addToast('error', firstError?.message || 'Invalid configuration data')
        setIsSubmitting(false)
        return
      }
      
      const config = validationResult.data
      const result = existingConfig?.id 
        ? await api.updatePropertyTaxConfig(existingConfig.id, config)
        : await api.savePropertyTaxConfig(config)
      
      if (result.success) {
        addToast('success', existingConfig ? 'Tax configuration updated' : 'Tax configuration saved')
        
        await globalMutate('/property-tax-status', undefined, { revalidate: true })
        await globalMutate('/property-tax-configs', undefined, { revalidate: true })
        await globalMutate(
          key => typeof key === 'string' && (key.includes('property-tax') || key.includes('tax')),
          undefined,
          { revalidate: true }
        )
        
        closeModal()
      } else {
        addToast('error', result.error || 'Failed to save configuration')
      }
    } catch (error) {
      addToast('error', 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }))
  }
  
  const totalRate = wizardData.jurisdictions.reduce((sum, j) => sum + j.rate, 0)
  
  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Tax Configuration Setup"
      subtitle={existingConfig ? `Editing: ${existingConfig.configName}` : "Let's set up tax collection for your property"}
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              const isClickable = (existingConfig && index === 0) ? false : (index < currentStep || (index === currentStep + 1 && canProceed()))
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => isClickable && index < currentStep && setCurrentStep(index)}
                    disabled={!isClickable || index >= currentStep}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                      isActive 
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                        : isCompleted 
                          ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600' 
                          : 'bg-gray-200 text-gray-500'
                    } ${!isClickable || index >= currentStep ? 'cursor-not-allowed' : ''}`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </button>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Step {index + 1} of {STEPS.length}
                      </p>
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className={`w-5 h-5 mx-2 ${
                      isCompleted ? 'text-green-500' : 'text-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Step Content */}
        <div className="flex-1 overflow-y-auto mb-6">
          {currentStep === 0 && (
            <PropertySelectionStep
              properties={properties}
              selectedPropertyId={wizardData.propertyId}
              onSelect={(propertyId) => updateWizardData({ propertyId })}
              isEditMode={!!existingConfig}
            />
          )}
          
          {currentStep === 1 && (
            <JurisdictionStep
              jurisdictions={wizardData.jurisdictions}
              propertyAddress={wizardData.propertyAddress}
              onUpdate={(jurisdictions) => updateWizardData({ jurisdictions })}
            />
          )}
          
          {currentStep === 2 && (
            <PlatformSettingsStep
              platformSettings={wizardData.platformSettings}
              taxableItems={wizardData.taxableItems}
              effectiveFrom={wizardData.effectiveFrom}
              onUpdate={(updates) => updateWizardData(updates)}
            />
          )}
          
          {currentStep === 3 && (
            <ReviewStep
              wizardData={wizardData}
              totalRate={totalRate}
              isEditMode={!!existingConfig}
            />
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <button
            onClick={currentStep === 0 ? closeModal : handleBack}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
            disabled={isSubmitting}
          >
            {currentStep === 0 ? 'Cancel' : (
              <>
                <ChevronLeft className="w-4 h-4 inline mr-1" />
                Back
              </>
            )}
          </button>
          
          <div className="flex items-center space-x-3">
            {totalRate > 0 && (
              <div className="px-3 py-1 bg-green-50 border border-green-200 rounded-sm">
                <span className="text-sm text-green-800">
                  Total Rate: <strong>{totalRate.toFixed(2)}%</strong>
                </span>
              </div>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !canProceed()}
                className="px-4 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : (existingConfig ? 'Update Configuration' : 'Save Configuration')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}