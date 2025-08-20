'use server'

import { revalidatePath } from 'next/cache'
import { matchDB } from '@/lib/db/matches'
import { ScoreSchema, EndSchema, BouleSchema } from '@/lib/validation/match'
import { resultToActionResult, parseFormDataField, parseFormDataNumber, formatZodErrors } from '@/lib/api/action-utils'
import { broadcastScoreUpdate, broadcastEndScored } from '@/lib/api/sse'
import { Match, Score, End, Boule, Position, MatchStatus } from '@/types'
import { ActionResult } from '@/types/actions'

/**
 * Convert FormData to Score data for live scoring
 */
function formDataToScoreData(formData: FormData): Partial<Score> {
  const data: Partial<Score> = {}
  
  const team1Score = parseFormDataField(formData, 'team1', (v) => 
    parseFormDataNumber(v, 0, 13), false
  )
  if (team1Score !== undefined) data.team1 = team1Score
  
  const team2Score = parseFormDataField(formData, 'team2', (v) => 
    parseFormDataNumber(v, 0, 13), false
  )
  if (team2Score !== undefined) data.team2 = team2Score
  
  // Determine if game is complete based on Petanque rules
  if (team1Score !== undefined && team2Score !== undefined) {
    data.isComplete = team1Score === 13 || team2Score === 13
  }
  
  return data
}

/**
 * Convert FormData to End data for end-by-end scoring
 */
function formDataToEndData(formData: FormData): Omit<End, 'id' | 'createdAt'> {
  const endNumber = parseFormDataField(formData, 'endNumber', (v) => 
    parseFormDataNumber(v, 1, 50), true
  )!
  
  const winner = parseFormDataField(formData, 'winner', (v) => v.trim(), true)!
  
  const points = parseFormDataField(formData, 'points', (v) => 
    parseFormDataNumber(v, 1, 6), true
  )!
  
  // Jack position (optional)
  let jackPosition: Position | undefined
  const jackX = parseFormDataField(formData, 'jackPositionX', (v) => 
    parseFloat(v), false
  )
  const jackY = parseFormDataField(formData, 'jackPositionY', (v) => 
    parseFloat(v), false
  )
  
  if (jackX !== undefined && jackY !== undefined) {
    jackPosition = { x: jackX, y: jackY }
  } else {
    // Default position if not provided
    jackPosition = { x: 7.5, y: 2.5 } // Middle of standard court
  }
  
  // Parse boules data (optional) with proper validation
  let boules: Boule[] = []
  const boulesData = formData.getAll('boules')
  if (boulesData.length > 0) {
    boules = boulesData.map((bouleData, index) => {
      try {
        const parsed = JSON.parse(bouleData.toString())
        // Validate parsed data with Zod schema
        const validatedBoule = BouleSchema.parse({
          id: parsed.id || `boule-${index}`,
          teamId: parsed.teamId,
          playerId: parsed.playerId,
          position: parsed.position,
          distance: parsed.distance,
          order: parsed.order || index + 1
        })
        return validatedBoule
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          throw new Error(`Invalid JSON in boule data at index ${index}`)
        }
        throw new Error(`Invalid boule data at index ${index}: ${parseError instanceof Error ? parseError.message : 'Validation failed'}`)
      }
    })
  }
  
  const duration = parseFormDataField(formData, 'duration', (v) => 
    parseFormDataNumber(v, 0, 3600), false
  )
  
  return {
    endNumber,
    jackPosition,
    boules,
    winner,
    points,
    duration,
    completed: true
  }
}

/**
 * Update match score in real-time (form-compatible interface)
 */
export async function updateMatchScoreForm(formData: FormData): Promise<ActionResult<Match>> {
  try {
    const matchId = formData.get('matchId')?.toString()
    const team1Score = formData.get('team1Score')?.toString()
    const team2Score = formData.get('team2Score')?.toString()
    const isComplete = formData.get('isComplete') === 'true'
    
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    const scoreUpdate: Partial<Score> = {
      isComplete
    }
    
    if (team1Score !== undefined && team1Score !== '') {
      scoreUpdate.team1 = parseInt(team1Score, 10)
    }
    
    if (team2Score !== undefined && team2Score !== '') {
      scoreUpdate.team2 = parseInt(team2Score, 10)
    }
    
    return await updateMatchScore(matchId, scoreUpdate)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update match score'
    }
  }
}

/**
 * Update match score in real-time (programmatic interface)
 */
