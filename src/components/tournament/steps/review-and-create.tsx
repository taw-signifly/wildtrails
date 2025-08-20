'use client'

import { useTournamentSetup } from '@/hooks/use-tournament-setup'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ReviewAndCreate() {
  const { setupData, goToStep, errors } = useTournamentSetup()

  const getPlayerCount = () => setupData.players?.players?.length || 0
  const getTeamCount = () => {
    const format = setupData.basic?.format
    const playersPerTeam = format === 'singles' ? 1 : format === 'doubles' ? 2 : 3
    return Math.floor(getPlayerCount() / playersPerTeam)
  }

  const getEstimatedDuration = () => {
    const teamCount = getTeamCount()
    const tournamentType = setupData.basic?.type
    const avgMatchDuration = setupData.settings?.shortForm ? 45 : 60

    let totalMatches = 0
    switch (tournamentType) {
      case 'single-elimination':
        totalMatches = teamCount - 1
        break
      case 'double-elimination':
        totalMatches = teamCount * 2 - 2
        break
      case 'round-robin':
        totalMatches = (teamCount * (teamCount - 1)) / 2
        break
      case 'swiss':
        const rounds = Math.min(Math.ceil(Math.log2(teamCount)), 7)
        totalMatches = Math.floor(teamCount / 2) * rounds
        break
      default:
        totalMatches = teamCount - 1
    }

    const totalMinutes = totalMatches * avgMatchDuration
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return `${hours}h ${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  const formatTournamentType = (type?: string) => {
    if (!type) return 'Not specified'
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const formatGameFormat = (format?: string) => {
    if (!format) return 'Not specified'
    return format.charAt(0).toUpperCase() + format.slice(1)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Tournament Overview */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{setupData.basic?.name || 'Unnamed Tournament'}</h3>
            <Button variant="outline" onClick={() => goToStep('basic')}>
              Edit
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Tournament Type</p>
              <p className="text-muted-foreground">{formatTournamentType(setupData.basic?.type)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Game Format</p>
              <p className="text-muted-foreground">{formatGameFormat(setupData.basic?.format)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Start Date</p>
              <p className="text-muted-foreground">{formatDate(setupData.basic?.startDate)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Organizer</p>
              <p className="text-muted-foreground">{setupData.basic?.organizer || 'Not specified'}</p>
            </div>
          </div>

          {setupData.basic?.description && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Description</p>
              <p className="text-muted-foreground">{setupData.basic.description}</p>
            </div>
          )}

          {setupData.basic?.location && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Location</p>
              <p className="text-muted-foreground">{setupData.basic.location}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tournament Configuration */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Tournament Settings</h3>
            <Button variant="outline" onClick={() => goToStep('settings')}>
              Edit
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Points to Win</p>
              <p className="text-muted-foreground">
                {setupData.settings?.maxPoints || 13} points
                {setupData.settings?.shortForm ? ' (short form)' : ''}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Max Players</p>
              <p className="text-muted-foreground">{setupData.settings?.maxPlayers || 'Not set'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Estimated Duration</p>
              <p className="text-muted-foreground">{getEstimatedDuration()}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Court Assignment</p>
              <p className="text-muted-foreground">
                {setupData.settings?.settings?.courtAssignmentMode === 'automatic' ? 'Automatic' : 'Manual'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Scoring Method</p>
              <p className="text-muted-foreground">
                {setupData.settings?.settings?.scoringMode === 'official-only' ? 'Official Only' : 'Self-reported'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {setupData.settings?.settings?.allowLateRegistration && (
              <Badge variant="outline">Late Registration Allowed</Badge>
            )}
            {setupData.settings?.settings?.requireCheckin && (
              <Badge variant="outline">Check-in Required</Badge>
            )}
            {setupData.settings?.settings?.realTimeUpdates && (
              <Badge variant="outline">Real-time Updates</Badge>
            )}
            {setupData.settings?.settings?.allowSpectators && (
              <Badge variant="outline">Spectator Access</Badge>
            )}
            {setupData.settings?.settings?.automaticBracketGeneration && (
              <Badge variant="outline">Auto Bracket Generation</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Players & Teams */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Players & Teams</h3>
            <Button variant="outline" onClick={() => goToStep('players')}>
              Edit
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{getPlayerCount()}</div>
              <div className="text-sm text-muted-foreground">Players Registered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{getTeamCount()}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{setupData.players?.teams?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Custom Teams</div>
            </div>
          </div>

          {setupData.players?.players && setupData.players.players.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Sample Players</p>
              <div className="flex flex-wrap gap-2">
                {setupData.players.players.slice(0, 5).map((player, index) => (
                  <Badge key={index} variant="outline">
                    {player.firstName} {player.lastName}
                  </Badge>
                ))}
                {setupData.players.players.length > 5 && (
                  <Badge variant="outline">
                    +{setupData.players.players.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {setupData.players?.teams && setupData.players.teams.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Custom Teams</p>
              <div className="flex flex-wrap gap-2">
                {setupData.players.teams.slice(0, 5).map((team, index) => (
                  <Badge key={index} variant="outline">
                    {team.name} ({team.players.length})
                  </Badge>
                ))}
                {setupData.players.teams.length > 5 && (
                  <Badge variant="outline">
                    +{setupData.players.teams.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Bracket Configuration */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Bracket Configuration</h3>
            <Button variant="outline" onClick={() => goToStep('bracket')}>
              Edit
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Seeding Method</p>
              <p className="text-muted-foreground">
                {setupData.bracket?.seedingType ? setupData.bracket.seedingType.charAt(0).toUpperCase() + setupData.bracket.seedingType.slice(1) : 'Random'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Bye Handling</p>
              <p className="text-muted-foreground">
                {setupData.bracket?.allowByes !== false ? 'Allowed' : 'Not allowed'}
              </p>
            </div>
          </div>

          {getTeamCount() > 0 && (
            <Card className="p-3 bg-muted/50">
              <div className="text-sm">
                <p><strong>Tournament Structure:</strong></p>
                <p>• {getTeamCount()} teams competing</p>
                <p>• {formatTournamentType(setupData.basic?.type)} format</p>
                {setupData.basic?.type === 'single-elimination' && (
                  <p>• {Math.ceil(Math.log2(getTeamCount()))} elimination rounds</p>
                )}
                {setupData.basic?.type === 'round-robin' && (
                  <p>• {getTeamCount() - 1} rounds (everyone plays everyone)</p>
                )}
                {setupData.basic?.type === 'swiss' && (
                  <p>• {Math.min(Math.ceil(Math.log2(getTeamCount())), 7)} Swiss rounds</p>
                )}
                <p>• Approximately {getEstimatedDuration()} total duration</p>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* Validation Issues */}
      {Object.keys(errors).length > 0 && (
        <Card className="p-6 bg-destructive/5 border-destructive/20">
          <div className="space-y-2">
            <h3 className="font-medium text-destructive">Issues to Resolve</h3>
            <div className="space-y-1">
              {Object.entries(errors).map(([key, error]) => (
                <p key={key} className="text-sm text-destructive">
                  • {error}
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Final Checklist */}
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="space-y-4">
          <h3 className="font-medium text-green-900">Ready to Create Tournament</h3>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${setupData.basic?.name ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Tournament details configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${setupData.settings?.maxPlayers ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Tournament settings configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${getPlayerCount() >= 4 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Minimum players registered ({getPlayerCount()}/4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${setupData.bracket?.seedingType ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Bracket configuration set</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-green-300 rounded-md">
            <p className="text-sm text-green-800">
              <strong>Next Steps:</strong> After creating the tournament, you&apos;ll be able to manage courts, 
              start matches, track live scores, and monitor the tournament progress in real-time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}