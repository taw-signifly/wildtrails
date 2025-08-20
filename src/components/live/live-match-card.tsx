'use client'

import React, { useState, useEffect } from 'react'
import { Match, Score } from '@/types'
import { useRealTimeMatch } from '@/hooks/use-real-time-match'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface LiveMatchCardProps {
  match: Match
  enableScoring?: boolean
  enableBroadcast?: boolean
  showConnectionStatus?: boolean
  compact?: boolean
  onClick?: (match: Match) => void
}

export function LiveMatchCard({
  match,
  enableScoring = false,
  enableBroadcast = false,
  showConnectionStatus = true,
  compact = false,
  onClick
}: LiveMatchCardProps) {
  const {
    match: liveMatch,
    isLive,
    connectionStatus,
    liveScore,
    lastUpdated,
    broadcastScore
  } = useRealTimeMatch(match.id, {
    autoConnect: true,
    enableBroadcast
  })
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [showScoreAnimation, setShowScoreAnimation] = useState(false)
  const [previousScore, setPreviousScore] = useState<Score | null>(null)
  
  // Use live match data if available, fallback to prop
  const currentMatch = liveMatch || match
  const currentScore = liveScore || currentMatch.score
  
  // Animate score changes
  useEffect(() => {
    if (previousScore && currentScore && 
        (previousScore.team1 !== currentScore.team1 || previousScore.team2 !== currentScore.team2)) {
      setShowScoreAnimation(true)
      const timer = setTimeout(() => setShowScoreAnimation(false), 1000)
      return () => clearTimeout(timer)
    }
    setPreviousScore(currentScore)
  }, [currentScore])
  
  // Handle score update
  const updateScore = (team1: number, team2: number) => {
    if (!enableScoring) return
    
    setIsUpdating(true)
    const newScore: Score = { team1, team2, isComplete: false }
    
    if (enableBroadcast) {
      broadcastScore(newScore)
    }
    
    // Reset updating state after a brief delay
    setTimeout(() => setIsUpdating(false), 500)
  }
  
  // Get status badge variant
  const getStatusVariant = () => {
    switch (currentMatch.status) {
      case 'active': return 'default'
      case 'completed': return 'secondary'
      case 'scheduled': return 'outline'
      default: return 'outline'
    }
  }
  
  // Get connection status color
  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }
  
  // Format time
  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  // Get match title
  const getMatchTitle = () => {
    if (currentMatch.roundName) return currentMatch.roundName
    if (currentMatch.round) return `Round ${currentMatch.round}`
    return `Match ${currentMatch.match_number}`
  }
  
  // Get team names
  const getTeamName = (team: any) => {
    if (!team) return 'TBD'
    if (team.name) return team.name
    if (team.players && team.players.length > 0) {
      return team.players.map((p: any) => p.displayName || `${p.firstName} ${p.lastName}`).join(' / ')
    }
    return 'Unknown Team'
  }
  
  if (compact) {
    return (
      <Card 
        className={`p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
          isLive ? 'border-green-500 bg-green-50' : ''
        } ${showScoreAnimation ? 'animate-pulse' : ''}`}
        onClick={() => onClick?.(currentMatch)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusVariant()}>
              {currentMatch.status}
            </Badge>
            {isLive && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
            <span className="text-sm font-medium">{getMatchTitle()}</span>
          </div>
          
          {currentScore && (
            <div className="text-lg font-bold">
              {currentScore.team1} - {currentScore.team2}
            </div>
          )}
          
          {showConnectionStatus && (
            <div className={`w-2 h-2 rounded-full ${getConnectionColor().replace('text-', 'bg-')}`}></div>
          )}
        </div>
      </Card>
    )
  }
  
  return (
    <Card className={`p-4 ${isLive ? 'border-green-500 bg-green-50' : ''} ${
      showScoreAnimation ? 'animate-pulse' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Badge variant={getStatusVariant()}>
            {currentMatch.status}
          </Badge>
          {isLive && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-red-600 font-medium">LIVE</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          {currentMatch.courtId && (
            <span>Court {currentMatch.courtId}</span>
          )}
          {showConnectionStatus && (
            <div className={`flex items-center space-x-1 ${getConnectionColor()}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${getConnectionColor().replace('text-', 'bg-')}`}></div>
              <span className="text-xs capitalize">{connectionStatus}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Match Info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">{getMatchTitle()}</h3>
        
        {/* Teams and Score */}
        <div className="space-y-3">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium">{getTeamName(currentMatch.team1)}</div>
            </div>
            <div className="flex items-center space-x-2">
              {enableScoring && isLive && (
                <div className="flex space-x-1">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => updateScore((currentScore?.team1 || 0) + 1, currentScore?.team2 || 0)}
                  >
                    +
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isUpdating || (currentScore?.team1 || 0) === 0}
                    onClick={() => updateScore(Math.max(0, (currentScore?.team1 || 0) - 1), currentScore?.team2 || 0)}
                  >
                    -
                  </Button>
                </div>
              )}
              <div className="text-2xl font-bold w-8 text-center">
                {currentScore?.team1 || 0}
              </div>
            </div>
          </div>
          
          {/* VS Divider */}
          <div className="text-center text-gray-400 text-sm">vs</div>
          
          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium">{getTeamName(currentMatch.team2)}</div>
            </div>
            <div className="flex items-center space-x-2">
              {enableScoring && isLive && (
                <div className="flex space-x-1">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => updateScore(currentScore?.team1 || 0, (currentScore?.team2 || 0) + 1)}
                  >
                    +
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isUpdating || (currentScore?.team2 || 0) === 0}
                    onClick={() => updateScore(currentScore?.team1 || 0, Math.max(0, (currentScore?.team2 || 0) - 1))}
                  >
                    -
                  </Button>
                </div>
              )}
              <div className="text-2xl font-bold w-8 text-center">
                {currentScore?.team2 || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t">
        <div className="flex items-center space-x-3">
          {currentMatch.scheduled_time && (
            <span>Scheduled: {formatTime(currentMatch.scheduled_time)}</span>
          )}
          {currentMatch.actual_start_time && (
            <span>Started: {formatTime(currentMatch.actual_start_time)}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-xs">
              Updated: {formatTime(lastUpdated)}
            </span>
          )}
          {onClick && (
            <Button size="sm" variant="outline" onClick={() => onClick(currentMatch)}>
              View Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// Component for displaying multiple live matches
export function LiveMatchGrid({ 
  matches, 
  enableScoring = false, 
  enableBroadcast = false,
  onMatchClick 
}: {
  matches: Match[]
  enableScoring?: boolean
  enableBroadcast?: boolean
  onMatchClick?: (match: Match) => void
}) {
  const liveMatches = matches.filter(m => m.status === 'active')
  const upcomingMatches = matches.filter(m => m.status === 'scheduled')
  
  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No matches available
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {liveMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>Live Matches ({liveMatches.length})</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {liveMatches.map(match => (
              <LiveMatchCard
                key={match.id}
                match={match}
                enableScoring={enableScoring}
                enableBroadcast={enableBroadcast}
                onClick={onMatchClick}
              />
            ))}
          </div>
        </div>
      )}
      
      {upcomingMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Upcoming Matches ({upcomingMatches.length})
          </h2>
          <div className="grid gap-2">
            {upcomingMatches.map(match => (
              <LiveMatchCard
                key={match.id}
                match={match}
                compact={true}
                onClick={onMatchClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}