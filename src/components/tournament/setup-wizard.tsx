'use client'

import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

// Step components
import { BasicInformation } from './steps/basic-information'
import { TournamentSettings } from './steps/tournament-settings'
import { PlayerRegistration } from './steps/player-registration'
import { BracketConfiguration } from './steps/bracket-configuration'
import { ReviewAndCreate } from './steps/review-and-create'

export function TournamentSetupWizard() {
  const {
    currentStep,
    steps,
    currentStepIndex,
    completionPercentage,
    canProceed,
    isFirstStep,
    isLastStep,
    isSubmitting,
    errors,
    nextStep,
    prevStep,
    goToStep,
    submitTournament,
    resetWizard,
  } = useTournamentSetup()

  const getStepTitle = (step: string) => {
    switch (step) {
      case 'basic': return 'Basic Information'
      case 'settings': return 'Tournament Settings'
      case 'players': return 'Player Registration'
      case 'bracket': return 'Bracket Configuration'
      case 'review': return 'Review & Create'
      default: return step
    }
  }

  const getStepDescription = (step: string) => {
    switch (step) {
      case 'basic': return 'Set tournament name, type, format, and basic details'
      case 'settings': return 'Configure scoring, limits, and tournament options'
      case 'players': return 'Add players and form teams for the tournament'
      case 'bracket': return 'Set seeding options and bracket configuration'
      case 'review': return 'Review all settings and create your tournament'
      default: return ''
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'basic':
        return <BasicInformation />
      case 'settings':
        return <TournamentSettings />
      case 'players':
        return <PlayerRegistration />
      case 'bracket':
        return <BracketConfiguration />
      case 'review':
        return <ReviewAndCreate />
      default:
        return null
    }
  }

  const handleSubmit = async () => {
    if (isLastStep) {
      await submitTournament()
    } else {
      nextStep()
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Tournament Setup Progress
            </h2>
            <Badge variant="outline">
              {completionPercentage}% Complete
            </Badge>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <button
                key={step}
                onClick={() => goToStep(step)}
                className={`flex flex-col items-center space-y-1 text-xs transition-colors
                  ${index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'}
                  ${index < currentStepIndex ? 'cursor-pointer hover:text-primary/80' : ''}
                  ${index > currentStepIndex ? 'cursor-not-allowed' : ''}
                `}
                disabled={index > currentStepIndex}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                  ${index < currentStepIndex 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : index === currentStepIndex 
                      ? 'border-primary text-primary' 
                      : 'border-muted-foreground text-muted-foreground'
                  }`}>
                  {index < currentStepIndex ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="hidden sm:block text-center max-w-20">
                  {getStepTitle(step)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Step Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {getStepTitle(currentStep)}
            </h1>
            <p className="text-muted-foreground">
              {getStepDescription(currentStep)}
            </p>
          </div>

          <Separator />

          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderCurrentStep()}
          </div>

          {/* Error Display */}
          {errors.submit && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-md">
              <p className="text-sm text-destructive font-medium">
                {errors.submit}
              </p>
            </div>
          )}

          <Separator />

          {/* Navigation */}
          <div className="flex justify-between">
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={isFirstStep}
              >
                Previous
              </Button>
              
              <Button
                variant="ghost"
                onClick={resetWizard}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            </div>

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
          </div>
        </div>
      </Card>
    </div>
  )
}