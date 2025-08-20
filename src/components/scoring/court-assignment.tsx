'use client'

import { useState, useMemo } from 'react'
import { Match, Court } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { startMatch } from '@/lib/actions/matches'

interface CourtAssignmentPanelProps {
  tournamentId: string
  matches: Match[]
  courts: Court[]
}

export function CourtAssignmentPanel({ 
  tournamentId,
  matches, 
  courts 
}: CourtAssignmentPanelProps) {
  const [isAssigning, setIsAssigning] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)

  // Organize matches by court status
  const { assignedMatches, unassignedMatches, courtStatus } = useMemo(() => {
    const assigned = matches.filter(match => match.courtId)
    const unassigned = matches.filter(match => !match.courtId)
    
    const status: Record<string, {
      court: Court
      currentMatch?: Match
      nextMatch?: Match
      isAvailable: boolean
    }> = {}

    courts.forEach(court => {
      const currentMatch = assigned.find(match => 
        match.courtId === court.id && match.status === 'active'
      )
      const nextMatch = assigned.find(match => 
        match.courtId === court.id && match.status === 'scheduled'
      )
      
      status[court.id] = {
        court,
        currentMatch,
        nextMatch,
        isAvailable: !currentMatch
      }
    })

    return {
      assignedMatches: assigned,
      unassignedMatches: unassigned,
      courtStatus: status
    }
  }, [matches, courts])

  const handleAssignCourt = async (matchId: string, courtId: string) => {
    setIsAssigning(matchId)
    try {
      // Use startMatch with courtId to assign court
      const result = await startMatch(matchId, courtId)
      if (result.success) {
        console.log('Court assigned and match started successfully')
      } else {
        console.error('Failed to assign court:', result.error)
      }
    } catch (error) {
      console.error('Error assigning court:', error)
    } finally {
      setIsAssigning(null)
      setSelectedMatch(null)
    }
  }

  const handleUnassignCourt = async (matchId: string) => {
    setIsAssigning(matchId)
    try {
      // Note: Court unassignment would need to be implemented in the backend
      // For now, we'll show a message that this feature is not yet available
      console.log('Court unassignment not implemented yet')
      // You could implement a server action for this functionality
    } catch (error) {
      console.error('Error unassigning court:', error)
    } finally {
      setIsAssigning(null)
    }
  }

  const availableCourts = Object.values(courtStatus).filter(status => status.isAvailable)

  return (
    <div className="space-y-4">
      {/* Court Status Overview */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Court Status</h2>
        
        {courts.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">No courts configured</p>
            <p className="text-xs mt-1">Configure courts in tournament settings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.values(courtStatus).map(status => (
              <div key={status.court.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{status.court.name}</div>
                  <Badge 
                    variant={status.isAvailable ? 'outline' : 'default'}
                    className={`text-xs ${
                      status.isAvailable 
                        ? 'border-green-300 text-green-700' 
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    {status.isAvailable ? 'Available' : 'In Use'}
                  </Badge>
                </div>

                {/* Current Match */}
                {status.currentMatch && (
                  <div className="text-sm mb-2">
                    <div className="font-medium text-gray-700">Currently Playing:</div>
                    <div className="text-gray-600">
                      {status.currentMatch.team1?.name || 'TBD'} vs {status.currentMatch.team2?.name || 'TBD'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {status.currentMatch.score && (
                        <>Score: {status.currentMatch.score.team1} - {status.currentMatch.score.team2}</>
                      )}
                      {status.currentMatch.startTime && (
                        <span className="ml-2">
                          Started {new Date(status.currentMatch.startTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnassignCourt(status.currentMatch!.id)}
                      disabled={isAssigning === status.currentMatch!.id}
                      className="mt-2 text-xs h-7"
                    >
                      {isAssigning === status.currentMatch!.id ? 'Unassigning...' : 'Unassign Court'}
                    </Button>
                  </div>
                )}

                {/* Next Match */}
                {status.nextMatch && (
                  <div className="text-sm">
                    <div className="font-medium text-gray-700">Next Up:</div>
                    <div className="text-gray-600">
                      {status.nextMatch.team1?.name || 'TBD'} vs {status.nextMatch.team2?.name || 'TBD'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {status.nextMatch.roundName}
                    </div>
                  </div>
                )}

                {/* Available Court */}
                {status.isAvailable && !status.nextMatch && (
                  <div className="text-sm text-gray-500">
                    Ready for next match assignment
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Unassigned Matches */}
      {unassignedMatches.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Unassigned Matches</span>
            <Badge variant="outline" className="text-xs">
              {unassignedMatches.length} matches
            </Badge>
          </h3>
          
          <div className="space-y-3">
            {unassignedMatches.map(match => (
              <div key={match.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">
                      {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {match.roundName}
                    </div>
                  </div>
                  <Badge 
                    variant={match.status === 'active' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {match.status}
                  </Badge>
                </div>

                {/* Court Assignment */}
                {selectedMatch === match.id ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      Select Court:
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {availableCourts.map(courtStatus => (
                        <Button
                          key={courtStatus.court.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignCourt(match.id, courtStatus.court.id)}
                          disabled={isAssigning === match.id}
                          className="justify-start text-xs h-8"
                        >
                          {courtStatus.court.name}
                          {courtStatus.court.location && (
                            <span className="text-gray-500 ml-1">
                              - {courtStatus.court.location}
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMatch(null)}
                        className="text-xs h-7"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMatch(match.id)}
                    disabled={availableCourts.length === 0 || isAssigning !== null}
                    className="text-xs h-7"
                  >
                    {availableCourts.length === 0 ? 'No Courts Available' : 'Assign Court'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Stats */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-xl font-bold text-blue-600">
              {courts.length}
            </div>
            <div className="text-xs text-blue-700">Total Courts</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-xl font-bold text-green-600">
              {availableCourts.length}
            </div>
            <div className="text-xs text-green-700">Available</div>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded">
            <div className="text-xl font-bold text-orange-600">
              {assignedMatches.filter(m => m.status === 'active').length}
            </div>
            <div className="text-xs text-orange-700">Active</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-xl font-bold text-gray-600">
              {unassignedMatches.length}
            </div>
            <div className="text-xs text-gray-700">Unassigned</div>
          </div>
        </div>
      </Card>
    </div>
  )
}