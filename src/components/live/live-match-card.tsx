'use client'

import React, { useState, useEffect } from 'react'
import { useRealTimeMatch } from '@/hooks/use-real-time-match'
import { Match, Team } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface LiveMatchCardProps {
  matchId: string | null
  showControls?: boolean
  compact?: boolean
  onScoreUpdate?: (matchId: string, score: any) => void
  onMatchEvent?: (matchId: string, eventType: string, data: any) => void
  className?: string
}

export function LiveMatchCard({
  matchId,
  showControls = false,
  compact = false,
  onScoreUpdate,
  onMatchEvent,
  className = ''
}: LiveMatchCardProps) {
  const [celebrationActive, setCelebrationActive] = useState(false)
  
  const {
    match,
    isConnected,
    error,
    connectionStatus,
    broadcastScoreUpdate,
    broadcastMatchEvent
  } = useRealTimeMatch(matchId, {
    autoConnect: true,
    enableBroadcast: showControls,
    onScoreUpdate: (score) => {
      onScoreUpdate?.(matchId!, score)
      // Trigger celebration animation
      setCelebrationActive(true)
      setTimeout(() => setCelebrationActive(false), 2000)
    },
    onStatusChange: (status) => {
      if (status === 'completed') {
        broadcastMatchEvent('match_completed', { matchId, timestamp: new Date().toISOString() })
        onMatchEvent?.(matchId!, 'match_completed', { status })
      }
    }
  })

  if (!matchId) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">
          No match selected
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`p-4 border-red-200 bg-red-50 ${className}`}>
        <div className="text-center text-red-600">
          <p className="font-medium">Connection Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    )
  }

  if (!match) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </Card>
    )
  }

  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const formatScore = (score: any) => {
    if (!score) return 'N/A'
    if (typeof score === 'object') {
      // Handle different score formats
      if (score.team1 !== undefined && score.team2 !== undefined) {
        return `${score.team1} - ${score.team2}`
      }
      if (score.games) {
        return score.games.map((game: any) => `${game.team1_score}-${game.team2_score}`).join(', ')
      }
    }
    return String(score)
  }

  const handleQuickScore = (team: 'team1' | 'team2') => {
    if (!showControls || !match) return
    
    const currentScore = match.score || { team1: 0, team2: 0 }
    const newScore = {
      ...currentScore,
      [team]: (currentScore[team] || 0) + 1
    }
    
    broadcastScoreUpdate(newScore)
  }

  const handleMatchAction = (action: string) => {
    if (!showControls || !match) return
    
    switch (action) {
      case 'start':
        broadcastMatchEvent('match_started', { matchId, timestamp: new Date().toISOString() })
        break
      case 'pause':
        broadcastMatchEvent('match_paused', { matchId, timestamp: new Date().toISOString() })
        break
      case 'resume':
        broadcastMatchEvent('match_resumed', { matchId, timestamp: new Date().toISOString() })
        break
      case 'complete':
        broadcastMatchEvent('match_completed', { matchId, timestamp: new Date().toISOString() })
        break
    }
  }

  if (compact) {
    return (
      <Card className={`p-3 ${celebrationActive ? 'ring-2 ring-green-500 shadow-lg' : ''} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(match.status)}>
              {match.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <span className="font-medium">Round {match.round}</span>
          </div>
          
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
               title={`Connection: ${connectionStatus}`} />
        </div>
        
        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm">
            <div>{match.team1?.name || 'Team 1'}</div>
            <div>{match.team2?.name || 'Team 2'}</div>
          </div>
          <div className="text-right font-mono text-lg">
            {formatScore(match.score)}
          </div>
        </div>
        
        {match.court && (
          <div className="mt-2 text-xs text-gray-500">
            Court: {match.court.name}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${celebrationActive ? 'ring-2 ring-green-500 shadow-lg transition-all duration-300' : ''} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">
            Round {match.round} - Match {match.match_number}
          </h3>
          <Badge className={getStatusColor(match.status)}>
            {match.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-sm ${getConnectionStatusColor(connectionStatus)}`}>
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`} />
            <span>{connectionStatus}</span>
          </div>
        </div>
      </div>

      {/* Teams and Score */}
      <div className="grid grid-cols-3 gap-4 items-center mb-4">
        {/* Team 1 */}
        <div className="text-center">
          <h4 className="font-medium text-lg mb-2">
            {match.team1?.name || 'Team 1'}
          </h4>
          {showControls && match.status === 'in_progress' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickScore('team1')}
              className="mb-2"
            >
              +1 Point
            </Button>
          )}
        </div>

        {/* Score */}
        <div className="text-center">
          <div className="text-3xl font-bold font-mono mb-2">
            {formatScore(match.score)}
          </div>
          {match.status === 'in_progress' && (
            <div className="text-sm text-blue-600 animate-pulse">
              LIVE
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="text-center">
          <h4 className="font-medium text-lg mb-2">
            {match.team2?.name || 'Team 2'}
          </h4>
          {showControls && match.status === 'in_progress' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickScore('team2')}
              className="mb-2"
            >
              +1 Point
            </Button>
          )}
        </div>
      </div>

      {/* Match Info */}
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
        {match.court && (
          <div>
            <span className="font-medium">Court:</span> {match.court.name}
          </div>
        )}
        
        {match.start_time && (
          <div>
            <span className="font-medium">Started:</span>{' '}
            {new Date(match.start_time).toLocaleTimeString()}
          </div>
        )}
        
        {match.end_time && (
          <div>
            <span className="font-medium">Completed:</span>{' '}
            {new Date(match.end_time).toLocaleTimeString()}
          </div>
        )}
        
        {match.winner_id && (
          <div className="col-span-2">
            <span className="font-medium">Winner:</span>{' '}
            {match.winner_id === match.team1_id ? match.team1?.name : match.team2?.name}
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex gap-2 pt-4 border-t">
          {match.status === 'pending' && (
            <Button
              onClick={() => handleMatchAction('start')}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              Start Match
            </Button>
          )}
          
          {match.status === 'in_progress' && (
            <>
              <Button
                onClick={() => handleMatchAction('pause')}
                size="sm"
                variant="outline"
              >
                Pause
              </Button>
              <Button
                onClick={() => handleMatchAction('complete')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Complete Match
              </Button>
            </>
          )}
          
          {match.status === 'paused' && (
            <Button
              onClick={() => handleMatchAction('resume')}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              Resume Match
            </Button>
          )}
        </div>
      )}

      {/* Celebration overlay */}
      {celebrationActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-green-100 bg-opacity-20 animate-pulse rounded-lg" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="text-2xl animate-bounce">🎉</div>
          </div>
        </div>
      )}
    </Card>
  )
}

// Simplified version for dashboard use
export function LiveMatchSummary({ matchId, className = '' }: { matchId: string, className?: string }) {
  return (
    <LiveMatchCard
      matchId={matchId}
      compact={true}
      showControls={false}
      className={className}
    />
  )
}

// Enhanced version with full controls for officials
export function LiveMatchControl({ matchId, className = '' }: { matchId: string, className?: string }) {
  return (
    <LiveMatchCard
      matchId={matchId}
      compact={false}
      showControls={true}
      className={className}
      onScoreUpdate={(matchId, score) => {
        console.log('Score updated:', matchId, score)
      }}
      onMatchEvent={(matchId, eventType, data) => {
        console.log('Match event:', matchId, eventType, data)
      }}
    />
  )
}