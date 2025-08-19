'use server'

import { revalidatePath } from 'next/cache'
import { matchDB } from '@/lib/db/matches'
import { tournamentDB } from '@/lib/db/tournaments'
import { resultToActionResult } from '@/lib/api/action-utils'
import { broadcastBracketUpdate, broadcastTournamentUpdate } from '@/lib/api/sse'
import { Match, Tournament, BracketType, TournamentType, Team } from '@/types'
import { ActionResult } from '@/types/actions'

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
 * Generate bracket matches for a tournament
 */
export async function generateBracketMatches(
  tournamentId: string,
  bracketType: TournamentType,
  teams: Team[]
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
    
    // Validate team count for bracket type
    if (teams.length < 2) {
      return {
        success: false,
        error: 'At least 2 teams are required to generate brackets'
      }
    }
    
    // Generate matches based on bracket type
    let matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    let bracketStructure: BracketNode[] = []
    
    switch (bracketType) {
      case 'single-elimination':
        const singleElimResult = generateSingleEliminationMatches(tournamentId, teams, tournament)
        matches = singleElimResult.matches
        bracketStructure = singleElimResult.bracketStructure
        break
        
      case 'double-elimination':
        const doubleElimResult = generateDoubleEliminationMatches(tournamentId, teams, tournament)
        matches = doubleElimResult.matches
        bracketStructure = doubleElimResult.bracketStructure
        break
        
      case 'round-robin':
        const roundRobinResult = generateRoundRobinMatches(tournamentId, teams, tournament)
        matches = roundRobinResult.matches
        bracketStructure = roundRobinResult.bracketStructure
        break
        
      case 'swiss':
        const swissResult = generateSwissSystemMatches(tournamentId, teams, tournament, 1)
        matches = swissResult.matches
        bracketStructure = swissResult.bracketStructure
        break
        
      default:
        return {
          success: false,
          error: `Unsupported bracket type: ${bracketType}`
        }
    }
    
    // Bulk create matches
    const createResult = await matchDB.bulkCreate(matches)
    if (createResult.error) {
      return {
        success: false,
        error: createResult.error.message || 'Failed to create bracket matches'
      }
    }
    
    // Update tournament with bracket structure
    await tournamentDB.update(tournamentId, {
      status: 'active'
    })
    
    // Revalidate pages
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/bracket`)
    
    // Broadcast bracket generation via SSE
    broadcastBracketUpdate(tournamentId, '', bracketStructure, createResult.data.successful.map(m => m.id || ''))
    
    return {
      success: true,
      data: {
        matches: createResult.data.successful,
        bracketStructure
      },
      message: `${createResult.data.successful.length} matches created successfully`
    }
    
  } catch (error) {
    console.error('Error generating bracket matches:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while generating bracket matches'
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
    
    // Handle progression based on tournament type
    let affectedMatches: Match[] = [match]
    let bracketStructure: BracketNode[] = []
    let nextRoundMatches: Match[] = []
    
    switch (tournament.type) {
      case 'single-elimination':
        const singleElimUpdate = await updateSingleEliminationProgression(match, tournament)
        affectedMatches = singleElimUpdate.affectedMatches
        bracketStructure = singleElimUpdate.bracketStructure
        nextRoundMatches = singleElimUpdate.nextRoundMatches
        break
        
      case 'double-elimination':
        const doubleElimUpdate = await updateDoubleEliminationProgression(match, tournament)
        affectedMatches = doubleElimUpdate.affectedMatches
        bracketStructure = doubleElimUpdate.bracketStructure
        nextRoundMatches = doubleElimUpdate.nextRoundMatches
        break
        
      case 'round-robin':
        // Round-robin doesn't need progression updates
        const currentBracket = await getCurrentBracketStructure(tournamentId)
        bracketStructure = currentBracket
        break
        
      case 'swiss':
        const swissUpdate = await updateSwissSystemProgression(match, tournament)
        affectedMatches = swissUpdate.affectedMatches
        bracketStructure = swissUpdate.bracketStructure
        nextRoundMatches = swissUpdate.nextRoundMatches
        break
    }
    
    // Check if tournament is complete
    const isComplete = await checkTournamentCompletion(tournamentId)
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
    broadcastBracketUpdate(tournamentId, matchId, bracketStructure, affectedMatches.map(m => m.id))
    
    return {
      success: true,
      data: {
        tournamentId,
        affectedMatches,
        bracketStructure,
        nextRoundMatches
      },
      message: 'Bracket progression updated successfully'
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
  // TODO: Implement single elimination progression logic
  return {
    affectedMatches: [match],
    bracketStructure: [],
    nextRoundMatches: []
  }
}

async function updateDoubleEliminationProgression(
  match: Match,
  tournament: Tournament
): Promise<{ affectedMatches: Match[]; bracketStructure: BracketNode[]; nextRoundMatches: Match[] }> {
  // TODO: Implement double elimination progression logic
  return {
    affectedMatches: [match],
    bracketStructure: [],
    nextRoundMatches: []
  }
}

async function updateSwissSystemProgression(
  match: Match,
  tournament: Tournament
): Promise<{ affectedMatches: Match[]; bracketStructure: BracketNode[]; nextRoundMatches: Match[] }> {
  // TODO: Implement Swiss system progression logic
  return {
    affectedMatches: [match],
    bracketStructure: [],
    nextRoundMatches: []
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