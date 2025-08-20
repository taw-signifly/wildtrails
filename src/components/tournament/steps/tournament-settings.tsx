'use client'

import { useEffect, useState } from 'react'
import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TournamentSettingsForm } from '@/lib/validation/tournament-setup'
import type { TournamentSettings } from '@/types'

export function TournamentSettings() {
  const { setupData, updateStepData } = useTournamentSetup()
  const [formData, setFormData] = useState<Partial<TournamentSettingsForm>>(
    setupData.settings || {}
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (setupData.settings) {
      setFormData(setupData.settings)
    }
  }, [setupData.settings])

  // Initialize default values for required fields
  useEffect(() => {
    const needsDefaults = !formData.maxPoints || !formData.maxPlayers
    if (needsDefaults) {
      const newData = {
        ...formData,
        maxPoints: formData.maxPoints || 13,
        maxPlayers: formData.maxPlayers || getRecommendedMaxPlayers()
      }
      setFormData(newData)
      updateStepData('settings', newData)
    }
  }, [formData.maxPoints, formData.maxPlayers, updateStepData, formData])

  const handleInputChange = (field: keyof TournamentSettingsForm, value: number | boolean) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateStepData('settings', newData)
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSettingChange = (field: keyof TournamentSettings, value: boolean | string) => {
    const newSettings = { ...formData.settings, [field]: value }
    const newData = { ...formData, settings: newSettings }
    setFormData(newData)
    updateStepData('settings', newData)
  }

  const getRecommendedMaxPlayers = () => {
    const tournamentType = setupData.basic?.type
    const gameFormat = setupData.basic?.format
    
    if (!tournamentType || !gameFormat) return 32

    const playersPerTeam = gameFormat === 'singles' ? 1 : gameFormat === 'doubles' ? 2 : 3

    switch (tournamentType) {
      case 'single-elimination':
        return Math.floor(64 / playersPerTeam) * playersPerTeam // Max 64 players (32 teams for doubles)
      case 'double-elimination':
        return Math.floor(32 / playersPerTeam) * playersPerTeam // Max 32 players (16 teams for doubles)
      case 'swiss':
        return Math.floor(64 / playersPerTeam) * playersPerTeam // Max 64 players
      case 'round-robin':
        return Math.floor(16 / playersPerTeam) * playersPerTeam // Max 16 players (8 teams for doubles)
      default:
        return 32
    }
  }

  const getMinPlayers = () => {
    const gameFormat = setupData.basic?.format
    if (!gameFormat) return 4
    
    const playersPerTeam = gameFormat === 'singles' ? 1 : gameFormat === 'doubles' ? 2 : 3
    return playersPerTeam * 4 // At least 4 teams
  }

  return (
    <div className="space-y-6">
      {/* Scoring Configuration */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Scoring Configuration</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="maxPoints" className="text-sm font-medium">
                Points to Win Game
              </label>
              <select
                id="maxPoints"
                value={formData.maxPoints || 13}
                onChange={(e) => handleInputChange('maxPoints', Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value={11}>11 Points (Quick Games)</option>
                <option value={13}>13 Points (Standard)</option>
                <option value={15}>15 Points (Extended)</option>
                <option value={21}>21 Points (Tournament)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Standard Petanque games are played to 13 points
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Game Length</label>
              <div className="flex items-center space-x-3">
                <input
                  id="shortForm"
                  type="checkbox"
                  checked={formData.shortForm || false}
                  onChange={(e) => handleInputChange('shortForm', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="shortForm" className="text-sm cursor-pointer">
                  Enable short-form games (6 ends maximum)
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Short games help tournaments finish on time
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Player Limits */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Player Limits</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="maxPlayers" className="text-sm font-medium flex items-center space-x-2">
                <span>Maximum Players</span>
                <Badge variant="outline" className="text-xs">
                  Recommended: {getRecommendedMaxPlayers()}
                </Badge>
              </label>
              <input
                id="maxPlayers"
                type="number"
                value={formData.maxPlayers || getRecommendedMaxPlayers()}
                onChange={(e) => handleInputChange('maxPlayers', Number(e.target.value))}
                min={getMinPlayers()}
                max={200}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Minimum {getMinPlayers()} players required for {setupData.basic?.format} format
              </p>
              {errors.maxPlayers && (
                <p className="text-sm text-destructive">{errors.maxPlayers}</p>
              )}
            </div>

            {/* Format-specific info */}
            {setupData.basic?.format && (
              <Card className="p-3 bg-muted/50">
                <div className="text-sm space-y-1">
                  <p className="font-medium">
                    {setupData.basic.format.charAt(0).toUpperCase() + setupData.basic.format.slice(1)} Format
                  </p>
                  <p className="text-muted-foreground">
                    Players per team: {
                      setupData.basic.format === 'singles' ? 1 
                      : setupData.basic.format === 'doubles' ? 2 
                      : 3
                    }
                  </p>
                  <p className="text-muted-foreground">
                    Teams with {formData.maxPlayers || getRecommendedMaxPlayers()} players: {
                      Math.floor((formData.maxPlayers || getRecommendedMaxPlayers()) / (
                        setupData.basic.format === 'singles' ? 1 
                        : setupData.basic.format === 'doubles' ? 2 
                        : 3
                      ))
                    }
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>

      {/* Tournament Management Settings */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Tournament Management</h3>
          
          <div className="space-y-4">
            {/* Registration Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Registration</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    id="allowLateRegistration"
                    type="checkbox"
                    checked={formData.settings?.allowLateRegistration || false}
                    onChange={(e) => handleSettingChange('allowLateRegistration', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="allowLateRegistration" className="text-sm cursor-pointer">
                    Allow late registration during tournament
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    id="requireCheckin"
                    type="checkbox"
                    checked={formData.settings?.requireCheckin || false}
                    onChange={(e) => handleSettingChange('requireCheckin', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="requireCheckin" className="text-sm cursor-pointer">
                    Require player check-in before tournament starts
                  </label>
                </div>
              </div>
            </div>

            {/* Bracket Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Bracket Management</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    id="automaticBracketGeneration"
                    type="checkbox"
                    checked={formData.settings?.automaticBracketGeneration !== false}
                    onChange={(e) => handleSettingChange('automaticBracketGeneration', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="automaticBracketGeneration" className="text-sm cursor-pointer">
                    Automatically generate bracket when tournament starts
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Court Assignment</label>
                  <select
                    value={formData.settings?.courtAssignmentMode || 'manual'}
                    onChange={(e) => handleSettingChange('courtAssignmentMode', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="manual">Manual assignment</option>
                    <option value="automatic">Automatic assignment</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scoring Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Scoring & Updates</h4>
              <div className="space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Scoring Method</label>
                  <select
                    value={formData.settings?.scoringMode || 'self-report'}
                    onChange={(e) => handleSettingChange('scoringMode', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="self-report">Self-reported by players</option>
                    <option value="official-only">Official scorers only</option>
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    id="realTimeUpdates"
                    type="checkbox"
                    checked={formData.settings?.realTimeUpdates !== false}
                    onChange={(e) => handleSettingChange('realTimeUpdates', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="realTimeUpdates" className="text-sm cursor-pointer">
                    Enable real-time score updates
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    id="allowSpectators"
                    type="checkbox"
                    checked={formData.settings?.allowSpectators !== false}
                    onChange={(e) => handleSettingChange('allowSpectators', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="allowSpectators" className="text-sm cursor-pointer">
                    Allow spectator access to live scores
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Settings Summary */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Configuration Summary</h4>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Game Format:</strong> {formData.maxPoints || 13} points
                {formData.shortForm ? ' (short form)' : ''}
              </div>
              <div>
                <strong>Max Players:</strong> {formData.maxPlayers || getRecommendedMaxPlayers()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Registration:</strong> {
                  formData.settings?.allowLateRegistration ? 'Open during tournament' : 'Closed at start'
                }
              </div>
              <div>
                <strong>Scoring:</strong> {
                  formData.settings?.scoringMode === 'official-only' ? 'Official only' : 'Self-reported'
                }
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}