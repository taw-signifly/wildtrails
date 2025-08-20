'use client'

import { useEffect, useState } from 'react'
import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { BracketPreview } from '../bracket-preview'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BracketConfiguration as BracketConfigurationType } from '@/lib/validation/tournament-setup'

export function BracketConfiguration() {
  const { setupData, updateStepData } = useTournamentSetup()
  const [formData, setFormData] = useState<Partial<BracketConfigurationType>>(
    setupData.bracket || { seedingType: 'random', allowByes: true }
  )

  useEffect(() => {
    if (setupData.bracket) {
      setFormData(setupData.bracket)
    }
  }, [setupData.bracket])

  const handleInputChange = (field: keyof BracketConfigurationType, value: string | boolean) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateStepData('bracket', newData)
  }

  const getTotalTeams = () => {
    const players = setupData.players?.players || []
    const format = setupData.basic?.format
    const playersPerTeam = format === 'singles' ? 1 : format === 'doubles' ? 2 : 3
    return Math.floor(players.length / playersPerTeam)
  }

  const getRequiredRounds = () => {
    const totalTeams = getTotalTeams()
    const tournamentType = setupData.basic?.type
    
    switch (tournamentType) {
      case 'single-elimination':
        return Math.ceil(Math.log2(totalTeams))
      case 'double-elimination':
        return Math.ceil(Math.log2(totalTeams)) + Math.ceil(Math.log2(totalTeams)) - 1
      case 'round-robin':
        return totalTeams - 1
      case 'swiss':
        return Math.min(Math.ceil(Math.log2(totalTeams)), 7) // Typically 5-7 rounds
      default:
        return Math.ceil(Math.log2(totalTeams))
    }
  }

  const getEstimatedDuration = () => {
    const totalTeams = getTotalTeams()
    const rounds = getRequiredRounds()
    const avgMatchDuration = setupData.settings?.shortForm ? 45 : 60 // minutes
    const tournamentType = setupData.basic?.type
    
    let totalMatches = 0
    switch (tournamentType) {
      case 'single-elimination':
        totalMatches = totalTeams - 1
        break
      case 'double-elimination':
        totalMatches = totalTeams * 2 - 2
        break
      case 'round-robin':
        totalMatches = (totalTeams * (totalTeams - 1)) / 2
        break
      case 'swiss':
        totalMatches = Math.floor(totalTeams / 2) * rounds
        break
      default:
        totalMatches = totalTeams - 1
    }

    const totalMinutes = totalMatches * avgMatchDuration
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return `${hours}h ${minutes}m`
  }

  const willHaveByes = () => {
    const totalTeams = getTotalTeams()
    const tournamentType = setupData.basic?.type
    
    if (tournamentType === 'round-robin' || tournamentType === 'swiss') {
      return totalTeams % 2 !== 0
    }
    
    // For elimination tournaments, need power of 2
    return !Number.isInteger(Math.log2(totalTeams))
  }

  const getNextPowerOfTwo = (n: number) => {
    return Math.pow(2, Math.ceil(Math.log2(n)))
  }

  return (
    <div className="space-y-6">
      {/* Tournament Summary */}
      <Card className="p-4">
        <div className="space-y-3">
          <h3 className="font-medium">Tournament Overview</h3>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{getTotalTeams()}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{getRequiredRounds()}</div>
              <div className="text-sm text-muted-foreground">Rounds</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{getEstimatedDuration()}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
          </div>

          {willHaveByes() && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> With {getTotalTeams()} teams, some teams will receive byes.
                {setupData.basic?.type === 'single-elimination' || setupData.basic?.type === 'double-elimination' ? (
                  ` The bracket will be expanded to ${getNextPowerOfTwo(getTotalTeams())} slots.`
                ) : (
                  ' Bye assignments will be rotated fairly.'
                )}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Seeding Configuration */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Seeding & Bracket Setup</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seeding Method</label>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="random"
                    name="seedingType"
                    value="random"
                    checked={formData.seedingType === 'random'}
                    onChange={(e) => handleInputChange('seedingType', e.target.value)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="random" className="text-sm cursor-pointer">
                    <strong>Random Seeding</strong> - Teams placed randomly in bracket
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="ranked"
                    name="seedingType"
                    value="ranked"
                    checked={formData.seedingType === 'ranked'}
                    onChange={(e) => handleInputChange('seedingType', e.target.value)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="ranked" className="text-sm cursor-pointer">
                    <strong>Ranked Seeding</strong> - Teams seeded by player rankings (if available)
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="manual"
                    name="seedingType"
                    value="manual"
                    checked={formData.seedingType === 'manual'}
                    onChange={(e) => handleInputChange('seedingType', e.target.value)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="manual" className="text-sm cursor-pointer">
                    <strong>Manual Seeding</strong> - You&apos;ll arrange teams in bracket manually
                  </label>
                </div>
              </div>

              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  {formData.seedingType === 'random' && 
                    'Teams will be randomly placed in the bracket. Good for casual tournaments.'}
                  {formData.seedingType === 'ranked' && 
                    'Teams will be seeded based on average player rankings. Ensures top teams don&apos;t meet early.'}
                  {formData.seedingType === 'manual' && 
                    'You can manually arrange teams after creation. Best for tournaments with known skill levels.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  id="allowByes"
                  type="checkbox"
                  checked={formData.allowByes !== false}
                  onChange={(e) => handleInputChange('allowByes', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="allowByes" className="text-sm cursor-pointer">
                  Allow bye assignments when needed
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Byes give teams automatic advancement to the next round when numbers don&apos;t divide evenly.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Court Assignment (placeholder) */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Court Assignment</h3>
          
          <div className="p-4 bg-muted/30 border border-dashed rounded-md text-center">
            <p className="text-sm text-muted-foreground">
              Court management will be available after tournament creation.
            </p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>After creating the tournament, you can:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Add and manage available courts</li>
              <li>Assign specific courts to matches</li>
              <li>Set up automatic court rotation</li>
              <li>Handle court conflicts and delays</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Bracket Preview */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Bracket Preview</h3>
          
          <BracketPreview
            tournamentType={setupData.basic?.type}
            totalTeams={getTotalTeams()}
            seedingType={formData.seedingType}
            teams={setupData.players?.teams || []}
            players={setupData.players?.players || []}
          />
        </div>
      </Card>

      {/* Configuration Summary */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Bracket Configuration Summary</h4>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Tournament Type:</strong> {setupData.basic?.type?.replace('-', ' ').split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </div>
              <div>
                <strong>Seeding:</strong> {formData.seedingType?.charAt(0).toUpperCase() + formData.seedingType?.slice(1)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Teams:</strong> {getTotalTeams()}
                {willHaveByes() && <Badge variant="outline" className="ml-2 text-xs">Byes Required</Badge>}
              </div>
              <div>
                <strong>Estimated Time:</strong> {getEstimatedDuration()}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}