export async function updateMatchScore(matchId: string, scoreUpdate: Partial<Score>): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Validate score data
    const validation = ScoreSchema.safeParse({
      team1: scoreUpdate.team1 ?? 0,
      team2: scoreUpdate.team2 ?? 0,
      isComplete: scoreUpdate.isComplete ?? false
    })
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid score data',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Validate Petanque rules
    const team1 = validation.data.team1
    const team2 = validation.data.team2
    
    if (team1 < 0 || team2 < 0) {
      return {
        success: false,
        error: 'Score cannot be negative'
      }
    }
    
    if (team1 > 13 || team2 > 13) {
      return {
        success: false,
        error: 'Maximum score is 13 points in Petanque'
      }
    }
    
    if (team1 === 13 && team2 === 13) {
      return {
        success: false,
        error: 'Both teams cannot have maximum score'
      }
    }
    
    if (validation.data.isComplete && team1 !== 13 && team2 !== 13) {
      return {
        success: false,
        error: 'Game must end when one team reaches 13 points'
      }
    }
    
    // Update score in database
    const result = await matchDB.updateScore(matchId, validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Score updated successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      
      // Broadcast real-time score update via SSE
      broadcastScoreUpdate(matchId, actionResult.data.score || { team1: 0, team2: 0, isComplete: false })
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating match score:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the score'
    }
  }
}

/**
 * Submit end score via form (progressive enhancement)
 */
export async function submitEndScore(matchId: string, formData: FormData): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Convert FormData to end data
    const endData = formDataToEndData(formData)
    
    // Validate the end data
    const validation = EndSchema.omit({ id: true, createdAt: true }).safeParse(endData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Validate Petanque rules for this end
    if (validation.data.points < 1 || validation.data.points > 6) {
      return {
        success: false,
        error: 'End points must be between 1 and 6',
        fieldErrors: { points: ['End points must be between 1 and 6'] }
      }
    }
    
    // Get current match to validate winner
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    if (match.status !== 'active') {
      return {
        success: false,
        error: 'Can only score ends for active matches'
      }
    }
    
    // Validate winner is one of the participating teams
    if (validation.data.winner !== match.team1?.id && validation.data.winner !== match.team2?.id) {
      return {
        success: false,
        error: 'Winner must be one of the participating teams',
        fieldErrors: { winner: ['Winner must be one of the participating teams'] }
      }
    }
    
    // Add end to match
    const result = await matchDB.addEnd(matchId, validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'End scored successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      
      // Broadcast real-time end scored event via SSE
      const ends = actionResult.data.ends || []
      if (ends.length > 0) {
        const lastEnd = ends[ends.length - 1]
        broadcastEndScored(matchId, lastEnd, actionResult.data.score || { team1: 0, team2: 0, isComplete: false })
      }
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error submitting end score:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while submitting the end score'
    }
  }
}

/**
 * Add an end to a match (programmatic use)
 */
export async function addEndToMatch(
  matchId: string,
  endData: Omit<End, 'id' | 'createdAt'>
): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Validate end data
    const validation = EndSchema.omit({ id: true, createdAt: true }).safeParse(endData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid end data',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Add end to match in database
    const result = await matchDB.addEnd(matchId, validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'End added successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error adding end to match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while adding the end'
    }
  }
}

/**
 * Update an existing end in a match
 */
export async function updateEndScore(
  matchId: string,
  endId: string,
  endUpdate: Partial<End>
): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    if (!endId) {
      return {
        success: false,
        error: 'End ID is required'
      }
    }
    
    // Update end in database
    const result = await matchDB.updateEnd(matchId, endId, endUpdate)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'End updated successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating end score:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the end'
    }
  }
}

/**
 * Validate match score against Petanque rules
 */
