'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PlayerEntry } from '@/lib/validation/tournament-setup'

interface Team {
  id: string
  name: string
  players: string[] // player emails
}

interface Props {
  players: PlayerEntry[]
  playersPerTeam: number
  existingTeams: Team[]
  onTeamsChange: (teams: Team[]) => void
}

export function TeamFormationInterface({
  players,
  playersPerTeam,
  existingTeams,
  onTeamsChange
}: Props) {
  const [teams, setTeams] = useState<Team[]>(existingTeams)
  const [unassignedPlayers, setUnassignedPlayers] = useState<PlayerEntry[]>([])
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null)

  useEffect(() => {
    // Update unassigned players when teams or players change
    const assignedEmails = new Set(teams.flatMap(team => team.players))
    const unassigned = players.filter(player => !assignedEmails.has(player.email))
    setUnassignedPlayers(unassigned)
  }, [players, teams])

  useEffect(() => {
    onTeamsChange(teams)
  }, [teams, onTeamsChange])

  const createNewTeam = () => {
    const teamNumber = teams.length + 1
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: `Team ${teamNumber}`,
      players: []
    }
    setTeams([...teams, newTeam])
  }

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter(team => team.id !== teamId))
  }

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(teams.map(team => 
      team.id === teamId ? { ...team, name } : team
    ))
  }

  const addPlayerToTeam = (teamId: string, playerEmail: string) => {
    const team = teams.find(t => t.id === teamId)
    if (!team || team.players.length >= playersPerTeam) return

    setTeams(teams.map(t => 
      t.id === teamId 
        ? { ...t, players: [...t.players, playerEmail] }
        : { ...t, players: t.players.filter(p => p !== playerEmail) }
    ))
  }

  const removePlayerFromTeam = (teamId: string, playerEmail: string) => {
    setTeams(teams.map(team => 
      team.id === teamId 
        ? { ...team, players: team.players.filter(p => p !== playerEmail) }
        : team
    ))
  }

  const autoFormTeams = () => {
    const availablePlayers = [...players]
    const newTeams: Team[] = []
    
    // Sort by ranking if available (lower is better)
    availablePlayers.sort((a, b) => {
      if (a.ranking && b.ranking) return a.ranking - b.ranking
      if (a.ranking) return -1
      if (b.ranking) return 1
      return 0
    })

    let teamCounter = 1
    while (availablePlayers.length >= playersPerTeam) {
      const teamPlayers: string[] = []
      
      // Snake draft for balanced teams
      for (let i = 0; i < playersPerTeam; i++) {
        const playerIndex = teamCounter % 2 === 1 ? 0 : availablePlayers.length - 1
        const player = availablePlayers.splice(playerIndex, 1)[0]
        teamPlayers.push(player.email)
      }

      newTeams.push({
        id: `team-${Date.now()}-${teamCounter}`,
        name: `Team ${teamCounter}`,
        players: teamPlayers
      })

      teamCounter++
    }

    setTeams(newTeams)
  }

  const clearAllTeams = () => {
    setTeams([])
  }

  const getPlayerName = (email: string) => {
    const player = players.find(p => p.email === email)
    return player ? `${player.firstName} ${player.lastName}` : email
  }

  const getPlayerDetails = (email: string) => {
    const player = players.find(p => p.email === email)
    if (!player) return ''
    
    const details = []
    if (player.club) details.push(player.club)
    if (player.ranking) details.push(`#${player.ranking}`)
    
    return details.join(' • ')
  }

  const handleDragStart = (playerEmail: string) => {
    setDraggedPlayer(playerEmail)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, teamId: string) => {
    e.preventDefault()
    if (draggedPlayer) {
      addPlayerToTeam(teamId, draggedPlayer)
      setDraggedPlayer(null)
    }
  }

  const canFormMinimumTeams = players.length >= playersPerTeam * 4
  const optimalTeams = Math.floor(players.length / playersPerTeam)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={createNewTeam}>
            Add Team
          </Button>
          <Button 
            variant="outline" 
            onClick={autoFormTeams}
            disabled={!canFormMinimumTeams}
          >
            Auto-Form Teams
          </Button>
          <Button variant="outline" onClick={clearAllTeams}>
            Clear All
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {teams.length} teams • {optimalTeams} optimal
        </div>
      </div>

      {/* Team Formation Status */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">Teams:</span> {teams.filter(t => t.players.length === playersPerTeam).length} complete
          </div>
          <div className="text-sm">
            <span className="font-medium">Unassigned:</span> {unassignedPlayers.length} players
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Unassigned Players */}
        <Card className="p-4">
          <div className="space-y-3">
            <h4 className="font-medium">Unassigned Players</h4>
            
            {unassignedPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">All players assigned to teams</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {unassignedPlayers.map(player => (
                  <div
                    key={player.email}
                    draggable
                    onDragStart={() => handleDragStart(player.email)}
                    className="p-2 border rounded cursor-move hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-sm">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getPlayerDetails(player.email)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Teams */}
        <div className="space-y-3">
          <h4 className="font-medium">Teams</h4>
          
          {teams.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                No teams created yet. Click &quot;Add Team&quot; or &quot;Auto-Form Teams&quot; to get started.
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {teams.map(team => (
                <Card
                  key={team.id}
                  className={`p-3 transition-colors ${
                    team.players.length === playersPerTeam 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-muted/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, team.id)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) => updateTeamName(team.id, e.target.value)}
                        className="font-medium text-sm bg-transparent border-none p-0 focus:outline-none"
                      />
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          team.players.length === playersPerTeam ? 'default' : 'outline'
                        }>
                          {team.players.length}/{playersPerTeam}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTeam(team.id)}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {team.players.map(playerEmail => (
                        <div
                          key={playerEmail}
                          className="flex items-center justify-between p-1 text-xs bg-background rounded"
                        >
                          <div>
                            <div className="font-medium">{getPlayerName(playerEmail)}</div>
                            <div className="text-muted-foreground">
                              {getPlayerDetails(playerEmail)}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePlayerFromTeam(team.id, playerEmail)}
                            className="h-5 w-5 p-0 text-xs"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      
                      {/* Empty slots */}
                      {Array.from({ length: playersPerTeam - team.players.length }).map((_, index) => (
                        <div key={index} className="p-1 text-xs text-muted-foreground border-2 border-dashed rounded">
                          Drag player here
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="text-sm text-blue-800">
          <strong>Tips:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Drag players from the unassigned list to teams</li>
            <li>Use &quot;Auto-Form Teams&quot; for balanced team creation based on rankings</li>
            <li>Each team needs exactly {playersPerTeam} player{playersPerTeam > 1 ? 's' : ''}</li>
            <li>You can create {optimalTeams} complete teams with {players.length} players</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}