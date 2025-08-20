'use client'

import { useState, useMemo, useCallback } from 'react'
import { Match } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TeamScoreCard } from './team-score-card'
import { EndScoringTracker } from './end-scoring-tracker'
import { MatchControls } from './match-controls'
import { ScoreValidationDisplay } from './score-validation'
import { useLiveScoring } from '@/hooks/use-live-scoring'
import { useOptimisticScoring } from '@/hooks/use-optimistic-scoring'

interface ScoringInterfaceProps {
  tournamentId: string
  matches: Match[]
  initialMatchId?: string
}

export function ScoringInterface({ 
  tournamentId, 
  matches, 
  initialMatchId 
}: ScoringInterfaceProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    initialMatchId || null
  )

  // Get the selected match
  const selectedMatch = useMemo(
    () => matches.find(m => m.id === selectedMatchId),
    [matches, selectedMatchId]
  )

  // Live scoring hook for real-time updates
  const {
    currentMatch,
    isConnected,
    connectionError,
    subscribeToMatch,
    unsubscribeFromMatch
  } = useLiveScoring(tournamentId)

  // Optimistic scoring for instant UI feedback
  const {
    optimisticMatch,
    updateScore,
    submitEndScore,
    isSubmitting,
    lastError,
    canUndo,
    undoLastAction
  } = useOptimisticScoring(selectedMatch || null)

  // Use optimistic match data if available, fallback to selected match
  const displayMatch = optimisticMatch || selectedMatch

  // Subscribe to real-time updates when match is selected
  const handleMatchSelect = useCallback((matchId: string) => {
    if (selectedMatchId) {
      unsubscribeFromMatch(selectedMatchId)
    }
    setSelectedMatchId(matchId)
    subscribeToMatch(matchId)
  }, [selectedMatchId, subscribeToMatch, unsubscribeFromMatch])

  // Filter matches by status
  const activeMatches = matches.filter(m => m.status === 'active')
  const upcomingMatches = matches.filter(m => m.status === 'scheduled')

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!isConnected && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-sm font-medium text-orange-700">
                Connecting to live updates...
              </span>
            </div>
            {connectionError && (
              <span className="text-xs text-orange-600">
                {connectionError}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Match Selection */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Select Match to Score</h2>
        
        {/* Active Matches */}
        {activeMatches.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Active Matches</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeMatches.map(match => (
                <MatchSelectionCard
                  key={match.id}
                  match={match}
                  isSelected={selectedMatchId === match.id}
                  onSelect={() => handleMatchSelect(match.id)}
                  status="active"
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Ready to Start</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingMatches.map(match => (
                <MatchSelectionCard
                  key={match.id}
                  match={match}
                  isSelected={selectedMatchId === match.id}
                  onSelect={() => handleMatchSelect(match.id)}
                  status="scheduled"
                />
              ))}
            </div>
          </div>
        )}

        {activeMatches.length === 0 && upcomingMatches.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No matches available for scoring at this time.</p>
          </div>
        )}
      </Card>

      {/* Selected Match Scoring Interface */}
      {displayMatch && (
        <div className="space-y-6">
          {/* Score Validation Display */}
          <ScoreValidationDisplay 
            match={displayMatch}
            lastError={lastError}
          />

          {/* Main Scoring Area */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Team Score Cards */}
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <TeamScoreCard
                team={displayMatch.team1!}
                score={displayMatch.score?.team1 || 0}
                isWinner={displayMatch.winner === displayMatch.team1?.id}
                isActive={!displayMatch.score?.isComplete}
                onScoreUpdate={(points) => updateScore(displayMatch.team1?.id!, points)}
                disabled={isSubmitting}
              />
              <TeamScoreCard
                team={displayMatch.team2!}
                score={displayMatch.score?.team2 || 0}
                isWinner={displayMatch.winner === displayMatch.team2?.id}
                isActive={!displayMatch.score?.isComplete}
                onScoreUpdate={(points) => updateScore(displayMatch.team2?.id!, points)}
                disabled={isSubmitting}
              />
            </div>

            {/* End Scoring Tracker */}
            <div className="xl:col-span-1">
              <EndScoringTracker
                match={displayMatch}
                onEndScore={submitEndScore}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>

          {/* Match Controls */}
          <MatchControls
            match={displayMatch}
            canUndo={canUndo}
            onUndo={undoLastAction}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  )
}

// Match selection card component
interface MatchSelectionCardProps {
  match: Match
  isSelected: boolean
  onSelect: () => void
  status: 'active' | 'scheduled'
}

function MatchSelectionCard({ 
  match, 
  isSelected, 
  onSelect, 
  status 
}: MatchSelectionCardProps) {
  const statusColor = status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'
  const selectedClass = isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'

  return (
    <Card 
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedClass}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <Badge className={`text-xs px-2 py-1 ${statusColor}`}>
          {status === 'active' ? 'LIVE' : 'READY'}
        </Badge>
        {match.courtId && (
          <span className="text-xs text-gray-500">Court {match.courtId}</span>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
        </div>
        
        {status === 'active' && (
          <div className="flex justify-between text-sm">
            <span className="font-mono">
              {match.score?.team1 || 0} - {match.score?.team2 || 0}
            </span>
            <span className="text-gray-500">
              End {(match.ends?.length || 0) + 1}
            </span>
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          {match.roundName}
        </div>
      </div>
    </Card>
  )
}