export async function validateMatchScore(matchId: string, score: Score): Promise<ActionResult<{
  valid: boolean
  errors: string[]
  warnings: string[]
}>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    const errors: string[] = []
    const warnings: string[] = []
    
    // Basic Petanque rule validation
    if (score.team1 < 0 || score.team2 < 0) {
      errors.push('Scores cannot be negative')
    }
    
    if (score.team1 > 13 || score.team2 > 13) {
      errors.push('Maximum score is 13 points in Petanque')
    }
    
    if (score.team1 === 13 && score.team2 === 13) {
      errors.push('Both teams cannot have maximum score')
    }
    
    if (score.isComplete && score.team1 !== 13 && score.team2 !== 13) {
      errors.push('Game must end when one team reaches 13 points')
    }
    
    if (!score.isComplete && (score.team1 === 13 || score.team2 === 13)) {
      errors.push('Game must be marked complete when a team reaches 13 points')
    }
    
    // Get match to validate against end-by-end scoring
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.data) {
      const match = matchResult.data
      
      // Validate score consistency with ends
      const team1EndPoints = (match.ends || [])
        .filter((end: any) => end.winner === match.team1?.id)
        .reduce((sum: any, end: any) => sum + end.points, 0)
      
      const team2EndPoints = (match.ends || [])
        .filter((end: any) => end.winner === match.team2?.id)
        .reduce((sum: any, end: any) => sum + end.points, 0)
      
      if (score.team1 !== team1EndPoints) {
        errors.push(`Team 1 score (${score.team1}) doesn't match sum of end points (${team1EndPoints})`)
      }
      
      if (score.team2 !== team2EndPoints) {
        errors.push(`Team 2 score (${score.team2}) doesn't match sum of end points (${team2EndPoints})`)
      }
      
      // Warnings for unusual scores
      const scoreDifference = Math.abs(score.team1 - score.team2)
      if (scoreDifference > 10) {
        warnings.push('Large score difference - please verify accuracy')
      }
      
      if ((match.ends || []).length > 20) {
        warnings.push('Unusually long game with many ends')
      }
    }
    
    return {
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
        warnings
      }
    }
    
  } catch (error) {
    console.error('Error validating match score:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while validating the score'
    }
  }
}

/**
 * Get match progress and statistics
 */
export async function getMatchProgress(matchId: string): Promise<ActionResult<{
  match: Match
  progress: {
    percentage: number
    currentScore: Score
    totalEnds: number
    estimatedTimeRemaining?: number
  }
  statistics: {
    averageEndDuration: number
    pointsPerEnd: {
      team1: number
      team2: number
    }
    largestEnd: {
      points: number
      winner: string
      endNumber: number
    }
  }
}>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get match data
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    
    // Calculate progress
    const maxScore = Math.max(match.score?.team1 || 0, match.score?.team2 || 0)
    const progressPercentage = match.status === 'completed' ? 100 : Math.round((maxScore / 13) * 100)
    
    // Calculate statistics
    const ends = match.ends || []
    const totalEnds = ends.length
    
    let averageEndDuration = 0
    if (totalEnds > 0) {
      const totalDuration = ends.reduce((sum: any, end: any) => sum + (end.duration || 0), 0)
      averageEndDuration = totalDuration / totalEnds
    }
    
    const team1Points = ends.filter((e: any) => e.winner === match.team1?.id).reduce((sum: any, e: any) => sum + e.points, 0)
    const team2Points = ends.filter((e: any) => e.winner === match.team2?.id).reduce((sum: any, e: any) => sum + e.points, 0)
    
    const team1Ends = ends.filter((e: any) => e.winner === match.team1?.id)
    const team2Ends = ends.filter((e: any) => e.winner === match.team2?.id)
    
    const pointsPerEnd = {
      team1: team1Ends.length > 0 ? team1Points / team1Ends.length : 0,
      team2: team2Ends.length > 0 ? team2Points / team2Ends.length : 0
    }
    
    // Find largest end
    let largestEnd = {
      points: 0,
      winner: '',
      endNumber: 0
    }
    
    ends.forEach((end: any) => {
      if (end.points > largestEnd.points) {
        largestEnd = {
          points: end.points,
          winner: end.winner,
          endNumber: end.endNumber
        }
      }
    })
    
    // Estimate time remaining (rough calculation)
    let estimatedTimeRemaining: number | undefined
    if (match.status === 'active' && averageEndDuration > 0) {
      const remainingPoints = 13 - maxScore
      const estimatedRemainingEnds = Math.max(1, remainingPoints / Math.max(pointsPerEnd.team1, pointsPerEnd.team2))
      estimatedTimeRemaining = Math.round(estimatedRemainingEnds * averageEndDuration)
    }
    
    return {
      success: true,
      data: {
        match,
        progress: {
          percentage: progressPercentage,
          currentScore: match.score || { team1: 0, team2: 0, isComplete: false },
          totalEnds,
          estimatedTimeRemaining
        },
        statistics: {
          averageEndDuration,
          pointsPerEnd,
          largestEnd
        }
      }
    }
    
  } catch (error) {
    console.error('Error getting match progress:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting match progress'
    }
  }
}

/**
 * Get match scoring history
 */
