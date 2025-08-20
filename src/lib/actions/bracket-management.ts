'use server'

import { revalidatePath } from 'next/cache'
import { matchDB } from '@/lib/db/matches'
import { tournamentDB } from '@/lib/db/tournaments'
import { resultToActionResult } from '@/lib/api/action-utils'
import { broadcastBracketUpdate, broadcastTournamentUpdate } from '@/lib/api/sse'
import { Match, Tournament, BracketType, TournamentType, Team } from '@/types'
import { ActionResult } from '@/types/actions'
import { BracketGenerator } from '@/lib/tournament'
import type { BracketGenerationOptions, SeedingOptions } from '@/lib/tournament/types'

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
    
    const bracketStructure = await getCurrentBracketStructure(tournamentId)
    
    return {
      success: true,
      data: bracketStructure
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
  rankings: any[]
  tieBreakers: any[]
  metadata: any
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

// Helper functions for different bracket types

function generateSingleEliminationMatches(
  tournamentId: string,
  teams: Team[],
  tournament: Tournament
): { matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]; bracketStructure: BracketNode[] } {
  const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
  const bracketStructure: BracketNode[] = []
  
  // Calculate number of rounds needed
  const totalTeams = teams.length
  const rounds = Math.ceil(Math.log2(totalTeams))
  
  // First round matches
  const currentRound = 1
  let matchPosition = 1
  
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId,
        round: currentRound,
        roundName: currentRound === rounds ? 'Final' : 
                   currentRound === rounds - 1 ? 'Semifinal' : 
                   currentRound === rounds - 2 ? 'Quarterfinal' : 
                   `Round ${currentRound}`,
        bracketType: 'winner',
        team1: teams[i],
        team2: teams[i + 1],
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
      
      const node: BracketNode = {
        id: `bracket-${currentRound}-${matchPosition}`,
        team1: teams[i],
        team2: teams[i + 1],
        round: currentRound,
        position: matchPosition,
        bracketType: 'winner'
      }
      bracketStructure.push(node)
      matchPosition++
    }
  }
  
  return { matches, bracketStructure }
}

function generateDoubleEliminationMatches(
  tournamentId: string,
  teams: Team[],
  tournament: Tournament
): { matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]; bracketStructure: BracketNode[] } {
  // For now, start with winners bracket like single elimination
  // TODO: Implement full double elimination logic with losers bracket
  return generateSingleEliminationMatches(tournamentId, teams, tournament)
}

function generateRoundRobinMatches(
  tournamentId: string,
  teams: Team[],
  tournament: Tournament
): { matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]; bracketStructure: BracketNode[] } {
  const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
  const bracketStructure: BracketNode[] = []
  
  let matchPosition = 1
  
  // Generate all possible pairings
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId,
        round: 1,
        roundName: 'Round Robin',
        bracketType: 'winner',
        team1: teams[i],
        team2: teams[j],
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
      
      const node: BracketNode = {
        id: `bracket-rr-${matchPosition}`,
        team1: teams[i],
        team2: teams[j],
        round: 1,
        position: matchPosition,
        bracketType: 'winner'
      }
      bracketStructure.push(node)
      matchPosition++
    }
  }
  
  return { matches, bracketStructure }
}

function generateSwissSystemMatches(
  tournamentId: string,
  teams: Team[],
  tournament: Tournament,
  round: number
): { matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]; bracketStructure: BracketNode[] } {
  const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
  const bracketStructure: BracketNode[] = []
  
  // For first round, do random pairings
  // TODO: Implement proper Swiss pairing algorithm for subsequent rounds
  let matchPosition = 1
  
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId,
        round,
        roundName: `Swiss Round ${round}`,
        bracketType: 'winner',
        team1: teams[i],
        team2: teams[i + 1],
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
      
      const node: BracketNode = {
        id: `bracket-swiss-${round}-${matchPosition}`,
        team1: teams[i],
        team2: teams[i + 1],
        round,
        position: matchPosition,
        bracketType: 'winner'
      }
      bracketStructure.push(node)
      matchPosition++
    }
  }
  
  return { matches, bracketStructure }
}

