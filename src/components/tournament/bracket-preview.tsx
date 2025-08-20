'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TournamentType } from '@/types'
import type { PlayerEntry } from '@/lib/validation/tournament-setup'

interface Team {
  id: string
  name: string
  players: string[]
}

interface Props {
  tournamentType?: TournamentType
  totalTeams: number
  seedingType?: 'random' | 'ranked' | 'manual'
  teams: Team[]
  players: PlayerEntry[]
}

export function BracketPreview({
  tournamentType,
  totalTeams,
  seedingType = 'random',
  teams,
  players
}: Props) {
  const getPlayerName = (email: string) => {
    const player = players.find(p => p.email === email)
    return player ? `${player.firstName} ${player.lastName}` : email
  }

  const generatePreviewTeams = () => {
    if (teams.length > 0) {
      // Use actual teams if they exist
      return teams.slice(0, Math.min(teams.length, totalTeams))
    }

    // Generate mock teams from individual players
    const mockTeams: Team[] = []
    const usedPlayers = new Set<string>()
    
    let teamCount = 1
    for (let i = 0; i < Math.min(totalTeams, 8); i++) {
      const availablePlayers = players.filter(p => !usedPlayers.has(p.email))
      if (availablePlayers.length === 0) break

      const teamPlayers = [availablePlayers[0].email]
      usedPlayers.add(availablePlayers[0].email)

      mockTeams.push({
        id: `preview-team-${teamCount}`,
        name: `Team ${teamCount}`,
        players: teamPlayers
      })
      teamCount++
    }

    return mockTeams
  }

  const previewTeams = generatePreviewTeams()

  if (!tournamentType || totalTeams === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Complete previous steps to see bracket preview</p>
      </div>
    )
  }

  const renderSingleElimination = () => {
    const rounds = Math.ceil(Math.log2(totalTeams))
    const bracketSize = Math.pow(2, rounds)
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Single Elimination Bracket</h4>
          <Badge variant="outline">
            {rounds} rounds • {totalTeams} teams
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <div className="flex space-x-8 min-w-fit">
            {/* Round 1 */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-center">Round 1</h5>
              <div className="space-y-4">
                {Array.from({ length: Math.ceil(bracketSize / 2) }).map((_, matchIndex) => {
                  const team1 = previewTeams[matchIndex * 2]
                  const team2 = previewTeams[matchIndex * 2 + 1]
                  
                  return (
                    <Card key={matchIndex} className="p-3 w-48">
                      <div className="space-y-2">
                        <div className={`text-sm ${team1 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {team1 ? (
                            <div>
                              <div>{team1.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {team1.players.map(email => getPlayerName(email)).join(', ')}
                              </div>
                            </div>
                          ) : (
                            'BYE'
                          )}
                        </div>
                        <hr />
                        <div className={`text-sm ${team2 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {team2 ? (
                            <div>
                              <div>{team2.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {team2.players.map(email => getPlayerName(email)).join(', ')}
                              </div>
                            </div>
                          ) : (
                            'BYE'
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Subsequent rounds (placeholder) */}
            {rounds > 1 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-center">Round 2</h5>
                <div className="space-y-6">
                  {Array.from({ length: Math.ceil(bracketSize / 4) }).map((_, roundIndex) => (
                    <Card key={roundIndex} className="p-3 w-48">
                      <div className="text-center text-muted-foreground text-sm">
                        Winner R1-{roundIndex * 2 + 1}
                        <hr className="my-2" />
                        Winner R1-{roundIndex * 2 + 2}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {rounds > 2 && (
              <div className="space-y-2 flex flex-col items-center justify-center">
                <Badge variant="outline">...</Badge>
                <p className="text-xs text-muted-foreground text-center">
                  {rounds - 2} more rounds
                </p>
              </div>
            )}

            {/* Final */}
            <div className="space-y-2 flex flex-col justify-center">
              <h5 className="text-sm font-medium text-center">Final</h5>
              <Card className="p-3 w-48">
                <div className="text-center">
                  <div className="text-lg font-bold">🏆</div>
                  <div className="text-sm text-muted-foreground">Champion</div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderRoundRobin = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Round Robin</h4>
          <Badge variant="outline">
            {totalTeams - 1} rounds • Everyone plays everyone
          </Badge>
        </div>

        <Card className="p-4">
          <div className="space-y-3">
            <h5 className="text-sm font-medium">Match Schedule Preview</h5>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Round 1: {Math.floor(totalTeams / 2)} matches</p>
              <p>Round 2: {Math.floor(totalTeams / 2)} matches</p>
              <p>...</p>
              <p>Total: {(totalTeams * (totalTeams - 1)) / 2} matches</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          {previewTeams.slice(0, 8).map((team) => (
            <Card key={team.id} className="p-2">
              <div className="text-sm">
                <div className="font-medium">{team.name}</div>
                <div className="text-xs text-muted-foreground">
                  0-0 (0 pts)
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const renderSwiss = () => {
    const rounds = Math.min(Math.ceil(Math.log2(totalTeams)), 7)
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Swiss System</h4>
          <Badge variant="outline">
            {rounds} rounds • Balanced matchups
          </Badge>
        </div>

        <Card className="p-4">
          <div className="space-y-3">
            <h5 className="text-sm font-medium">Tournament Structure</h5>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Round 1: Random pairings</p>
              <p>Round 2+: Teams with similar scores play each other</p>
              <p>No eliminations - everyone plays {rounds} games</p>
              <p>Winner determined by final standings</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          {previewTeams.slice(0, 8).map((team, index) => (
            <Card key={team.id} className="p-2">
              <div className="text-sm">
                <div className="font-medium">{team.name}</div>
                <div className="text-xs text-muted-foreground">
                  Seed #{index + 1}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const renderDoubleElimination = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Double Elimination</h4>
          <Badge variant="outline">
            Winner & Loser brackets
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h5 className="text-sm font-medium mb-3">Winner Bracket</h5>
            <div className="space-y-2">
              {previewTeams.slice(0, 4).map((team) => (
                <div key={team.id} className="text-sm p-2 border rounded">
                  {team.name}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h5 className="text-sm font-medium mb-3">Loser Bracket</h5>
            <div className="text-sm text-muted-foreground">
              Teams eliminated from winner bracket get a second chance here
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Seeding Info */}
      <Card className="p-3 bg-muted/50">
        <div className="text-sm">
          <strong>Seeding:</strong> {seedingType?.charAt(0).toUpperCase() + seedingType?.slice(1)}
          {seedingType === 'ranked' && (
            <span className="text-muted-foreground ml-2">
              (Teams ordered by average player ranking)
            </span>
          )}
          {seedingType === 'random' && (
            <span className="text-muted-foreground ml-2">
              (Teams will be randomly placed)
            </span>
          )}
          {seedingType === 'manual' && (
            <span className="text-muted-foreground ml-2">
              (You can arrange teams after creation)
            </span>
          )}
        </div>
      </Card>

      {/* Bracket Visualization */}
      {tournamentType === 'single-elimination' && renderSingleElimination()}
      {tournamentType === 'double-elimination' && renderDoubleElimination()}
      {tournamentType === 'round-robin' && renderRoundRobin()}
      {tournamentType === 'swiss' && renderSwiss()}
      
      {totalTeams > previewTeams.length && (
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            Preview shows first {previewTeams.length} teams. 
            Full bracket with {totalTeams} teams will be generated when tournament is created.
          </p>
        </Card>
      )}
    </div>
  )
}