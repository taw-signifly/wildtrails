'use client'

import React from 'react'
import { Match } from '@/types'
import { SingleEliminationProps } from '@/types/bracket'
import { BracketRenderer } from './bracket-renderer'
import { Badge } from '@/components/ui/badge'
import { SVGUtils } from '@/lib/brackets/svg-utils'

export function SingleEliminationBracket({
  tournament,
  matches,
  bracketStructure,
  showByes = true,
  roundLabels,
  onMatchSelect,
  onTeamHighlight,
  className,
  ...props
}: SingleEliminationProps) {
  // Calculate tournament statistics
  const totalRounds = Math.max(...matches.map(m => m.round), 1)
  const completedMatches = matches.filter(m => m.status === 'completed')
  const activeMatches = matches.filter(m => m.status === 'active')
  const currentRound = activeMatches.length > 0 
    ? Math.min(...activeMatches.map(m => m.round))
    : totalRounds

  // Generate round labels if not provided
  const defaultRoundLabels = roundLabels || SVGUtils.generateRoundLabels(totalRounds, 'single')

  // Filter out bye matches if showByes is false
  const visibleMatches = showByes 
    ? matches 
    : matches.filter(match => 
        match.team1?.id && match.team2?.id && 
        match.team1?.name !== 'BYE' && match.team2?.name !== 'BYE'
      )

  // Calculate bracket progression
  const getRoundProgress = (round: number) => {
    const roundMatches = matches.filter(m => m.round === round)
    const completedRoundMatches = roundMatches.filter(m => m.status === 'completed')
    return roundMatches.length > 0 ? completedRoundMatches.length / roundMatches.length : 0
  }

  // Find championship match
  const championshipMatch = matches.find(m => m.round === totalRounds)
  const champion = championshipMatch?.status === 'completed' && championshipMatch.winner
    ? (championshipMatch.team1?.id === championshipMatch.winner 
        ? championshipMatch.team1 
        : championshipMatch.team2)
    : null

  return (
    <div className="space-y-4">
      {/* Tournament Header */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {tournament.name}
            </h2>
            <p className="text-sm text-gray-600">
              Single Elimination Tournament • {matches.length} matches • {totalRounds} rounds
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50">
              Round {currentRound} of {totalRounds}
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              {completedMatches.length}/{matches.length} completed
            </Badge>
            {champion && (
              <Badge variant="default" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                🏆 Champion: {champion.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Tournament Progress</span>
            <span>{Math.round((completedMatches.length / matches.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedMatches.length / matches.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Round Status */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h3 className="font-semibold mb-3">Round Progress</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => {
            const progress = getRoundProgress(round)
            const label = defaultRoundLabels[round - 1] || `Round ${round}`
            const isCurrentRound = round === currentRound
            const isCompleted = progress === 1
            
            return (
              <div
                key={round}
                className={`p-2 rounded-lg border text-center transition-all ${
                  isCurrentRound
                    ? 'bg-blue-50 border-blue-200'
                    : isCompleted
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-xs font-medium text-gray-900">
                  {label}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {Math.round(progress * 100)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      isCurrentRound ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Matches */}
      {activeMatches.length > 0 && (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
            Active Matches ({activeMatches.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMatches.slice(0, 6).map(match => (
              <div
                key={match.id}
                className="p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => onMatchSelect?.(match)}
              >
                <div className="text-sm font-medium">
                  {match.roundName || `Round ${match.round}`}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                </div>
                {match.courtId && (
                  <div className="text-xs text-gray-500 mt-1">
                    Court {match.courtId}
                  </div>
                )}
              </div>
            ))}
            {activeMatches.length > 6 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                <span className="text-sm text-gray-600">
                  +{activeMatches.length - 6} more matches
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bracket Visualization */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="h-[600px]">
          <BracketRenderer
            tournament={tournament}
            matches={visibleMatches}
            bracketStructure={bracketStructure}
            interactive={true}
            showControls={true}
            showConnections={true}
            showRoundLabels={true}
            enableZoom={true}
            enablePan={true}
            onMatchSelect={onMatchSelect}
            onTeamHighlight={onTeamHighlight}
            className={className}
            {...props}
          />
        </div>
      </div>

      {/* Tournament Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {matches.filter(m => m.team1?.id && m.team2?.id).length}
          </div>
          <div className="text-sm text-gray-600">Total Matches</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {completedMatches.length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {activeMatches.length}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-2xl font-bold text-purple-600">
            {matches.filter(m => m.status === 'scheduled').length}
          </div>
          <div className="text-sm text-gray-600">Scheduled</div>
        </div>
      </div>

      {/* Championship Section */}
      {champion && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200">
          <div className="text-center">
            <div className="text-4xl mb-2">🏆</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Tournament Champion
            </h3>
            <div className="text-lg font-semibold text-yellow-800 mb-2">
              {champion.name}
            </div>
            {champion.players && champion.players.length > 0 && (
              <div className="text-sm text-gray-600">
                {champion.players.join(', ')}
              </div>
            )}
            {championshipMatch && championshipMatch.score && (
              <div className="mt-4 text-sm text-gray-600">
                Final Score: {championshipMatch.score.team1} - {championshipMatch.score.team2}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SingleEliminationBracket