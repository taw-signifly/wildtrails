import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface SetupState {
  basic?: {
    name?: string
    type?: string
    format?: string
    startDate?: string
    organizer?: string
    description?: string
    location?: string
  }
  settings?: any
  players?: any
  bracket?: any
}

interface WizardStore {
  setupData: SetupState
  currentStep: string
  isSubmitting: boolean
  errors: Record<string, string>
  
  updateStepData: (step: string, data: any) => void
  setCurrentStep: (step: string) => void
  setIsSubmitting: (submitting: boolean) => void
  setErrors: (errors: Record<string, string>) => void
  
  getCanProceedForStep: (step: string) => boolean
}

export const useWizardStore = create<WizardStore>()(
  subscribeWithSelector((set, get) => ({
    setupData: {},
    currentStep: 'basic',
    isSubmitting: false,
    errors: {},
    
    updateStepData: (step: string, data: any) => {
      console.log(`Zustand updateStepData: step=${step}`, data)
      set((state) => ({
        setupData: {
          ...state.setupData,
          [step]: { ...state.setupData[step as keyof SetupState], ...data }
        }
      }))
    },
    
    setCurrentStep: (step: string) => set({ currentStep: step }),
    setIsSubmitting: (submitting: boolean) => set({ isSubmitting: submitting }),
    setErrors: (errors: Record<string, string>) => set({ errors }),
    
    getCanProceedForStep: (step: string) => {
      const { setupData } = get()
      switch (step) {
        case 'basic':
          const basic = setupData.basic
          const result = !!(basic?.name && basic.type && basic.format && basic.startDate && basic.organizer)
          console.log('Zustand validation check:', { basic, result })
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
  }))
)