export async function getMatchHistory(matchId: string): Promise<ActionResult<{
  match: Match
  history: Array<{
    timestamp: string
    type: 'end' | 'score_update' | 'match_start' | 'match_complete'
    description: string
    data: any
  }>
}>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get match data
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    
    // Build history from match data
    const history: Array<{
      timestamp: string
      type: 'end' | 'score_update' | 'match_start' | 'match_complete'
      description: string
      data: any
    }> = []
    
    // Add match start event
    if (match.startTime) {
      history.push({
        timestamp: match.startTime,
        type: 'match_start',
        description: 'Match started',
        data: { status: 'active' }
      })
    }
    
    // Add end events
    (match.ends || []).forEach((end: any) => {
      const winnerTeam = end.winner === match.team1?.id ? match.team1 : match.team2
      history.push({
        timestamp: end.createdAt,
        type: 'end',
        description: `End ${end.endNumber}: ${winnerTeam?.name || 'Unknown Team'} scores ${end.points} point${end.points !== 1 ? 's' : ''}`,
        data: end
      })
    })
    
    // Add match completion event
    if (match.status === 'completed' && match.endTime) {
      const winnerTeam = match.winner === match.team1?.id ? match.team1 : match.team2
      history.push({
        timestamp: match.endTime,
        type: 'match_complete',
        description: `Match completed - ${winnerTeam?.name || 'Unknown Team'} wins ${match.score?.team1 || 0}-${match.score?.team2 || 0}`,
        data: { winner: match.winner, finalScore: match.score }
      })
    }
    
    // Sort history by timestamp
    history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    return {
      success: true,
      data: {
        match,
        history
      }
    }
    
  } catch (error) {
    console.error('Error getting match history:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting match history'
    }
  }
}

/**
 * Get end-by-end details for a match
 */
export async function getEndByEndDetails(matchId: string): Promise<ActionResult<{
  match: Match
  endDetails: Array<{
    end: End
    cumulativeScore: {
      team1: number
      team2: number
    }
    gamePoint: boolean
    matchPoint: boolean
  }>
}>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get match data
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    
    // Build end-by-end details with cumulative scores
    const endDetails = []
    let team1Cumulative = 0
    let team2Cumulative = 0
    
    for (const end of (match.ends || [] as any[])) {
      // Update cumulative scores
      if (end.winner === match.team1?.id) {
        team1Cumulative += end.points
      } else if (end.winner === match.team2?.id) {
        team2Cumulative += end.points
      }
      
      // Determine if this was a game point or match point
      const gamePoint = team1Cumulative >= 12 || team2Cumulative >= 12
      const matchPoint = team1Cumulative === 13 || team2Cumulative === 13
      
      endDetails.push({
        end,
        cumulativeScore: {
          team1: team1Cumulative,
          team2: team2Cumulative
        },
        gamePoint,
        matchPoint
      })
    }
    
    return {
      success: true,
      data: {
        match,
        endDetails
      }
    }
    
  } catch (error) {
    console.error('Error getting end-by-end details:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting end-by-end details'
    }
  }
}

/**
 * Undo last end (for corrections)
 */
export async function undoLastEnd(matchId: string): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get current match
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    
    if ((match.ends || []).length === 0) {
      return {
        success: false,
        error: 'No ends to undo'
      }
    }
    
    if (match.status === 'completed') {
      return {
        success: false,
        error: 'Cannot undo ends from completed matches'
      }
    }
    
    // Remove last end and recalculate score
    const updatedEnds = (match.ends || []).slice(0, -1)
    
    const team1Score = updatedEnds
      .filter((e: any) => e.winner === match.team1?.id)
      .reduce((sum: any, e: any) => sum + e.points, 0)
    
    const team2Score = updatedEnds
      .filter((e: any) => e.winner === match.team2?.id)
      .reduce((sum: any, e: any) => sum + e.points, 0)
    
    const updatedScore: Score = {
      team1: team1Score,
      team2: team2Score,
      isComplete: false
    }
    
    // Update match in database
    const result = await matchDB.update(matchId, {
      ends: updatedEnds,
      score: updatedScore,
      status: 'active' as MatchStatus,
      winner: undefined,
      endTime: undefined
    })
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Last end undone successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error undoing last end:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while undoing the last end'
    }
  }
}

/**
 * Update match score via form (for quick score updates)
 */
export async function updateScoreForm(matchId: string, formData: FormData): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Convert FormData to score data
    const scoreData = formDataToScoreData(formData)
    
    if (scoreData.team1 === undefined || scoreData.team2 === undefined) {
      return {
        success: false,
        error: 'Both team scores are required'
      }
    }
    
    // Use the main score update function
    return await updateMatchScore(matchId, scoreData)
    
  } catch (error) {
    console.error('Error updating score via form:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the score'
    }
  }
}