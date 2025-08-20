'use client'

import { useEffect, useState, useRef } from 'react'
import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { TournamentTypeSelector } from '../tournament-type-selector'
import { Card } from '@/components/ui/card'
import type { BasicInformation as BasicInformationType } from '@/lib/validation/tournament-setup'
import type { TournamentType, GameFormat } from '@/types'

export function BasicInformation() {
  const { setupData, updateStepData } = useTournamentSetup()
  const [formData, setFormData] = useState<Partial<BasicInformationType>>(
    setupData.basic || {}
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initializedRef = useRef(false)

  // Update local state when setupData changes
  useEffect(() => {
    if (setupData.basic) {
      setFormData(setupData.basic)
    }
  }, [setupData.basic])

  // Initialize startDate with default value if not set - run once
  useEffect(() => {
    if (!initializedRef.current && !setupData.basic?.startDate) {
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 1)
      defaultDate.setHours(9, 0, 0, 0)
      const defaultDateString = defaultDate.toISOString()
      
      const newData = { startDate: defaultDateString }
      setFormData(prev => ({ ...prev, ...newData }))
      updateStepData('basic', newData)
      initializedRef.current = true
    }
  }, [setupData.basic, updateStepData])

  const handleInputChange = (field: keyof BasicInformationType, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateStepData('basic', newData)
    
    // Clear field error on change
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleTypeSelect = (type: TournamentType) => {
    const newData = { ...formData, type }
    setFormData(newData)
    updateStepData('basic', newData)
  }

  const handleFormatSelect = (format: GameFormat) => {
    const newData = { ...formData, format }
    setFormData(newData)
    updateStepData('basic', newData)
  }

  // Generate default start date (tomorrow at 9 AM)
  const getDefaultStartDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16) // Format for datetime-local input
  }

  return (
    <div className="space-y-6">
      {/* Tournament Name and Description */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Tournament Details</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Tournament Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Summer Petanque Championship"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                maxLength={100}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="organizer" className="text-sm font-medium">
                Organizer *
              </label>
              <input
                id="organizer"
                type="text"
                value={formData.organizer || ''}
                onChange={(e) => handleInputChange('organizer', e.target.value)}
                placeholder="John Doe / Petanque Club"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                maxLength={100}
              />
              {errors.organizer && (
                <p className="text-sm text-destructive">{errors.organizer}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of the tournament..."
              className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[100px] resize-y"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {(formData.description || '').length}/500 characters
            </p>
          </div>
        </div>
      </Card>

      {/* Tournament Type Selection */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Tournament Format</h3>
          <TournamentTypeSelector
            selectedType={formData.type}
            selectedFormat={formData.format}
            onTypeSelect={handleTypeSelect}
            onFormatSelect={handleFormatSelect}
          />
        </div>
      </Card>

      {/* Date and Location */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Schedule and Location</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="startDate" className="text-sm font-medium">
                Start Date & Time *
              </label>
              <input
                id="startDate"
                type="datetime-local"
                value={formData.startDate ? new Date(formData.startDate).toISOString().slice(0, 16) : getDefaultStartDate()}
                onChange={(e) => handleInputChange('startDate', new Date(e.target.value).toISOString())}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium">
                Location (Optional)
              </label>
              <input
                id="location"
                type="text"
                value={formData.location || ''}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City Park, 123 Main St"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                maxLength={200}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Information Panel */}
      {formData.type && formData.format && (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tournament Summary</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Format:</strong> {formData.type?.replace('-', ' ').split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')} - {formData.format?.charAt(0).toUpperCase() + formData.format?.slice(1)}
              </p>
              {formData.startDate && (
                <p>
                  <strong>Date:</strong> {new Date(formData.startDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
              {formData.location && (
                <p><strong>Location:</strong> {formData.location}</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}