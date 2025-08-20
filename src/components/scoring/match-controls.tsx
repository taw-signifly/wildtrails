'use client'

import { useState } from 'react'
import { Match } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { startMatch, completeMatch } from '@/lib/actions/matches'
import { undoLastEnd } from '@/lib/actions/live-scoring'

interface MatchControlsProps {
  match: Match
  canUndo: boolean
  onUndo: () => void
  isSubmitting?: boolean
}

export function MatchControls({ 
  match, 
  canUndo, 
  onUndo, 
  isSubmitting = false 
}: MatchControlsProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [showConfirmComplete, setShowConfirmComplete] = useState(false)

  const isActive = match.status === 'active'
  const isComplete = match.status === 'completed'
  const isScheduled = match.status === 'scheduled'
  const hasEnds = match.ends.length > 0

  const handleStartMatch = async () => {
    setIsStarting(true)
    try {
      const result = await startMatch(match.id)
      if (result.success) {
        // Match started successfully - page will revalidate
        console.log('Match started successfully')
      } else {
        console.error('Failed to start match:', result.error)
      }
    } catch (error) {
      console.error('Error starting match:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleCompleteMatch = async () => {
    setIsCompleting(true)
    try {
      // Determine winner based on score
      const winnerId = match.score.team1 > match.score.team2 ? match.team1.id : match.team2.id
      const result = await completeMatch(match.id, match.score, winnerId)
      if (result.success) {
        console.log('Match completed successfully')
        setShowConfirmComplete(false)
      } else {
        console.error('Failed to complete match:', result.error)
      }
    } catch (error) {
      console.error('Error completing match:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleUndoLastEnd = async () => {
    setIsUndoing(true)
    try {
      const result = await undoLastEnd(match.id)
      if (result.success) {
        console.log('Last end undone successfully')
        onUndo() // Trigger parent component update
      } else {
        console.error('Failed to undo last end:', result.error)
      }
    } catch (error) {
      console.error('Error undoing last end:', error)
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Match Controls</h3>
        <div className="flex items-center gap-2">
          <Badge 
            variant={
              isActive ? 'default' : 
              isComplete ? 'secondary' : 
              'outline'
            }
            className="text-sm"
          >
            {match.status}
          </Badge>
          {match.courtId && (
            <Badge variant="outline" className="text-sm">
              Court {match.courtId}
            </Badge>
          )}
        </div>
      </div>

      {/* Match Information */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="font-medium text-gray-700">Round:</span>
          <span className="ml-2">{match.roundName}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Ends Played:</span>
          <span className="ml-2">{match.ends.length}</span>
        </div>
        {match.startTime && (
          <div>
            <span className="font-medium text-gray-700">Started:</span>
            <span className="ml-2">
              {new Date(match.startTime).toLocaleTimeString()}
            </span>
          </div>
        )}
        {match.duration && (
          <div>
            <span className="font-medium text-gray-700">Duration:</span>
            <span className="ml-2">{Math.round(match.duration)} min</span>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Start Match Button (for scheduled matches) */}
        {isScheduled && (
          <Button
            onClick={handleStartMatch}
            disabled={isStarting || isSubmitting}
            className="flex-1 min-w-32 h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
          >
            {isStarting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting...</span>
              </div>
            ) : (
              <>
                <span className="mr-2">▶️</span>
                Start Match
              </>
            )}
          </Button>
        )}

        {/* Undo Last End Button */}
        {isActive && canUndo && hasEnds && (
          <Button
            onClick={handleUndoLastEnd}
            disabled={isUndoing || isSubmitting}
            variant="outline"
            className="flex-1 min-w-32 h-12"
          >
            {isUndoing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                <span>Undoing...</span>
              </div>
            ) : (
              <>
                <span className="mr-2">↶</span>
                Undo Last End
              </>
            )}
          </Button>
        )}

        {/* Complete Match Button */}
        {isActive && !showConfirmComplete && (
          <Button
            onClick={() => setShowConfirmComplete(true)}
            disabled={isSubmitting}
            variant="outline"
            className="flex-1 min-w-32 h-12 border-red-300 text-red-700 hover:bg-red-50"
          >
            <span className="mr-2">🏁</span>
            Complete Match
          </Button>
        )}

        {/* Complete Match Confirmation */}
        {showConfirmComplete && (
          <div className="flex-1 min-w-full">
            <div className="p-4 border border-red-300 rounded-lg bg-red-50">
              <h4 className="font-medium text-red-800 mb-2">Complete Match?</h4>
              <p className="text-sm text-red-700 mb-4">
                This will finalize the match and advance the tournament bracket. 
                This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCompleteMatch}
                  disabled={isCompleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isCompleting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Completing...</span>
                    </div>
                  ) : (
                    'Yes, Complete Match'
                  )}
                </Button>
                <Button
                  onClick={() => setShowConfirmComplete(false)}
                  variant="outline"
                  disabled={isCompleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Match Status Information */}
      {isComplete && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-lg">🏆</span>
            <span className="font-medium">
              Match Complete - {match.winner === match.team1.id ? match.team1.name : match.team2.name} wins
            </span>
          </div>
          <div className="text-sm text-green-700 mt-1">
            Final Score: {match.score.team1} - {match.score.team2}
            {match.endTime && (
              <span className="ml-3">
                Completed at {new Date(match.endTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div>• Use the scoring buttons above to add points to teams</div>
          <div>• Complete end-by-end scoring for detailed tracking</div>
          <div>• Undo the last end if you made a mistake</div>
          {isScheduled && (
            <div>• Click &quot;Start Match&quot; to begin scoring</div>
          )}
          {isActive && (
            <div>• Click &quot;Complete Match&quot; when one team reaches 13 points</div>
          )}
        </div>
      </div>
    </Card>
  )
}