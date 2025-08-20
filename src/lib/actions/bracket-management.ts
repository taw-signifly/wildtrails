'use server'

import { revalidatePath } from 'next/cache'
import { matchDB } from '@/lib/db/matches'
import { tournamentDB } from '@/lib/db/tournaments'
import { broadcastBracketUpdate } from '@/lib/api/sse'
import { Match, Tournament, BracketType, TournamentType, Team } from '@/types'
import { ActionResult } from '@/types/actions'
import { BracketGenerator } from '@/lib/tournament'
import type { BracketGenerationOptions, TeamRanking, TieBreaker, StandingsMetadata } from '@/lib/tournament/types'

/**
 * Bracket node interface for tournament structure
 */
export interface BracketNode {
  id: string
  matchId?: string
  team1?: Team
  team2?: Team
  winner?: string
  round: number
  position: number
  bracketType: BracketType
  children?: string[] // IDs of child nodes (for elimination brackets)
  parent?: string // ID of parent node
}

/**
 * Tournament bracket update result
 */
export interface BracketUpdate {
  tournamentId: string
  affectedMatches: Match[]
  bracketStructure: BracketNode[]
  nextRoundMatches: Match[]
}

/**
 * Generate bracket matches for a tournament (form-compatible interface)
 */
export async function generateBracketMatchesForm(formData: FormData): Promise<ActionResult<{
  matches: Match[]
  bracketStructure: BracketNode[]
}>> {
  try {
    const tournamentId = formData.get('tournamentId')?.toString()
    const bracketType = formData.get('bracketType')?.toString() as TournamentType
    const teamsData = formData.get('teams')?.toString()
    
    if (!tournamentId || !bracketType) {
      return {
        success: false,
        error: 'Tournament ID and bracket type are required'
      }
    }
    
    let teams: Team[] = []
    if (teamsData) {
      try {
        teams = JSON.parse(teamsData)
      } catch {
        return {
          success: false,
          error: 'Invalid teams data format'
        }
      }
    }
    
    return await generateBracketMatches(tournamentId, bracketType, teams)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate bracket matches'
    }
  }
}

/**
 * Generate bracket matches for a tournament (programmatic interface)
 */
