'use client'

import { useState } from 'react'
import { Team } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TeamScoreCardProps {
  team: Team
  score: number
  isWinner: boolean
  isActive: boolean
  onScoreUpdate: (points: number) => void
  disabled?: boolean
}

export function TeamScoreCard({ 
  team, 
  score, 
  isWinner, 
  isActive, 
  onScoreUpdate,
  disabled = false
}: TeamScoreCardProps) {
  const [isHolding, setIsHolding] = useState(false)

  // Score button configurations for touch-optimized interface
  const scoreButtons = [
    { points: 1, label: '+1', color: 'bg-green-500 hover:bg-green-600' },
    { points: 2, label: '+2', color: 'bg-blue-500 hover:bg-blue-600' },
    { points: 3, label: '+3', color: 'bg-purple-500 hover:bg-purple-600' },
    { points: 4, label: '+4', color: 'bg-orange-500 hover:bg-orange-600' },
    { points: 5, label: '+5', color: 'bg-red-500 hover:bg-red-600' },
    { points: 6, label: '+6', color: 'bg-pink-500 hover:bg-pink-600' }
  ]

  const handleScoreUpdate = (points: number) => {
    if (!disabled && isActive && score + points <= 13) {
      onScoreUpdate(points)
    }
  }

  // Touch event handlers for better mobile experience
  const handleTouchStart = () => {
    setIsHolding(true)
  }

  const handleTouchEnd = () => {
    setIsHolding(false)
  }

  return (
    <Card className={`p-6 transition-all duration-200 ${
      isWinner ? 'bg-green-50 border-green-300 shadow-lg' : 
      isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Team Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {team.name}
          </h3>
          {team.players && team.players.length > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              {team.players.map(player => player.displayName).join(', ')}
            </div>
          )}
        </div>
        
        {isWinner && (
          <Badge className="bg-green-600 text-white ml-3">
            Winner
          </Badge>
        )}
      </div>

      {/* Large Score Display */}
      <div className="text-center mb-6">
        <div className={`text-6xl md:text-7xl font-bold tabular-nums transition-colors ${
          isWinner ? 'text-green-600' : 'text-gray-900'
        }`}>
          {score}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {13 - score} points to win
        </div>
      </div>

      {/* Scoring Buttons - Touch Optimized */}
      {isActive && !disabled && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 text-center mb-3">
            Add Points
          </div>
          
          {/* Primary scoring buttons (1-3 points) - Larger */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {scoreButtons.slice(0, 3).map(button => {
              const willExceed = score + button.points > 13
              const isDisabled = disabled || willExceed || !isActive
              
              return (
                <Button
                  key={button.points}
                  className={`h-16 text-xl font-bold text-white transition-all touch-manipulation ${
                    isDisabled 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : button.color
                  } ${isHolding ? 'scale-95' : 'scale-100'}`}
                  disabled={isDisabled}
                  onClick={() => handleScoreUpdate(button.points)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  title={willExceed ? 'Would exceed maximum score' : `Add ${button.points} point${button.points > 1 ? 's' : ''}`}
                >
                  {button.label}
                </Button>
              )
            })}
          </div>

          {/* Secondary scoring buttons (4-6 points) - Smaller but still touch-friendly */}
          <div className="grid grid-cols-3 gap-2">
            {scoreButtons.slice(3).map(button => {
              const willExceed = score + button.points > 13
              const isDisabled = disabled || willExceed || !isActive
              
              return (
                <Button
                  key={button.points}
                  className={`h-12 text-lg font-semibold text-white transition-all touch-manipulation ${
                    isDisabled 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : button.color
                  }`}
                  disabled={isDisabled}
                  onClick={() => handleScoreUpdate(button.points)}
                  title={willExceed ? 'Would exceed maximum score' : `Add ${button.points} point${button.points > 1 ? 's' : ''}`}
                >
                  {button.label}
                </Button>
              )
            })}
          </div>

          {/* Warning for high scoring ends */}
          {scoreButtons.some(btn => score + btn.points > 13) && (
            <div className="text-xs text-orange-600 text-center mt-2 flex items-center justify-center gap-1">
              <span>⚠️</span>
              <span>Some buttons disabled - would exceed 13 points</span>
            </div>
          )}
        </div>
      )}

      {/* Inactive state messaging */}
      {!isActive && (
        <div className="text-center">
          <div className="text-sm text-gray-500">
            {score === 13 ? 'Match Complete' : 'Match Inactive'}
          </div>
        </div>
      )}

      {/* Disabled state messaging */}
      {disabled && isActive && (
        <div className="text-center">
          <div className="text-sm text-orange-600 flex items-center justify-center gap-1">
            <span>⏳</span>
            <span>Submitting score...</span>
          </div>
        </div>
      )}

      {/* Team Statistics (if available) */}
      {team.stats && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">Wins:</span> {team.stats.matchesWon}
            </div>
            <div>
              <span className="font-medium">Win %:</span> {team.stats.matchesPlayed > 0 ? Math.round((team.stats.matchesWon / team.stats.matchesPlayed) * 100) : 0}%
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}