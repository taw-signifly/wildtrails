'use server'

import { revalidatePath } from 'next/cache'
import { matchDB } from '@/lib/db/matches'
import { MatchFormDataSchema, MatchFiltersSchema } from '@/lib/validation/match'
import { parsePaginationParams, paginateArray } from '@/lib/api'
import { resultToActionResult, parseFormDataField, parseFormDataNumber, formatZodErrors } from '@/lib/api/action-utils'
import { broadcastMatchStart, broadcastMatchComplete, broadcastMatchUpdate } from '@/lib/api/sse'
import { Match, MatchFormData, MatchFilters, MatchStatus, BracketType, Score } from '@/types'
import { ActionResult } from '@/types/actions'
import { z } from 'zod'

/**
 * Convert FormData to MatchFormData object with type safety
 */
function formDataToMatchData(formData: FormData): Partial<MatchFormData> {
  const data: Partial<MatchFormData> = {}
  
  // Score data
  const team1Score = parseFormDataField(formData, 'team1Score', (v) => 
    parseFormDataNumber(v, 0, 13), false
  )
  if (team1Score !== undefined) data.team1Score = team1Score
  
  const team2Score = parseFormDataField(formData, 'team2Score', (v) => 
    parseFormDataNumber(v, 0, 13), false
  )
  if (team2Score !== undefined) data.team2Score = team2Score
  
  // End scores array parsing (if provided)
  const endScoresData = formData.getAll('endScores')
  if (endScoresData.length > 0) {
    const endScores = endScoresData.map((endScore, index) => {
      try {
        const parsedEnd = JSON.parse(endScore.toString())
        return {
          endNumber: parsedEnd.endNumber || index + 1,
          team1Points: parseFormDataNumber(parsedEnd.team1Points.toString(), 0, 6),
          team2Points: parseFormDataNumber(parsedEnd.team2Points.toString(), 0, 6),
          jackPosition: parsedEnd.jackPosition,
          boules: parsedEnd.boules
        }
      } catch {
        throw new Error(`Invalid end score data at index ${index}`)
      }
    })
    data.endScores = endScores
  }
  
  return data
}

/**
 * Get matches with filtering and pagination
 */
export async function getMatches(
  filters?: MatchFilters & { page?: number; limit?: number }
): Promise<ActionResult<{ matches: Match[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    
    // Apply filters to get matches
    let matchesResult
    
    if (filters?.status) {
      matchesResult = await matchDB.findByStatus(filters.status)
    } else if (filters?.round && filters?.bracketType) {
      // Find by specific round and bracket type
      const tournamentId = (filters as any).tournamentId
      if (!tournamentId) {
        return {
          success: false,
          error: 'Tournament ID is required when filtering by round and bracket type'
        }
      }
      matchesResult = await matchDB.findAll({ 
        tournamentId, 
        round: filters.round, 
        bracketType: filters.bracketType 
      })
    } else if (filters?.courtId) {
      matchesResult = await matchDB.findByCourt(filters.courtId)
    } else if (filters?.dateRange) {
      matchesResult = await matchDB.findInDateRange(
        new Date(filters.dateRange.start),
        new Date(filters.dateRange.end)
      )
    } else {
      matchesResult = await matchDB.findAll()
    }
    
    if (matchesResult.error) {
      return {
        success: false,
        error: matchesResult.error.message || 'Failed to fetch matches'
      }
    }
    
    const matches = matchesResult.data || []
    
    // Apply pagination
    const { paginatedData, paginationInfo } = paginateArray(matches, page, limit)
    
    return {
      success: true,
      data: {
        matches: paginatedData,
        pagination: paginationInfo
      }
    }
    
  } catch (error) {
    console.error('Error fetching matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching matches'
    }
  }
}

/**
 * Get matches by tournament ID
 */
export async function getMatchesByTournament(tournamentId: string): Promise<ActionResult<Match[]>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    const result = await matchDB.findByTournament(tournamentId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch tournament matches'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error fetching tournament matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching tournament matches'
    }
  }
}