async function updateSingleEliminationProgression(
  match: Match,
  tournament: Tournament
): Promise<{ affectedMatches: Match[]; bracketStructure: BracketNode[]; nextRoundMatches: Match[] }> {
  const affectedMatches: Match[] = [match]
  const nextRoundMatches: Match[] = []
  
  try {
    // Only proceed if match is completed and has a winner
    if (match.status !== 'completed' || !match.winner) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    // Find next round match where this winner should advance
    const allMatchesResult = await matchDB.findByTournament(tournament.id)
    if (allMatchesResult.error || !allMatchesResult.data) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    const allMatches = allMatchesResult.data
    
    // Find the next round match that should receive this winner
    // In single elimination, winner advances to next round
    const nextRound = match.round + 1
    const nextRoundMatch = allMatches.find(m => 
      m.round === nextRound && 
      (!m.team1 || !m.team2) &&
      m.status === 'scheduled'
    )

    // Note: In a real implementation, bracket progression would be handled by 
    // specialized tournament management logic that knows how to properly
    // advance teams with full Team objects. For now, we log the progression
    // and let the tournament organizer manually set up the next round.
    
    if (nextRoundMatch) {
      console.log(`Winner ${match.winner} should advance to match ${nextRoundMatch.id}`)
      
      // In a real system, you would:
      // 1. Load the full Team object for the winner
      // 2. Update the next round match with the complete Team data
      // 3. Handle bracket structure updates
      
      // For now, we just track that progression is needed
      nextRoundMatches.push(nextRoundMatch)
    }

    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  } catch (error) {
    console.error('Error updating single elimination progression:', error)
    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  }
}

async function updateDoubleEliminationProgression(
  match: Match,
  tournament: Tournament
): Promise<{ affectedMatches: Match[]; bracketStructure: BracketNode[]; nextRoundMatches: Match[] }> {
  const affectedMatches: Match[] = [match]
  const nextRoundMatches: Match[] = []
  
  try {
    // Only proceed if match is completed and has a winner
    if (match.status !== 'completed' || !match.winner) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    // Get all tournament matches
    const allMatchesResult = await matchDB.findByTournament(tournament.id)
    if (allMatchesResult.error || !allMatchesResult.data) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    const allMatches = allMatchesResult.data
    
    // In double elimination: winner advances to winners bracket, loser to losers bracket
    if (match.bracketType === 'winner') {
      // Winner advances in winners bracket
      const nextWinnerMatch = allMatches.find(m => 
        m.round === match.round + 1 && 
        m.bracketType === 'winner' &&
        (!m.team1 || !m.team2) &&
        m.status === 'scheduled'
      )
      
      if (nextWinnerMatch) {
        console.log(`Winner ${match.winner} should advance to winners bracket match ${nextWinnerMatch.id}`)
        nextRoundMatches.push(nextWinnerMatch)
      }
      
      // Loser drops to losers bracket
      const nextLoserMatch = allMatches.find(m => 
        m.bracketType === 'loser' &&
        (!m.team1 || !m.team2) &&
        m.status === 'scheduled'
      )
      
      if (nextLoserMatch) {
        const loserId = match.team1.id === match.winner ? match.team2.id : match.team1.id
        console.log(`Loser ${loserId} should drop to losers bracket match ${nextLoserMatch.id}`)
        nextRoundMatches.push(nextLoserMatch)
      }
    } else if (match.bracketType === 'loser') {
      // Winner advances in losers bracket, loser is eliminated
      const nextLoserMatch = allMatches.find(m => 
        m.round === match.round + 1 && 
        m.bracketType === 'loser' &&
        (!m.team1 || !m.team2) &&
        m.status === 'scheduled'
      )
      
      if (nextLoserMatch) {
        console.log(`Winner ${match.winner} should advance in losers bracket to match ${nextLoserMatch.id}`)
        nextRoundMatches.push(nextLoserMatch)
      }
    }

    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  } catch (error) {
    console.error('Error updating double elimination progression:', error)
    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  }
}

