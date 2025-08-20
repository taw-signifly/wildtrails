'use client'

import React, { useState } from 'react'
import { Match } from '@/types'
import { DoubleEliminationProps } from '@/types/bracket'
import { BracketRenderer } from './bracket-renderer'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function DoubleEliminationBracket({
  tournament,
  matches,
  bracketStructure,
  showBracketLabels = true,
  separateBrackets = true,
  onMatchSelect,
  onTeamHighlight,
  className,
  ...props
}: DoubleEliminationProps) {
  // Separate matches into winner and loser brackets
  const winnerMatches = matches.filter(m => m.bracketType === 'winner' || !m.bracketType)
  const loserMatches = matches.filter(m => m.bracketType === 'loser')
  const grandFinalMatches = matches.filter(m => (m.bracketType as any) === 'grand-final')

  // Calculate tournament statistics
  const totalMatches = matches.length
  const completedMatches = matches.filter(m => m.status === 'completed')
  const activeMatches = matches.filter(m => m.status === 'active')
  
  // Find tournament status
  const grandFinalMatch = grandFinalMatches[0]
  const champion = grandFinalMatch?.status === 'completed' && grandFinalMatch.winner
    ? (grandFinalMatch.team1.id === grandFinalMatch.winner 
        ? grandFinalMatch.team1 
        : grandFinalMatch.team2)
    : null

  // Calculate bracket progress
  const winnerBracketCompleted = winnerMatches.filter(m => m.status === 'completed').length
  const loserBracketCompleted = loserMatches.filter(m => m.status === 'completed').length
  const winnerBracketProgress = winnerMatches.length > 0 ? winnerBracketCompleted / winnerMatches.length : 0
  const loserBracketProgress = loserMatches.length > 0 ? loserBracketCompleted / loserMatches.length : 0

  // Combined view component
  const CombinedBracketView = () => (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {tournament.name}
            </h2>
            <p className="text-sm text-gray-600">
              Double Elimination Tournament • {totalMatches} matches
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50">
              Winner Bracket: {Math.round(winnerBracketProgress * 100)}%
            </Badge>
            <Badge variant="outline" className="bg-orange-50">
              Loser Bracket: {Math.round(loserBracketProgress * 100)}%
            </Badge>
            {champion && (
              <Badge variant="default" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                🏆 Champion: {champion.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bars */}
        <div className="mt-4 space-y-2">
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Winner Bracket Progress</span>
              <span>{Math.round(winnerBracketProgress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${winnerBracketProgress * 100}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Loser Bracket Progress</span>
              <span>{Math.round(loserBracketProgress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${loserBracketProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active Matches */}
      {activeMatches.length > 0 && (
        <Card className="p-4">
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
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {match.bracketType === 'winner' ? '🏆' : match.bracketType === 'loser' ? '🔄' : '👑'} 
                    {match.roundName || `Round ${match.round}`}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {match.bracketType || 'winner'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  {match.team1.name} vs {match.team2.name}
                </div>
                {match.courtId && (
                  <div className="text-xs text-gray-500 mt-1">
                    Court {match.courtId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full Combined Bracket */}
      <Card>
        <div className="h-[700px]">
          <BracketRenderer
            tournament={tournament}
            matches={matches}
            bracketStructure={bracketStructure}
            interactive={true}
            showControls={true}
            showConnections={true}
            showRoundLabels={showBracketLabels}
            enableZoom={true}
            enablePan={true}
            onMatchSelect={onMatchSelect}
            onTeamHighlight={onTeamHighlight}
            className={className}
            {...props}
          />
        </div>
      </Card>
    </div>
  )

  // Separate brackets view component
  const SeparateBracketsView = () => {
    const [activeTab, setActiveTab] = useState<'combined' | 'winner' | 'loser' | 'stats'>('combined')
    
    return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {tournament.name}
            </h2>
            <p className="text-sm text-gray-600">
              Double Elimination Tournament • {totalMatches} matches
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50">
              {completedMatches.length}/{totalMatches} completed
            </Badge>
            {champion && (
              <Badge variant="default" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                🏆 Champion: {champion.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabbed Bracket Views */}
      <div className="w-full">
        <div className="grid w-full grid-cols-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('combined')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'combined' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setActiveTab('winner')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'winner' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Winner Bracket
          </button>
          <button
            onClick={() => setActiveTab('loser')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'loser' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Loser Bracket
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'stats' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Statistics
          </button>
        </div>
        
        {activeTab === 'combined' && (
          <div className="mt-4">
            <Card>
              <div className="h-[600px]">
                <BracketRenderer
                  tournament={tournament}
                  matches={matches}
                  bracketStructure={bracketStructure}
                  interactive={true}
                  showControls={true}
                  showConnections={true}
                  showRoundLabels={showBracketLabels}
                  onMatchSelect={onMatchSelect}
                  onTeamHighlight={onTeamHighlight}
                  {...props}
                />
              </div>
            </Card>
          </div>
        )}
        
        {activeTab === 'winner' && (
          <div className="mt-4">
            <Card>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center">
                    🏆 Winner Bracket
                  </h3>
                  <Badge variant="outline">
                    {winnerBracketCompleted}/{winnerMatches.length} completed
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Teams advance through the winner bracket until they lose a match
                </p>
              </div>
              <div className="h-[500px]">
                <BracketRenderer
                  tournament={tournament}
                  matches={winnerMatches}
                  bracketStructure={bracketStructure.filter(b => b.bracketType === 'winner')}
                  interactive={true}
                  showControls={true}
                  showConnections={true}
                  onMatchSelect={onMatchSelect}
                  onTeamHighlight={onTeamHighlight}
                  {...props}
                />
              </div>
            </Card>
          </div>
        )}
        
        {activeTab === 'loser' && (
          <div className="mt-4">
            <Card>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center">
                    🔄 Loser Bracket
                  </h3>
                  <Badge variant="outline">
                    {loserBracketCompleted}/{loserMatches.length} completed
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Teams get a second chance after losing in the winner bracket
                </p>
              </div>
              <div className="h-[500px]">
                <BracketRenderer
                  tournament={tournament}
                  matches={loserMatches}
                  bracketStructure={bracketStructure.filter(b => b.bracketType === 'loser')}
                  interactive={true}
                  showControls={true}
                  showConnections={true}
                  onMatchSelect={onMatchSelect}
                  onTeamHighlight={onTeamHighlight}
                  {...props}
                />
              </div>
            </Card>
          </div>
        )}
        
        {activeTab === 'stats' && (
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Winner Bracket Stats */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                🏆 Winner Bracket Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Matches:</span>
                  <span className="font-medium">{winnerMatches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed:</span>
                  <span className="font-medium">{winnerBracketCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">In Progress:</span>
                  <span className="font-medium">
                    {winnerMatches.filter(m => m.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Scheduled:</span>
                  <span className="font-medium">
                    {winnerMatches.filter(m => m.status === 'scheduled').length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${winnerBracketProgress * 100}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* Loser Bracket Stats */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                🔄 Loser Bracket Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Matches:</span>
                  <span className="font-medium">{loserMatches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed:</span>
                  <span className="font-medium">{loserBracketCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">In Progress:</span>
                  <span className="font-medium">
                    {loserMatches.filter(m => m.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Scheduled:</span>
                  <span className="font-medium">
                    {loserMatches.filter(m => m.status === 'scheduled').length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${loserBracketProgress * 100}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* Grand Final Section */}
            {grandFinalMatch && (
              <Card className="p-4 md:col-span-2">
                <h3 className="font-semibold mb-3 flex items-center">
                  👑 Grand Final
                </h3>
                <div 
                  className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => onMatchSelect?.(grandFinalMatch)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">
                        {grandFinalMatch.team1.name} vs {grandFinalMatch.team2.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        Winner of Loser Bracket vs Winner of Winner Bracket
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        grandFinalMatch.status === 'completed' ? 'default' :
                        grandFinalMatch.status === 'active' ? 'secondary' : 'outline'
                      }>
                        {grandFinalMatch.status}
                      </Badge>
                      {grandFinalMatch.score && (
                        <div className="text-sm mt-1">
                          {grandFinalMatch.score.team1} - {grandFinalMatch.score.team2}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
    )
  }

  // Championship section for completed tournament
  const ChampionshipSection = () => champion ? (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200 mt-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🏆</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Tournament Champion
        </h3>
        <div className="text-lg font-semibold text-yellow-800 mb-2">
          {champion.name}
        </div>
        {champion.players && champion.players.length > 0 && (
          <div className="text-sm text-gray-600 mb-2">
            {champion.players.join(', ')}
          </div>
        )}
        <div className="text-sm text-gray-600">
          Survived both winner and loser brackets to claim victory!
        </div>
      </div>
    </div>
  ) : null

  return (
    <div>
      {separateBrackets ? <SeparateBracketsView /> : <CombinedBracketView />}
      <ChampionshipSection />
    </div>
  )
}

export default DoubleEliminationBracket