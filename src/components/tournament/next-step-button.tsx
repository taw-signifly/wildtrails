'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { Button } from '@/components/ui/button'

export function NextStepButton() {
  const currentStep = useWizardStore(state => state.currentStep)
  const isSubmitting = useWizardStore(state => state.isSubmitting)
  const getCanProceedForStep = useWizardStore(state => state.getCanProceedForStep)
  const setCurrentStep = useWizardStore(state => state.setCurrentStep)
  
  const setupData = useWizardStore(state => state.setupData)
  const canProceed = getCanProceedForStep(currentStep)
  const isLastStep = currentStep === 'review'
  
  console.log('NextStepButton render - canProceed:', canProceed, 'disabled:', !canProceed || isSubmitting, 'setupData.basic:', setupData.basic)

  const handleSubmit = async () => {
    if (isLastStep) {
      // Handle tournament submission
      console.log('TODO: Implement tournament submission')
    } else {
      // Move to next step
      const steps = ['basic', 'settings', 'players', 'bracket', 'review']
      const currentIndex = steps.indexOf(currentStep)
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1])
      }
    }
  }

  return (
    <Button
      onClick={handleSubmit}
      disabled={!canProceed || isSubmitting}
      className="min-w-[120px]"
    >
      {isSubmitting ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>Creating...</span>
        </div>
      ) : isLastStep ? (
        'Create Tournament'
      ) : (
        'Next Step'
      )}
    </Button>
  )
}