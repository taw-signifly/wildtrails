'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { 
  WizardStep, 
  BasicInformation, 
  TournamentSettingsForm, 
  PlayerRegistration, 
  BracketConfiguration
} from '@/lib/validation/tournament-setup'
import { createTournamentData } from '@/lib/actions/tournaments'
import type { TournamentFormData } from '@/types'

interface SetupState {
  basic?: Partial<BasicInformation>
  settings?: Partial<TournamentSettingsForm>
  players?: Partial<PlayerRegistration>
  bracket?: Partial<BracketConfiguration>
}

const STEPS: WizardStep[] = ['basic', 'settings', 'players', 'bracket', 'review']
const STORAGE_KEY = 'tournament-setup-draft'

export function useTournamentSetup() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')
  const [setupData, setSetupData] = useState<SetupState>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setSetupData(parsed)
      } catch (error) {
        console.warn('Failed to load saved tournament setup:', error)
      }
    }
  }, [])

  // Save data to localStorage whenever setupData changes
  useEffect(() => {
    if (Object.keys(setupData).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setupData))
    }
  }, [setupData])

  const updateStepData = useCallback(<T extends keyof SetupState>(
    step: T,
    data: SetupState[T]
  ) => {
    setSetupData(prev => ({
      ...prev,
      [step]: { ...prev[step], ...data }
    }))
    setErrors({}) // Clear errors when data updates
  }, [])

  const getCurrentStepIndex = useCallback(() => {
    return STEPS.indexOf(currentStep)
  }, [currentStep])

  const canProceed = useCallback((step: WizardStep): boolean => {
    switch (step) {
      case 'basic':
        const basic = setupData.basic
        return !!(basic?.name && basic.type && basic.format && basic.startDate && basic.organizer)
      
      case 'settings':
        const settings = setupData.settings
        return !!(settings?.maxPlayers && settings.maxPoints)
      
      case 'players':
        const players = setupData.players
        return !!(players?.players && players.players.length >= 4)
      
      case 'bracket':
        const bracket = setupData.bracket
        return !!(bracket?.seedingType)
      
      case 'review':
        return true
      
      default:
        return false
    }
  }, [setupData])

  const nextStep = useCallback(() => {
    const currentIndex = getCurrentStepIndex()
    const nextIndex = Math.min(currentIndex + 1, STEPS.length - 1)
    
    if (canProceed(currentStep)) {
      setCurrentStep(STEPS[nextIndex])
    }
  }, [currentStep, getCurrentStepIndex, canProceed])

  const prevStep = useCallback(() => {
    const currentIndex = getCurrentStepIndex()
    const prevIndex = Math.max(currentIndex - 1, 0)
    setCurrentStep(STEPS[prevIndex])
  }, [getCurrentStepIndex])

  const goToStep = useCallback((step: WizardStep) => {
    const targetIndex = STEPS.indexOf(step)
    const currentIndex = getCurrentStepIndex()
    
    // Allow going to any previous step or next step if current is valid
    if (targetIndex <= currentIndex || canProceed(currentStep)) {
      setCurrentStep(step)
    }
  }, [currentStep, getCurrentStepIndex, canProceed])

  const submitTournament = useCallback(async () => {
    if (!canProceed('review')) {
      setErrors({ submit: 'Please complete all required steps' })
      return false
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Transform setup data to tournament form data
      const tournamentData: TournamentFormData = {
        name: setupData.basic!.name!,
        type: setupData.basic!.type!,
        format: setupData.basic!.format!,
        maxPoints: setupData.settings!.maxPoints || 13,
        shortForm: setupData.settings!.shortForm || false,
        startDate: setupData.basic!.startDate!,
        description: setupData.basic!.description,
        location: setupData.basic!.location,
        organizer: setupData.basic!.organizer!,
        maxPlayers: setupData.settings!.maxPlayers!,
        settings: setupData.settings!.settings || {}
      }

      const result = await createTournamentData(tournamentData)
      
      if (result.success) {
        // Clear saved data on successful creation
        localStorage.removeItem(STORAGE_KEY)
        
        // Redirect to tournament dashboard or detail page
        router.push(`/tournaments/${result.data.id}`)
        return true
      } else {
        setErrors({ 
          submit: result.error || 'Failed to create tournament',
          ...result.fieldErrors 
        })
        return false
      }
    } catch (error) {
      console.error('Tournament creation error:', error)
      setErrors({ submit: 'An unexpected error occurred' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [setupData, canProceed, router])

  const resetWizard = useCallback(() => {
    setSetupData({})
    setCurrentStep('basic')
    setErrors({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getCompletionPercentage = useCallback(() => {
    const completedSteps = STEPS.slice(0, -1).filter(step => canProceed(step)).length
    return Math.round((completedSteps / (STEPS.length - 1)) * 100)
  }, [canProceed])

  return {
    // State
    currentStep,
    setupData,
    isSubmitting,
    errors,
    steps: STEPS,
    
    // Actions
    updateStepData,
    nextStep,
    prevStep,
    goToStep,
    submitTournament,
    resetWizard,
    
    // Computed
    canProceed: canProceed(currentStep),
    isFirstStep: currentStep === STEPS[0],
    isLastStep: currentStep === STEPS[STEPS.length - 1],
    completionPercentage: getCompletionPercentage(),
    currentStepIndex: getCurrentStepIndex(),
  }
}