'use client'

import { useEffect, useState } from 'react'
import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TeamFormationInterface } from '../team-formation'
import type { PlayerRegistration as PlayerRegistrationType, PlayerEntry } from '@/lib/validation/tournament-setup'
import { PlayerEntrySchema } from '@/lib/validation/tournament-setup'

export function PlayerRegistration() {
  const { setupData, updateStepData } = useTournamentSetup()
  const [formData, setFormData] = useState<Partial<PlayerRegistrationType>>(
    setupData.players || { players: [] }
  )
  const [newPlayer, setNewPlayer] = useState<Partial<PlayerEntry>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddPlayer, setShowAddPlayer] = useState(false)

  useEffect(() => {
    if (setupData.players) {
      setFormData(setupData.players)
    }
  }, [setupData.players])

  const handleAddPlayer = () => {
    // Basic required field validation
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.email) {
      setErrors({ add: 'First name, last name, and email are required' })
      return
    }

    // SECURITY: Input sanitization function
    const sanitizeInput = (input: string): string => {
      return input
        .trim()
        .replace(/[<>\"'&]/g, '') // Basic XSS prevention
        .substring(0, 100) // Length limit
    }

    // SECURITY: Validate email format with proper regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const sanitizedEmail = newPlayer.email.trim().toLowerCase()
    if (!emailRegex.test(sanitizedEmail)) {
      setErrors({ add: 'Please enter a valid email address' })
      return
    }

    // Check for duplicate email
    const existingPlayer = formData.players?.find(p => p.email === sanitizedEmail)
    if (existingPlayer) {
      setErrors({ add: 'A player with this email already exists' })
      return
    }

    // SECURITY: Create player with sanitized inputs
    const playerData: Partial<PlayerEntry> = {
      firstName: sanitizeInput(newPlayer.firstName),
      lastName: sanitizeInput(newPlayer.lastName),
      email: sanitizedEmail,
      phone: newPlayer.phone ? sanitizeInput(newPlayer.phone) : undefined,
      club: newPlayer.club ? sanitizeInput(newPlayer.club) : undefined,
      ranking: newPlayer.ranking
    }

    // SECURITY: Validate with Zod schema before adding
    const validationResult = PlayerEntrySchema.safeParse(playerData)
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues.map(err => err.message).join(', ')
      setErrors({ add: `Validation failed: ${errorMessages}` })
      return
    }

    const player = validationResult.data
    const updatedPlayers = [...(formData.players || []), player]
    const newData = { ...formData, players: updatedPlayers }
    setFormData(newData)
    updateStepData('players', newData)

    // Reset form
    setNewPlayer({})
    setErrors({})
    setShowAddPlayer(false)
  }

  const handleRemovePlayer = (index: number) => {
    const updatedPlayers = formData.players?.filter((_, i) => i !== index) || []
    const newData = { ...formData, players: updatedPlayers }
    setFormData(newData)
    updateStepData('players', newData)
  }

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // SECURITY: File size validation (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    if (file.size > MAX_FILE_SIZE) {
      setErrors({ import: 'File size must be less than 5MB' })
      event.target.value = ''
      return
    }

    // SECURITY: MIME type validation
    const allowedTypes = ['text/csv', 'application/json', 'text/plain']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|json)$/i)) {
      setErrors({ import: 'Invalid file type. Only CSV and JSON files are allowed.' })
      event.target.value = ''
      return
    }

    try {
      const text = await file.text()
      
      // SECURITY: Content length validation after read
      const MAX_CONTENT_LENGTH = 1024 * 1024 // 1MB text limit
      if (text.length > MAX_CONTENT_LENGTH) {
        setErrors({ import: 'File content too large. Maximum 1MB of text allowed.' })
        event.target.value = ''
        return
      }

      let players: Partial<PlayerEntry>[] = []

      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(text)
          // SECURITY: Validate JSON structure
          if (!Array.isArray(data) && typeof data !== 'object') {
            throw new Error('Invalid JSON structure')
          }
          players = Array.isArray(data) ? data : [data]
        } catch {
          setErrors({ import: 'Invalid JSON format. Please check the file structure.' })
          event.target.value = ''
          return
        }
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        // SECURITY: Improved CSV parsing with injection protection
        const lines = text.split('\n').filter(line => line.trim()).slice(0, 1000) // Limit rows to prevent DoS
        if (lines.length === 0) {
          setErrors({ import: 'Empty CSV file' })
          event.target.value = ''
          return
        }

        const headers = lines[0].toLowerCase().split(',').map(h => 
          h.trim().replace(/[^a-z_\s]/g, '').replace(/\s+/g, '_') // Sanitize headers
        )
        
        players = lines.slice(1).map(line => {
          // SECURITY: Prevent CSV injection
          if (line.trim().startsWith('=') || line.trim().startsWith('+') || 
              line.trim().startsWith('-') || line.trim().startsWith('@')) {
            return null // Skip potentially malicious rows
          }
          
          const values = line.split(',').map(v => 
            v.trim().replace(/"/g, '').substring(0, 100) // Limit field length
          )
          const player: Partial<PlayerEntry> = {}
          
          headers.forEach((header, index) => {
            const value = values[index]
            if (!value || value.length === 0) return
            
            // SECURITY: Sanitize input values
            const sanitizedValue = value.replace(/[<>\"'&]/g, '').trim() // Basic XSS prevention
            
            switch (header) {
              case 'firstname':
              case 'first_name':
              case 'first_name':
                if (sanitizedValue.length > 0 && sanitizedValue.length <= 50) {
                  player.firstName = sanitizedValue
                }
                break
              case 'lastname':
              case 'last_name':
              case 'last_name':
                if (sanitizedValue.length > 0 && sanitizedValue.length <= 50) {
                  player.lastName = sanitizedValue
                }
                break
              case 'email':
                // Validate email format before assignment
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (emailRegex.test(sanitizedValue)) {
                  player.email = sanitizedValue.toLowerCase()
                }
                break
              case 'phone':
                if (sanitizedValue.length <= 20) {
                  player.phone = sanitizedValue
                }
                break
              case 'club':
                if (sanitizedValue.length <= 100) {
                  player.club = sanitizedValue
                }
                break
              case 'ranking':
                const rankingNum = parseInt(sanitizedValue)
                if (!isNaN(rankingNum) && rankingNum >= 1 && rankingNum <= 1000) {
                  player.ranking = rankingNum
                }
                break
            }
          })
          
          return player
        }).filter(Boolean) as Partial<PlayerEntry>[] // Remove null entries
      } else {
        setErrors({ import: 'Unsupported file format. Please use CSV or JSON files.' })
        event.target.value = ''
        return
      }

      // SECURITY: Validate all imported data with Zod schemas
      const validationResults = players.map(player => {
        const result = PlayerEntrySchema.safeParse(player)
        return { player, result }
      })

      const validPlayers = validationResults
        .filter(({ result }) => result.success)
        .map(({ result }) => result.data!)
        .filter(player => !formData.players?.some(existing => existing.email === player.email)) // Remove duplicates

      const invalidCount = players.length - validPlayers.length
      
      if (validPlayers.length === 0) {
        const errorMsg = invalidCount > 0 
          ? `No valid players found. ${invalidCount} entries failed validation.`
          : 'No valid players found in file. Please check the format and required fields.'
        setErrors({ import: errorMsg })
        event.target.value = ''
        return
      }

      // Limit total players to prevent memory issues
      const maxTotalPlayers = setupData.settings?.maxPlayers || 200
      const currentPlayerCount = formData.players?.length || 0
      const playersToAdd = validPlayers.slice(0, Math.max(0, maxTotalPlayers - currentPlayerCount))
      
      if (playersToAdd.length < validPlayers.length) {
        setErrors({ 
          import: `Imported ${playersToAdd.length} players (${validPlayers.length - playersToAdd.length} skipped due to player limit)` 
        })
      } else {
        let message = `Successfully imported ${playersToAdd.length} players`
        if (invalidCount > 0) {
          message += ` (${invalidCount} entries skipped due to validation errors)`
        }
        setErrors({ import: message })
      }

      const updatedPlayers = [...(formData.players || []), ...playersToAdd]
      const newData = { ...formData, players: updatedPlayers }
      setFormData(newData)
      updateStepData('players', newData)

    } catch (error) {
      console.error('File import error:', error)
      setErrors({ import: 'Failed to process file. Please check the format and try again.' })
    }

    // Reset file input
    event.target.value = ''
  }

  const getMinPlayers = () => {
    const gameFormat = setupData.basic?.format
    if (!gameFormat) return 4
    
    const playersPerTeam = gameFormat === 'singles' ? 1 : gameFormat === 'doubles' ? 2 : 3
    return playersPerTeam * 4 // At least 4 teams
  }

  const getPlayersPerTeam = () => {
    const gameFormat = setupData.basic?.format
    return gameFormat === 'singles' ? 1 : gameFormat === 'doubles' ? 2 : 3
  }

  const handleTeamFormation = (teams: { id: string; name: string; players: string[] }[]) => {
    const newData = { ...formData, teams }
    setFormData(newData)
    updateStepData('players', newData)
  }

  return (
    <div className="space-y-6">
      {/* Player Count Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Players Registered</h3>
            <p className="text-sm text-muted-foreground">
              {formData.players?.length || 0} of {setupData.settings?.maxPlayers || 32} maximum
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant={
              (formData.players?.length || 0) >= getMinPlayers() ? 'default' : 'destructive'
            }>
              {(formData.players?.length || 0) >= getMinPlayers() ? 'Ready' : `Need ${getMinPlayers() - (formData.players?.length || 0)} more`}
            </Badge>
            <div className="text-right text-sm">
              <div className="font-medium">{formData.players?.length || 0}</div>
              <div className="text-muted-foreground">players</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Import Options */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-medium">Add Players</h3>
          
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddPlayer(!showAddPlayer)}
            >
              Add Individual Player
            </Button>
            
            <div>
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleBulkImport}
                className="hidden"
                id="bulk-import"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('bulk-import')?.click()}
              >
                Import from File (CSV/JSON)
              </Button>
            </div>
          </div>

          {errors.import && (
            <div className={`p-3 rounded-md text-sm ${
              errors.import.includes('Successfully') 
                ? 'bg-green-50 text-green-800' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {errors.import}
            </div>
          )}
        </div>
      </Card>

      {/* Add Player Form */}
      {showAddPlayer && (
        <Card className="p-4">
          <div className="space-y-4">
            <h4 className="font-medium">Add New Player</h4>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <input
                  type="text"
                  value={newPlayer.firstName || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name *</label>
                <input
                  type="text"
                  value={newPlayer.lastName || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={newPlayer.email || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={newPlayer.phone || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Club</label>
                <input
                  type="text"
                  value={newPlayer.club || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, club: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="Local Petanque Club"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ranking</label>
                <input
                  type="number"
                  value={newPlayer.ranking || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, ranking: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="1-1000"
                  min={1}
                  max={1000}
                />
              </div>
            </div>

            {errors.add && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {errors.add}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddPlayer(false)
                  setNewPlayer({})
                  setErrors({})
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddPlayer}>
                Add Player
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Players List */}
      {formData.players && formData.players.length > 0 && (
        <Card className="p-4">
          <div className="space-y-4">
            <h3 className="font-medium">Registered Players</h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formData.players.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground space-x-2">
                      <span>{player.email}</span>
                      {player.club && <span>• {player.club}</span>}
                      {player.ranking && <span>• Rank #{player.ranking}</span>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemovePlayer(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Team Formation */}
      {formData.players && formData.players.length >= getMinPlayers() && getPlayersPerTeam() > 1 && (
        <Card className="p-4">
          <div className="space-y-4">
            <h3 className="font-medium">Team Formation</h3>
            <p className="text-sm text-muted-foreground">
              {setupData.basic?.format ? setupData.basic.format.charAt(0).toUpperCase() + setupData.basic.format.slice(1) : 'Selected'} format requires {getPlayersPerTeam()} players per team
            </p>
            
            <TeamFormationInterface
              players={formData.players}
              playersPerTeam={getPlayersPerTeam()}
              existingTeams={formData.teams || []}
              onTeamsChange={handleTeamFormation}
            />
          </div>
        </Card>
      )}

      {/* Import Instructions */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Import File Format</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>CSV:</strong> Include headers: first_name, last_name, email, phone, club, ranking</p>
            <p><strong>JSON:</strong> Array of objects with: firstName, lastName, email, phone, club, ranking</p>
            <p>Email addresses must be unique. Duplicate emails will be skipped.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}