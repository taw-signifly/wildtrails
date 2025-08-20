'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { 
  WizardStep, 
  BasicInformation, 
  TournamentSettingsForm, 
  PlayerRegistration, 
  BracketConfiguration
} from '@/lib/validation/tournament-setup'
import { 
  validateBasicInformation, 
  validateTournamentSettings, 
  validatePlayerRegistration, 
  validateBracketConfiguration,
  validateCompleteSetup 
} from '@/lib/validation/tournament-setup'
import { createTournamentSetup } from '@/lib/actions/tournaments'
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
  // Use a ref to ensure single instance across all hook calls
  const setupDataRef = useRef<SetupState>({})
  const [setupData, setSetupDataState] = useState<SetupState>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [renderTrigger, setRenderTrigger] = useState(0)
  
  const setSetupData = useCallback((newData: SetupState | ((prev: SetupState) => SetupState)) => {
    const data = typeof newData === 'function' ? newData(setupDataRef.current) : newData
    setupDataRef.current = data
    setSetupDataState(data)
  }, [])

  // Load saved data from localStorage on mount with security validation
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        
        // SECURITY: Validate structure before using saved data
        if (typeof parsed === 'object' && parsed !== null) {
          const validatedData: SetupState = {}
          
          // Validate each step's data with Zod schemas
          if (parsed.basic) {
            const basicResult = validateBasicInformation(parsed.basic)
            if (basicResult.success) {
              validatedData.basic = basicResult.data
            } else {
              console.warn('Invalid basic information in saved data:', basicResult.error.issues)
            }
          }
          
          if (parsed.settings) {
            const settingsResult = validateTournamentSettings(parsed.settings)
            if (settingsResult.success) {
              validatedData.settings = settingsResult.data
            } else {
              console.warn('Invalid tournament settings in saved data:', settingsResult.error.issues)
            }
          }
          
          if (parsed.players) {
            const playersResult = validatePlayerRegistration(parsed.players)
            if (playersResult.success) {
              validatedData.players = playersResult.data
            } else {
              console.warn('Invalid player registration in saved data:', playersResult.error.issues)
            }
          }
          
          if (parsed.bracket) {
            const bracketResult = validateBracketConfiguration(parsed.bracket)
            if (bracketResult.success) {
              validatedData.bracket = bracketResult.data
            } else {
              console.warn('Invalid bracket configuration in saved data:', bracketResult.error.issues)
            }
          }
          
          // Only set data if we have at least one valid section
          if (Object.keys(validatedData).length > 0) {
            setSetupData(validatedData)
          } else if (Object.keys(parsed).length > 0) {
            // Clear invalid localStorage data to prevent endless validation errors
            console.warn('Clearing invalid localStorage data')
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch (error) {
        console.warn('Invalid saved tournament setup data, clearing localStorage:', error)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // PERFORMANCE: Debounced localStorage saves to prevent excessive writes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (Object.keys(setupData).length > 0) {
      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      // Debounce localStorage writes by 500ms
      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(setupData))
        } catch (error) {
          console.warn('Failed to save tournament setup to localStorage:', error)
        }
      }, 500)
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [setupData])

  const updateStepData = useCallback(<T extends keyof SetupState>(
    step: T,
    data: SetupState[T]
  ) => {
    console.log(`updateStepData called: step=${step}`, data)
    setSetupData(prev => {
      const newData = {
        ...prev,
        [step]: { ...prev[step], ...data }
      }
      console.log('New setupData:', newData)
      return newData
    })
    setErrors({}) // Clear errors when data updates
    setRenderTrigger(prev => prev + 1) // Force component re-render
  }, [])

  const getCurrentStepIndex = useCallback(() => {
    return STEPS.indexOf(currentStep)
  }, [currentStep])

  const getCanProceedForStep = (step: WizardStep): boolean => {
    switch (step) {
      case 'basic':
        const basic = setupData.basic
        const result = !!(basic?.name && basic.type && basic.format && basic.startDate && basic.organizer)
        console.log('Validation check:', { basic, result })
        return result
      
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
  }

  const nextStep = useCallback(() => {
    const currentIndex = getCurrentStepIndex()
    const nextIndex = Math.min(currentIndex + 1, STEPS.length - 1)
    
    if (getCanProceedForStep(currentStep)) {
      setCurrentStep(STEPS[nextIndex])
    }
  }, [currentStep, getCurrentStepIndex])

  const prevStep = useCallback(() => {
    const currentIndex = getCurrentStepIndex()
    const prevIndex = Math.max(currentIndex - 1, 0)
    setCurrentStep(STEPS[prevIndex])
  }, [getCurrentStepIndex])

  const goToStep = useCallback((step: WizardStep) => {
    const targetIndex = STEPS.indexOf(step)
    const currentIndex = getCurrentStepIndex()
    
    // Allow going to any previous step or next step if current is valid
    if (targetIndex <= currentIndex || getCanProceedForStep(currentStep)) {
      setCurrentStep(step)
    }
  }, [currentStep, getCurrentStepIndex])

  const submitTournament = useCallback(async () => {
    if (!getCanProceedForStep('review')) {
      setErrors({ submit: 'Please complete all required steps' })
      return false
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // SECURITY: Validate all step data before submission
      const basicResult = validateBasicInformation(setupData.basic)
      if (!basicResult.success) {
        setErrors({ submit: 'Please complete basic information step with valid data' })
        return false
      }

      const settingsResult = validateTournamentSettings(setupData.settings)
      if (!settingsResult.success) {
        setErrors({ submit: 'Please complete tournament settings step with valid data' })
        return false
      }

      const playersResult = validatePlayerRegistration(setupData.players)
      if (!playersResult.success) {
        setErrors({ submit: 'Please complete player registration step with valid data' })
        return false
      }

      const bracketResult = validateBracketConfiguration(setupData.bracket)
      if (!bracketResult.success) {
        setErrors({ submit: 'Please complete bracket configuration step with valid data' })
        return false
      }

      // SECURITY: Validate complete setup with cross-field validation
      const completeSetupData = {
        ...basicResult.data,
        ...settingsResult.data,
        ...playersResult.data,
        ...bracketResult.data
      }
      
      const completeValidation = validateCompleteSetup(completeSetupData)
      if (!completeValidation.success) {
        const errorMessages = completeValidation.error.issues.map(err => err.message).join(', ')
        setErrors({ submit: `Validation failed: ${errorMessages}` })
        return false
      }

      // Transform validated data to tournament form data
      const tournamentData: TournamentFormData = {
        name: basicResult.data.name,
        type: basicResult.data.type,
        format: basicResult.data.format,
        maxPoints: settingsResult.data.maxPoints || 13,
        shortForm: settingsResult.data.shortForm || false,
        startDate: basicResult.data.startDate,
        description: basicResult.data.description,
        location: basicResult.data.location,
        organizer: basicResult.data.organizer,
        maxPlayers: settingsResult.data.maxPlayers,
        settings: settingsResult.data.settings || {}
      }

      // Create tournament with players and teams
      const result = await createTournamentSetup({
        tournament: tournamentData,
        players: playersResult.data.players || [],
        teams: playersResult.data.teams || []
      })
      
      if (result.success) {
        // Clear saved data on successful creation
        localStorage.removeItem(STORAGE_KEY)
        
        // SECURITY: Validate navigation route exists
        if (result.data?.id) {
          router.push(`/tournaments/${result.data.id}`)
        } else {
          // Fallback to tournaments list if no ID returned
          router.push('/tournaments')
        }
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
      setErrors({ submit: 'An unexpected error occurred while creating the tournament' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [setupData, router])

  const resetWizard = useCallback(() => {
    setSetupData({})
    setCurrentStep('basic')
    setErrors({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getCompletionPercentage = useCallback(() => {
    const completedSteps = STEPS.slice(0, -1).filter(step => getCanProceedForStep(step)).length
    return Math.round((completedSteps / (STEPS.length - 1)) * 100)
  }, [setupData])

  // Computed values that depend on state - recalculate on every render to ensure freshness
  const currentCanProceed = getCanProceedForStep(currentStep)
  console.log('Hook computed currentCanProceed:', currentCanProceed, 'for step:', currentStep)
  
  const completionPercentage = getCompletionPercentage()
  const currentStepIndex = getCurrentStepIndex()


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
    canProceed: currentCanProceed,
    isFirstStep: currentStep === STEPS[0],
    isLastStep: currentStep === STEPS[STEPS.length - 1],
    completionPercentage,
    currentStepIndex,
    renderTrigger, // Include trigger to force re-renders
  }
}