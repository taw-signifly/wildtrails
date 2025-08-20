'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { Match, Score, End } from '@/types'
import { updateMatchScore, addEndToMatch } from '@/lib/actions/live-scoring'

interface OptimisticAction {
  id: string
  type: 'score_update' | 'end_score'
  timestamp: number
  previousState: {
    score: Score
    ends: End[]
  }
  optimisticState: {
    score: Score
    ends?: End[]
  }
  isSubmitting: boolean
  error?: string
}

interface UseOptimisticScoringReturn {
  optimisticMatch: Match | null
  updateScore: (teamId: string, points: number) => Promise<void>
  submitEndScore: (endData: {
    endNumber: number
    winner: string
    points: number
    jackPosition?: { x: number, y: number }
    duration?: number
  }) => Promise<void>
  isSubmitting: boolean
  lastError: string | null
  canUndo: boolean
  undoLastAction: () => void
  clearOptimisticState: () => void
}

export function useOptimisticScoring(
  baseMatch: Match | null
): UseOptimisticScoringReturn {
  const [optimisticActions, setOptimisticActions] = useState<OptimisticAction[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const actionIdCounter = useRef(0)

  // Calculate optimistic match state by applying all pending actions
  const optimisticMatch = useMemo(() => {
    if (!baseMatch || optimisticActions.length === 0) {
      return baseMatch
    }

    // Start with the base match and apply all optimistic actions in order
    let currentScore = { ...baseMatch.score || { team1: 0, team2: 0, isComplete: false } }
    let currentEnds = [...(baseMatch.ends || [])]

    optimisticActions.forEach(action => {
      switch (action.type) {
        case 'score_update':
          currentScore = { ...action.optimisticState.score }
          break
        case 'end_score':
          if (action.optimisticState.ends) {
            currentEnds = [...action.optimisticState.ends]
          }
          currentScore = { ...action.optimisticState.score }
          break
      }
    })

    return {
      ...baseMatch,
      score: currentScore,
      ends: currentEnds
    }
  }, [baseMatch, optimisticActions])

  // Generate unique action ID
  const generateActionId = useCallback(() => {
    actionIdCounter.current += 1
    return `action-${Date.now()}-${actionIdCounter.current}`
  }, [])

  // Calculate new score after adding points to a team
  const calculateNewScore = useCallback((currentScore: Score, teamId: string, points: number): Score => {
    const newScore = { ...currentScore }
    
    if (teamId === baseMatch?.team1?.id) {
      newScore.team1 = Math.min(13, currentScore.team1 + points)
    } else if (teamId === baseMatch?.team2?.id) {
      newScore.team2 = Math.min(13, currentScore.team2 + points)
    }
    
    // Check if game is complete
    newScore.isComplete = newScore.team1 === 13 || newScore.team2 === 13
    
    return newScore
  }, [baseMatch])

  // Optimistically update match score
  const updateScore = useCallback(async (teamId: string, points: number) => {
    if (!baseMatch || isSubmitting) return

    const actionId = generateActionId()
    const currentState = optimisticMatch || baseMatch
    const newScore = calculateNewScore(currentState.score || { team1: 0, team2: 0, isComplete: false }, teamId, points)

    // Add optimistic action
    const optimisticAction: OptimisticAction = {
      id: actionId,
      type: 'score_update',
      timestamp: Date.now(),
      previousState: {
        score: currentState.score || { team1: 0, team2: 0, isComplete: false },
        ends: currentState.ends || []
      },
      optimisticState: {
        score: newScore
      },
      isSubmitting: true
    }

    setOptimisticActions(prev => [...prev, optimisticAction])
    setIsSubmitting(true)
    setLastError(null)

    try {
      // Submit to server
      const result = await updateMatchScore(baseMatch.id, newScore)

      if (result.success) {
        // Remove the optimistic action on success
        setOptimisticActions(prev => prev.filter(action => action.id !== actionId))
      } else {
        // Mark action as failed
        setOptimisticActions(prev => prev.map(action => 
          action.id === actionId 
            ? { ...action, isSubmitting: false, error: result.error }
            : action
        ))
        setLastError(result.error)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setOptimisticActions(prev => prev.map(action => 
        action.id === actionId 
          ? { ...action, isSubmitting: false, error: errorMessage }
          : action
      ))
      setLastError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }, [baseMatch, isSubmitting, optimisticMatch, generateActionId, calculateNewScore])

  // Submit end score with optimistic updates
  const submitEndScore = useCallback(async (endData: {
    endNumber: number
    winner: string
    points: number
    jackPosition?: { x: number, y: number }
    duration?: number
  }) => {
    if (!baseMatch || isSubmitting) return

    const actionId = generateActionId()
    const currentState = optimisticMatch || baseMatch

    // Create optimistic end
    const newEnd: End = {
      id: `optimistic-${actionId}`,
      endNumber: endData.endNumber,
      jackPosition: endData.jackPosition || { x: 7.5, y: 2.5 },
      boules: [], // Will be filled by actual server response
      winner: endData.winner,
      points: endData.points,
      duration: endData.duration,
      completed: true,
      createdAt: new Date().toISOString()
    }

    const newEnds = [...(currentState.ends || []), newEnd]
    
    // Calculate new score from ends
    const newScore: Score = {
      team1: newEnds
        .filter(end => end.winner === baseMatch.team1?.id)
        .reduce((sum, end) => sum + end.points, 0),
      team2: newEnds
        .filter(end => end.winner === baseMatch.team2?.id)
        .reduce((sum, end) => sum + end.points, 0),
      isComplete: false
    }
    
    // Check if game is complete
    newScore.isComplete = newScore.team1 === 13 || newScore.team2 === 13

    const optimisticAction: OptimisticAction = {
      id: actionId,
      type: 'end_score',
      timestamp: Date.now(),
      previousState: {
        score: currentState.score || { team1: 0, team2: 0, isComplete: false },
        ends: currentState.ends || []
      },
      optimisticState: {
        score: newScore,
        ends: newEnds
      },
      isSubmitting: true
    }

    setOptimisticActions(prev => [...prev, optimisticAction])
    setIsSubmitting(true)
    setLastError(null)

    try {
      // Submit to server using programmatic interface
      const endToAdd: Omit<End, 'id' | 'createdAt'> = {
        endNumber: endData.endNumber,
        jackPosition: endData.jackPosition || { x: 7.5, y: 2.5 },
        boules: [], // Will be populated by the server
        winner: endData.winner,
        points: endData.points,
        duration: endData.duration,
        completed: true
      }

      const result = await addEndToMatch(baseMatch.id, endToAdd)

      if (result.success) {
        // Remove the optimistic action on success
        setOptimisticActions(prev => prev.filter(action => action.id !== actionId))
      } else {
        // Mark action as failed
        setOptimisticActions(prev => prev.map(action => 
          action.id === actionId 
            ? { ...action, isSubmitting: false, error: result.error }
            : action
        ))
        setLastError(result.error)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setOptimisticActions(prev => prev.map(action => 
        action.id === actionId 
          ? { ...action, isSubmitting: false, error: errorMessage }
          : action
      ))
      setLastError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }, [baseMatch, isSubmitting, optimisticMatch, generateActionId])

  // Check if we can undo (have failed actions)
  const canUndo = useMemo(() => {
    return optimisticActions.some(action => action.error)
  }, [optimisticActions])

  // Undo the last failed action
  const undoLastAction = useCallback(() => {
    setOptimisticActions(prev => {
      const failedActionIndex = prev.findLastIndex(action => action.error)
      if (failedActionIndex >= 0) {
        return prev.filter((_, index) => index !== failedActionIndex)
      }
      return prev
    })
    setLastError(null)
  }, [])

  // Clear all optimistic state
  const clearOptimisticState = useCallback(() => {
    setOptimisticActions([])
    setLastError(null)
  }, [])

  // Get the most recent error from failed actions
  const currentError = useMemo(() => {
    const failedAction = optimisticActions.find(action => action.error)
    return failedAction?.error || lastError
  }, [optimisticActions, lastError])

  return {
    optimisticMatch,
    updateScore,
    submitEndScore,
    isSubmitting: isSubmitting || optimisticActions.some(action => action.isSubmitting),
    lastError: currentError,
    canUndo,
    undoLastAction,
    clearOptimisticState
  }
}