export async function generateBracketMatches(
  tournamentId: string,
  bracketType: TournamentType,
  teams: Team[],
  options?: Partial<BracketGenerationOptions>
): Promise<ActionResult<{
  matches: Match[]
  bracketStructure: BracketNode[]
}>> {
  try {
    if (!tournamentId || !bracketType || !teams || teams.length === 0) {
      return {
        success: false,
        error: 'Tournament ID, bracket type, and teams are required'
      }
    }
    
    // Get tournament details
    const tournamentResult = await tournamentDB.findById(tournamentId)
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: 'Tournament not found'
      }
    }
    
    const tournament = tournamentResult.data
    
    // Ensure tournament type matches bracket type
    if (tournament.type !== bracketType) {
      await tournamentDB.update(tournamentId, { type: bracketType })
      tournament.type = bracketType
    }
    
    // Initialize bracket generator
    const bracketGenerator = new BracketGenerator()
    
    // Generate bracket using new tournament logic
    const bracketResult = await bracketGenerator.generateBracket(tournament, teams, options)
    
    // Bulk create matches
    const createResult = await matchDB.bulkCreate(bracketResult.matches)
    if (createResult.error) {
      return {
        success: false,
        error: createResult.error.message || 'Failed to create bracket matches'
      }
    }
    
    // Update tournament status
    await tournamentDB.update(tournamentId, {
      status: 'active'
    })
    
    // Revalidate pages
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/bracket`)
    
    // Broadcast bracket generation via SSE
    broadcastBracketUpdate(
      tournamentId, 
      '', 
      bracketResult.bracketStructure, 
      createResult.data.successful.map(m => m.id || '')
    )
    
    return {
      success: true,
      data: {
        matches: createResult.data.successful,
        bracketStructure: bracketResult.bracketStructure
      },
      message: `${createResult.data.successful.length} matches created successfully for ${bracketResult.metadata.format}`
    }
    
  } catch (error) {
    console.error('Error generating bracket matches:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while generating bracket matches'
    }
  }
}

/**
 * Update bracket progression after match completion
 */
export async function updateBracketProgression(
  tournamentId: string,
  matchId: string
): Promise<ActionResult<BracketUpdate>> {
  try {
    if (!tournamentId || !matchId) {
      return {
        success: false,
        error: 'Tournament ID and Match ID are required'
      }
    }
    
    // Get completed match
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    if (match.status !== 'completed' || !match.winner) {
      return {
        success: false,
        error: 'Match must be completed with a winner to update bracket progression'
      }
    }
    
    // Get tournament to determine bracket type
    const tournamentResult = await tournamentDB.findById(tournamentId)
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: 'Tournament not found'
      }
    }
    
    const tournament = tournamentResult.data
    
    // Get all tournament matches for context
    const allMatchesResult = await matchDB.findByTournament(tournamentId)
    if (allMatchesResult.error || !allMatchesResult.data) {
      return {
        success: false,
        error: 'Failed to retrieve tournament matches'
      }
    }
    
    const allMatches = allMatchesResult.data
    
    // Initialize bracket generator
    const bracketGenerator = new BracketGenerator()
    
    // Update bracket progression using new tournament logic
    const progressionResult = await bracketGenerator.updateBracketProgression(
      match, 
      tournament, 
      allMatches
    )
    
    // Create new matches if needed
    if (progressionResult.newMatches.length > 0) {
      const createResult = await matchDB.bulkCreate(progressionResult.newMatches)
      if (createResult.error) {
        console.error('Failed to create new matches:', createResult.error)
      } else {
        // Add newly created matches to affected matches
        progressionResult.affectedMatches.push(...createResult.data.successful)
      }
    }
    
    // Check if tournament is complete
    const isComplete = bracketGenerator.isComplete(tournament, allMatches)
    if (isComplete) {
      await tournamentDB.update(tournamentId, {
        status: 'completed'
      })
    }
    
    // Revalidate pages
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/bracket`)
    revalidatePath(`/matches/${matchId}`)
    
    // Broadcast bracket progression update via SSE
    broadcastBracketUpdate(
      tournamentId, 
      matchId, 
      progressionResult.updatedBracketStructure, 
      progressionResult.affectedMatches.map(m => m.id)
    )
    
    return {
      success: true,
      data: {
        tournamentId,
        affectedMatches: progressionResult.affectedMatches,
        bracketStructure: progressionResult.updatedBracketStructure,
        nextRoundMatches: progressionResult.newMatches as Match[]
      },
      message: progressionResult.isComplete 
        ? 'Tournament completed successfully!' 
        : 'Bracket progression updated successfully'
    }
    
  } catch (error) {
    console.error('Error updating bracket progression:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating bracket progression'
    }
  }
}

/**
 * Get active tournament matches
 */
export async function getActiveTournamentMatches(tournamentId: string): Promise<ActionResult<{
  active: Match[]
  scheduled: Match[]
  completed: Match[]
  total: number
}>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Get all matches for tournament
    const matchesResult = await matchDB.findByTournament(tournamentId)
    if (matchesResult.error) {
      return {
        success: false,
        error: matchesResult.error.message || 'Failed to fetch tournament matches'
      }
    }
    
    const matches = matchesResult.data || []
    
    // Categorize matches by status
    const active = matches.filter(m => m.status === 'active')
    const scheduled = matches.filter(m => m.status === 'scheduled')
    const completed = matches.filter(m => m.status === 'completed')
    
    return {
      success: true,
      data: {
        active,
        scheduled,
        completed,
        total: matches.length
      }
    }
    
  } catch (error) {
    console.error('Error getting active tournament matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting active tournament matches'
    }
  }
}

/**
 * Get current bracket structure for tournament
 */