/**
 * Get matches by player ID
 */
export async function getMatchesByPlayer(playerId: string): Promise<ActionResult<Match[]>> {
  try {
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    const result = await matchDB.findByPlayer(playerId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch player matches'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error fetching player matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching player matches'
    }
  }
}

/**
 * Get a single match by ID
 */
export async function getMatchById(id: string): Promise<ActionResult<Match>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    const result = await matchDB.findById(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch match'
      }
    }
    
    if (!result.data) {
      return {
        success: false,
        error: `Match with ID '${id}' not found`
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the match'
    }
  }
}

/**
 * Create a new match (programmatic use - matches are typically created during bracket generation)
 */
export async function createMatchData(data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<ActionResult<Match>> {
  try {
    // Create match in database
    const result = await matchDB.create(data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match created successfully')
    
    // Revalidate matches and tournament pages if successful
    if (actionResult.success) {
      revalidatePath('/matches')
      revalidatePath(`/tournaments/${data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the match'
    }
  }
}

/**
 * Update a match (form action)
 */
export async function updateMatch(id: string, formData: FormData): Promise<ActionResult<Match>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Convert FormData to match data
    const matchData = formDataToMatchData(formData)
    
    // Validate the data
    const validation = MatchFormDataSchema.safeParse(matchData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Get current match to preserve other data
    const currentMatchResult = await matchDB.findById(id)
    if (currentMatchResult.error || !currentMatchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    // Prepare update data
    const updateData: Partial<Match> = {}
    
    // Update score if provided
    if (validation.data.team1Score !== undefined && validation.data.team2Score !== undefined) {
      updateData.score = {
        team1: validation.data.team1Score,
        team2: validation.data.team2Score,
        isComplete: validation.data.team1Score === 13 || validation.data.team2Score === 13
      }
    }
    
    // Update match in database
    const result = await matchDB.update(id, updateData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match updated successfully')
    
    // Revalidate match and tournament pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${id}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the match'
    }
  }
}

/**
 * Update match data (programmatic use)
 */
export async function updateMatchData(id: string, data: Partial<Match>): Promise<ActionResult<Match>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Update match in database
    const result = await matchDB.update(id, data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match updated successfully')
    
    // Revalidate match and tournament pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${id}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the match'
    }
  }
}

/**
 * Delete (archive) a match
 */
export async function deleteMatch(id: string): Promise<ActionResult<{ id: string; archived: boolean }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get match first to get tournament ID for revalidation
    const matchResult = await matchDB.findById(id)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const tournamentId = matchResult.data.tournamentId
    
    // Delete (archive) match in database
    const result = await matchDB.delete(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to archive match'
      }
    }
    
    // Revalidate pages
    revalidatePath('/matches')
    revalidatePath(`/tournaments/${tournamentId}`)
    
    return {
      success: true,
      data: { id, archived: true },
      message: 'Match archived successfully'
    }
    
  } catch (error) {
    console.error('Error archiving match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while archiving the match'
    }
  }
}

/**
 * Search matches by tournament name or player names
 */
export async function searchMatches(
  query: string,
  filters?: MatchFilters
): Promise<ActionResult<Match[]>> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      }
    }
    
    // Get all matches first
    const matchesResult = await matchDB.findAll()
    if (matchesResult.error) {
      return {
        success: false,
        error: matchesResult.error.message || 'Failed to search matches'
      }
    }
    
    const matches = matchesResult.data || []
    const lowerQuery = query.toLowerCase()
    
    // Filter matches by search criteria
    let filteredMatches = matches.filter(match => {
      // Search in team names
      const team1Players = match.team1.players.map(p => p.displayName.toLowerCase()).join(' ')
      const team2Players = match.team2.players.map(p => p.displayName.toLowerCase()).join(' ')
      const roundName = match.roundName.toLowerCase()
      
      return team1Players.includes(lowerQuery) || 
             team2Players.includes(lowerQuery) ||
             roundName.includes(lowerQuery)
    })
    
    // Apply additional filters if provided
    if (filters?.status) {
      filteredMatches = filteredMatches.filter(m => m.status === filters.status)
    }
    
    if (filters?.round) {
      filteredMatches = filteredMatches.filter(m => m.round === filters.round)
    }
    
    if (filters?.bracketType) {
      filteredMatches = filteredMatches.filter(m => m.bracketType === filters.bracketType)
    }
    
    return {
      success: true,
      data: filteredMatches
    }
    
  } catch (error) {
    console.error('Error searching matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while searching matches'
    }
  }
}

/**
 * Start a match (change status from scheduled to active)
 */
export async function startMatch(matchId: string, courtId?: string): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Start match in database
    const result = await matchDB.startMatch(matchId, courtId)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match started successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      if (courtId) {
        revalidatePath(`/courts/${courtId}`)
      }
      
      // Broadcast match start event via SSE
      broadcastMatchStart(matchId, actionResult.data, courtId)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error starting match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while starting the match'
    }
  }
}

/**
 * Complete a match manually
 */
export async function completeMatch(
  matchId: string,
  finalScore: Score,
  winnerId: string
): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    if (!winnerId) {
      return {
        success: false,
        error: 'Winner ID is required'
      }
    }
    
    // Complete match in database
    const result = await matchDB.completeMatch(matchId, finalScore, winnerId)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match completed successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      if (actionResult.data.courtId) {
        revalidatePath(`/courts/${actionResult.data.courtId}`)
      }
      
      // Broadcast match completion event via SSE
      broadcastMatchComplete(matchId, actionResult.data)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error completing match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while completing the match'
    }
  }
}

/**
 * Cancel a match
 */
export async function cancelMatch(matchId: string, reason?: string): Promise<ActionResult<Match>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Cancel match in database
    const result = await matchDB.cancelMatch(matchId, reason)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Match cancelled successfully')
    
    // Revalidate pages if successful
    if (actionResult.success) {
      revalidatePath(`/matches/${matchId}`)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      if (actionResult.data.courtId) {
        revalidatePath(`/courts/${actionResult.data.courtId}`)
      }
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error cancelling match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while cancelling the match'
    }
  }
}

/**
 * Get live matches (active status)
 */
export async function getLiveMatches(): Promise<ActionResult<Match[]>> {
  try {
    const result = await matchDB.getLiveMatches()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch live matches'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error fetching live matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching live matches'
    }
  }
}

/**
 * Get tournament match statistics
 */
export async function getTournamentMatchStats(tournamentId: string): Promise<ActionResult<{
  totalMatches: number
  completedMatches: number
  activeMatches: number
  scheduledMatches: number
  cancelledMatches: number
  averageDuration: number
  totalDuration: number
}>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    const result = await matchDB.getTournamentStats(tournamentId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch tournament statistics'
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching tournament statistics:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching tournament statistics'
    }
  }
}

/**
 * Generate bracket matches for tournament (bulk create)
 */
export async function generateBracketMatches(
  matchesData: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<ActionResult<{
  successful: Match[]
  failed: { data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>; error: string }[]
}>> {
  try {
    if (!matchesData || matchesData.length === 0) {
      return {
        success: false,
        error: 'Match data is required'
      }
    }
    
    // Bulk create matches in database
    const result = await matchDB.bulkCreate(matchesData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, `${result.data?.successful.length || 0} matches created successfully`)
    
    // Revalidate pages if successful
    if (actionResult.success && actionResult.data.successful.length > 0) {
      revalidatePath('/matches')
      // Revalidate tournament pages for all tournaments involved
      const tournamentIds = [...new Set(matchesData.map(m => m.tournamentId))]
      tournamentIds.forEach(tournamentId => {
        revalidatePath(`/tournaments/${tournamentId}`)
      })
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error generating bracket matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while generating bracket matches'
    }
  }
}