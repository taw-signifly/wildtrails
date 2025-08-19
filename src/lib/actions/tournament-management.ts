'use server'

import { revalidatePath } from 'next/cache'
import { tournamentDB } from '@/lib/db/tournaments'
import { Tournament } from '@/types'
import { ActionResult } from '@/types/actions'

/**
 * Start a tournament (change status from 'setup' to 'active')
 * Validates business rules before starting
 */
export async function startTournament(id: string): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Use the existing startTournament method from TournamentDB
    // This method already handles all the business logic validation
    const result = await tournamentDB.startTournament(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to start tournament'
      }
    }
    
    // Revalidate relevant pages
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${id}`)
    revalidatePath(`/tournaments/${id}/bracket`)
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament started successfully'
    }
    
  } catch (error) {
    console.error('Error starting tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while starting the tournament'
    }
  }
}

/**
 * Register a player for a tournament
 * Validates tournament capacity and registration rules
 */
export async function registerPlayerForTournament(
  tournamentId: string, 
  playerId: string
): Promise<ActionResult<Tournament>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Use the existing addPlayer method from TournamentDB
    // This method already handles capacity and registration validation
    const result = await tournamentDB.addPlayer(tournamentId, playerId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to register player for tournament'
      }
    }
    
    // Revalidate relevant pages
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/players`)
    
    return {
      success: true,
      data: result.data,
      message: 'Player registered successfully'
    }
    
  } catch (error) {
    console.error('Error registering player for tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while registering the player'
    }
  }
}

/**
 * Remove a player from a tournament
 * Validates removal rules (can't remove from active tournament)
 */
export async function removePlayerFromTournament(
  tournamentId: string, 
  playerId: string
): Promise<ActionResult<Tournament>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Use the existing removePlayer method from TournamentDB
    // This method already handles removal validation rules
    const result = await tournamentDB.removePlayer(tournamentId, playerId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to remove player from tournament'
      }
    }
    
    // Revalidate relevant pages
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/players`)
    
    return {
      success: true,
      data: result.data,
      message: 'Player removed successfully'
    }
    
  } catch (error) {
    console.error('Error removing player from tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while removing the player'
    }
  }
}

/**
 * Cancel a tournament
 * Sets tournament status to 'cancelled'
 */
export async function cancelTournament(id: string): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Use the existing cancelTournament method from TournamentDB
    const result = await tournamentDB.cancelTournament(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to cancel tournament'
      }
    }
    
    // Revalidate relevant pages
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${id}`)
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament cancelled successfully'
    }
    
  } catch (error) {
    console.error('Error cancelling tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while cancelling the tournament'
    }
  }
}

/**
 * Complete a tournament
 * Sets tournament status to 'completed' and moves to completed directory
 */
export async function completeTournament(
  id: string,
  finalStats?: {
    totalMatches?: number
    completedMatches?: number
    averageMatchDuration?: number
    totalEnds?: number
    highestScore?: number
    averageScore?: number
  }
): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Use the existing completeTournament method from TournamentDB
    const result = await tournamentDB.completeTournament(id, finalStats)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to complete tournament'
      }
    }
    
    // Revalidate relevant pages
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${id}`)
    revalidatePath('/tournaments/completed')
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament completed successfully'
    }
    
  } catch (error) {
    console.error('Error completing tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while completing the tournament'
    }
  }
}

/**
 * Update tournament statistics
 * Used during tournament progress to update match statistics
 */
export async function updateTournamentStats(
  id: string,
  stats: {
    totalMatches?: number
    completedMatches?: number
    averageMatchDuration?: number
    totalEnds?: number
    highestScore?: number
    averageScore?: number
  }
): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Use the existing updateStats method from TournamentDB
    const result = await tournamentDB.updateStats(id, stats)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to update tournament statistics'
      }
    }
    
    // Revalidate relevant pages (don't over-revalidate for stats updates)
    revalidatePath(`/tournaments/${id}`)
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament statistics updated successfully'
    }
    
  } catch (error) {
    console.error('Error updating tournament statistics:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating tournament statistics'
    }
  }
}

/**
 * Check if tournament can be started
 * Utility action to validate start conditions without actually starting
 */
export async function canStartTournament(id: string): Promise<ActionResult<{ canStart: boolean; reason?: string }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Get the tournament
    const tournamentResult = await tournamentDB.findById(id)
    
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: `Tournament with ID '${id}' not found`
      }
    }
    
    const tournament = tournamentResult.data
    
    // Use the utility function from TournamentDB
    const { canStart, reason } = await import('@/lib/db/tournaments').then(
      module => module.TournamentUtils.canStart(tournament)
    )
    
    return {
      success: true,
      data: { canStart, reason }
    }
    
  } catch (error) {
    console.error('Error checking if tournament can start:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while checking tournament start conditions'
    }
  }
}

/**
 * Check if player can be added to tournament
 * Utility action to validate add conditions without actually adding
 */
export async function canAddPlayerToTournament(
  tournamentId: string
): Promise<ActionResult<{ canAdd: boolean; reason?: string }>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Get the tournament
    const tournamentResult = await tournamentDB.findById(tournamentId)
    
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: `Tournament with ID '${tournamentId}' not found`
      }
    }
    
    const tournament = tournamentResult.data
    
    // Use the utility function from TournamentDB
    const { canAdd, reason } = await import('@/lib/db/tournaments').then(
      module => module.TournamentUtils.canAddPlayer(tournament)
    )
    
    return {
      success: true,
      data: { canAdd, reason }
    }
    
  } catch (error) {
    console.error('Error checking if player can be added to tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while checking add player conditions'
    }
  }
}