async function updateSwissSystemProgression(
  match: Match,
  tournament: Tournament
): Promise<{ affectedMatches: Match[]; bracketStructure: BracketNode[]; nextRoundMatches: Match[] }> {
  const affectedMatches: Match[] = [match]
  const nextRoundMatches: Match[] = []
  
  try {
    // Only proceed if match is completed and has a winner
    if (match.status !== 'completed' || !match.winner) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    // Get all tournament matches to calculate standings
    const allMatchesResult = await matchDB.findByTournament(tournament.id)
    if (allMatchesResult.error || !allMatchesResult.data) {
      return {
        affectedMatches,
        bracketStructure: await getCurrentBracketStructure(tournament.id),
        nextRoundMatches
      }
    }

    const allMatches = allMatchesResult.data
    const completedMatches = allMatches.filter(m => m.status === 'completed')
    
    // In Swiss system, we don't create next round matches automatically
    // Instead, we update team standings and prepare for next round pairing
    // This would typically be done by tournament organizers using separate pairing algorithms
    
    // Calculate current standings for all teams
    const teamStandings = new Map<string, { wins: number; losses: number; points: number }>()
    
    completedMatches.forEach(m => {
      if (m.team1.id && m.team2.id && m.winner) {
        // Initialize standings if not exists
        if (!teamStandings.has(m.team1.id)) {
          teamStandings.set(m.team1.id, { wins: 0, losses: 0, points: 0 })
        }
        if (!teamStandings.has(m.team2.id)) {
          teamStandings.set(m.team2.id, { wins: 0, losses: 0, points: 0 })
        }
        
        const team1Stats = teamStandings.get(m.team1.id)!
        const team2Stats = teamStandings.get(m.team2.id)!
        
        if (m.winner === m.team1.id) {
          team1Stats.wins++
          team2Stats.losses++
        } else if (m.winner === m.team2.id) {
          team2Stats.wins++
          team1Stats.losses++
        }
        
        // Add match points (could be based on score difference in Petanque)
        team1Stats.points += m.score?.team1 || 0
        team2Stats.points += m.score?.team2 || 0
      }
    })
    
    // Check if this is the final round of Swiss system
    const currentRound = match.round
    const maxRounds = Math.ceil(Math.log2(teamStandings.size)) // Typical Swiss system rounds
    
    if (currentRound >= maxRounds) {
      // Tournament might be complete, check if we need finals
      const sortedTeams = Array.from(teamStandings.entries())
        .sort((a, b) => b[1].wins - a[1].wins || b[1].points - a[1].points)
      
      // Top teams might advance to finals (implementation depends on tournament rules)
      // For now, we just mark the tournament structure as updated
    }

    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  } catch (error) {
    console.error('Error updating Swiss system progression:', error)
    return {
      affectedMatches,
      bracketStructure: await getCurrentBracketStructure(tournament.id),
      nextRoundMatches
    }
  }
}

async function getCurrentBracketStructure(tournamentId: string): Promise<BracketNode[]> {
  // Get all matches for tournament and build bracket structure
  const matchesResult = await matchDB.findByTournament(tournamentId)
  if (matchesResult.error || !matchesResult.data) {
    return []
  }
  
  const matches = matchesResult.data
  const bracketStructure: BracketNode[] = []
  
  matches.forEach(match => {
    const node: BracketNode = {
      id: `bracket-${match.round}-${match.id}`,
      matchId: match.id,
      team1: match.team1,
      team2: match.team2,
      winner: match.winner,
      round: match.round,
      position: 0, // TODO: Calculate proper position
      bracketType: match.bracketType
    }
    bracketStructure.push(node)
  })
  
  return bracketStructure
}

async function checkTournamentCompletion(tournamentId: string): Promise<boolean> {
  const matchesResult = await matchDB.findByTournament(tournamentId)
  if (matchesResult.error || !matchesResult.data) {
    return false
  }
  
  const matches = matchesResult.data
  
  // Tournament is complete if all matches are completed or cancelled
  return matches.every(match => 
    match.status === 'completed' || match.status === 'cancelled'
  )
}