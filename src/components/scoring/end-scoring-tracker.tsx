'use client'

import { useState, useMemo } from 'react'
import { Match, End } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface EndScoringTrackerProps {
  match: Match
  onEndScore: (endData: {
    endNumber: number
    winner: string
    points: number
    jackPosition?: { x: number, y: number }
    duration?: number
  }) => Promise<void>
  isSubmitting?: boolean
}

export function EndScoringTracker({ 
  match, 
  onEndScore, 
  isSubmitting = false 
}: EndScoringTrackerProps) {
  const [selectedWinner, setSelectedWinner] = useState<string>('')
  const [selectedPoints, setSelectedPoints] = useState<number>(0)
  const [endStartTime] = useState<number>(Date.now())

  const currentEndNumber = match.ends.length + 1
  const isMatchComplete = match.score.isComplete

  // Calculate running scores for display
  const runningScores = useMemo(() => {
    const scores: Record<string, number> = { [match.team1.id]: 0, [match.team2.id]: 0 }
    
    return match.ends.map((end) => {
      scores[end.winner] += end.points
      return {
        endNumber: end.endNumber,
        team1Score: scores[match.team1.id],
        team2Score: scores[match.team2.id],
        endData: end
      }
    })
  }, [match.ends, match.team1.id, match.team2.id])

  const handleSubmitEnd = async () => {
    if (!selectedWinner || !selectedPoints) return

    const duration = Math.round((Date.now() - endStartTime) / 1000)
    
    await onEndScore({
      endNumber: currentEndNumber,
      winner: selectedWinner,
      points: selectedPoints,
      jackPosition: { x: 7.5, y: 2.5 }, // Default center position
      duration
    })

    // Reset form
    setSelectedWinner('')
    setSelectedPoints(0)
  }

  const canSubmit = selectedWinner && selectedPoints > 0 && selectedPoints <= 6 && !isSubmitting

  return (
    <Card className="p-4 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">End-by-End Scoring</h3>
        <Badge variant={isMatchComplete ? 'secondary' : 'default'}>
          {isMatchComplete ? 'Complete' : `End ${currentEndNumber}`}
        </Badge>
      </div>

      {/* Current End Scoring (if match active) */}
      {!isMatchComplete && (
        <div className="mb-6 p-4 border rounded-lg bg-blue-50">
          <h4 className="font-medium mb-3 text-blue-900">Score End {currentEndNumber}</h4>
          
          {/* Winner Selection */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Which team won this end?
            </label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={selectedWinner === match.team1.id ? 'default' : 'outline'}
                className={`h-12 justify-start ${selectedWinner === match.team1.id ? 'bg-blue-600' : ''}`}
                onClick={() => setSelectedWinner(match.team1.id)}
                disabled={isSubmitting}
              >
                <span className="font-medium">{match.team1.name}</span>
              </Button>
              <Button
                variant={selectedWinner === match.team2.id ? 'default' : 'outline'}
                className={`h-12 justify-start ${selectedWinner === match.team2.id ? 'bg-blue-600' : ''}`}
                onClick={() => setSelectedWinner(match.team2.id)}
                disabled={isSubmitting}
              >
                <span className="font-medium">{match.team2.name}</span>
              </Button>
            </div>
          </div>

          {/* Points Selection */}
          {selectedWinner && (
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                How many points did they score? (1-6)
              </label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map(points => (
                  <Button
                    key={points}
                    variant={selectedPoints === points ? 'default' : 'outline'}
                    className={`h-12 text-lg font-bold ${
                      selectedPoints === points ? 'bg-green-600' : ''
                    }`}
                    onClick={() => setSelectedPoints(points)}
                    disabled={isSubmitting}
                  >
                    {points}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            className="w-full h-12 text-lg font-semibold"
            onClick={handleSubmitEnd}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </div>
            ) : (
              `Submit End ${currentEndNumber}`
            )}
          </Button>

          {/* Validation Messages */}
          {selectedWinner && selectedPoints > 0 && (
            <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-700">
              ✓ {selectedWinner === match.team1.id ? match.team1.name : match.team2.name} wins {selectedPoints} point{selectedPoints > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* End History */}
      <div>
        <h4 className="font-medium mb-3 flex items-center justify-between">
          <span>End History</span>
          <span className="text-sm text-gray-500">{match.ends.length} ends played</span>
        </h4>

        {match.ends.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">No ends played yet</p>
            <p className="text-xs mt-1">Scores will appear here as you play</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Headers */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-600 pb-2 border-b">
              <div>End</div>
              <div>Winner</div>
              <div>Pts</div>
              <div>Running Score</div>
            </div>

            {/* End History Rows */}
            {runningScores.map((endScore, index) => {
              const end = endScore.endData
              const winnerTeam = end.winner === match.team1.id ? match.team1 : match.team2
              const isLatest = index === runningScores.length - 1

              return (
                <div 
                  key={end.id}
                  className={`grid grid-cols-4 gap-2 text-sm py-2 rounded ${
                    isLatest ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div className="font-medium">#{end.endNumber}</div>
                  <div className="truncate text-xs">
                    {winnerTeam.name}
                  </div>
                  <div className="font-bold text-center">
                    +{end.points}
                  </div>
                  <div className="font-mono text-xs">
                    {endScore.team1Score} - {endScore.team2Score}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Match Summary */}
      {isMatchComplete && (
        <>
          <Separator className="my-4" />
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded">
            <div className="text-sm font-medium text-green-800 mb-1">
              Match Complete
            </div>
            <div className="text-lg font-bold text-green-900">
              {match.winner === match.team1.id ? match.team1.name : match.team2.name} wins
            </div>
            <div className="text-sm text-green-700 mt-1">
              Final Score: {match.score.team1} - {match.score.team2}
            </div>
            <div className="text-xs text-green-600 mt-2">
              {match.ends.length} ends played
              {match.duration && ` • ${Math.round(match.duration)} minutes`}
            </div>
          </div>
        </>
      )}
    </Card>
  )
}