export async function getBracketStructure(tournamentId: string): Promise<ActionResult<BracketNode[]>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Get tournament details
    const tournamentResult = await tournamentDB.findById(tournamentId)
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: 'Tournament not found'
      }
    }
    
    // Get all matches for this tournament
    const matchesResult = await matchDB.findByTournament(tournamentId)
    if (matchesResult.error) {
      return {
        success: false,
        error: 'Failed to retrieve tournament matches'
      }
    }
    
    // Build bracket structure from matches
    const bracketNodes = buildBracketNodesFromMatches(matchesResult.data)
    
    return {
      success: true,
      data: bracketNodes
    }
    
  } catch (error) {
    console.error('Error getting bracket structure:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting bracket structure'
    }
  }
}

/**
 * Advance winner to next round
 */
export async function advanceWinnerToBracket(
  matchId: string,
  winnerId: string
): Promise<ActionResult<BracketUpdate>> {
  try {
    if (!matchId || !winnerId) {
      return {
        success: false,
        error: 'Match ID and Winner ID are required'
      }
    }
    
    // Get match
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    
    // Use existing bracket progression logic
    return await updateBracketProgression(match.tournamentId, matchId)
    
  } catch (error) {
    console.error('Error advancing winner to bracket:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while advancing winner to bracket'
    }
  }
}

/**
 * Get bracket results for a specific round
 */
export async function getBracketResults(
  tournamentId: string,
  round: number,
  bracketType: BracketType
): Promise<ActionResult<{
  winners: string[]
  losers: string[]
  matches: Match[]
}>> {
  try {
    if (!tournamentId || !round || !bracketType) {
      return {
        success: false,
        error: 'Tournament ID, round, and bracket type are required'
      }
    }
    
    const result = await matchDB.getBracketResults(tournamentId, round, bracketType)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get bracket results'
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error getting bracket results:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting bracket results'
    }
  }
}

/**
 * Calculate tournament standings using advanced bracket logic
 */
export async function calculateTournamentStandings(
  tournamentId: string
): Promise<ActionResult<{
  rankings: TeamRanking[]
  tieBreakers: TieBreaker[]
  metadata: StandingsMetadata
}>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Get tournament details
    const tournamentResult = await tournamentDB.findById(tournamentId)
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: 'Tournament not found'
      }
    }
    
    const tournament = tournamentResult.data
    
    // Get all tournament matches
    const matchesResult = await matchDB.findByTournament(tournamentId)
    if (matchesResult.error || !matchesResult.data) {
      return {
        success: false,
        error: 'Failed to retrieve tournament matches'
      }
    }
    
    const matches = matchesResult.data
    
    // Initialize bracket generator
    const bracketGenerator = new BracketGenerator()
    
    // Calculate standings using advanced tournament logic
    const standings = await bracketGenerator.calculateStandings(tournament, matches)
    
    return {
      success: true,
      data: standings
    }
    
  } catch (error) {
    console.error('Error calculating tournament standings:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while calculating tournament standings'
    }
  }
}

/**
 * Build bracket node structure from matches
 */
function buildBracketNodesFromMatches(matches: Match[]): BracketNode[] {
  const bracketNodes: BracketNode[] = []
  
  // Sort matches by round and position for proper bracket order
  const sortedMatches = matches.sort((a, b) => {
    // Sort by round first, then by position/bracket order
    if (a.round !== b.round) {
      return a.round - b.round
    }
    // Use match ID as fallback for consistent ordering
    return a.id.localeCompare(b.id)
  })
  
  for (const match of sortedMatches) {
    const bracketNode: BracketNode = {
      id: match.id,
      matchId: match.id,
      round: match.round,
      position: 0, // Will be calculated based on bracket structure
      bracketType: match.bracketType,
      team1: match.team1,
      team2: match.team2,
      winner: match.winner
    }
    
    bracketNodes.push(bracketNode)
  }
  
  return bracketNodes
}

// Note: Legacy helper functions have been removed as they are replaced by the new tournament format system