'use server'

import { tournamentDB } from '@/lib/db/tournaments'
import { Tournament, TournamentFormData, TournamentStats } from '@/types'
import { ActionResult } from '@/types/actions'

/**
 * Get tournament statistics summary
 * Returns aggregated statistics across all tournaments
 */
export async function getTournamentStatsSummary(): Promise<ActionResult<{
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  byFormat: Record<string, number>
  totalPlayers: number
  averagePlayersPerTournament: number
}>> {
  try {
    // Use the existing getStatsSummary method from TournamentDB
    const result = await tournamentDB.getStatsSummary()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get tournament statistics'
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error getting tournament stats summary:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournament statistics'
    }
  }
}

/**
 * Get upcoming tournaments (status: 'setup' and startDate in the future)
 */
export async function getUpcomingTournaments(): Promise<ActionResult<Tournament[]>> {
  try {
    // Use the existing findUpcoming method from TournamentDB
    const result = await tournamentDB.findUpcoming()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get upcoming tournaments'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error getting upcoming tournaments:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting upcoming tournaments'
    }
  }
}

/**
 * Get active tournaments (status: 'active')
 */
export async function getActiveTournaments(): Promise<ActionResult<Tournament[]>> {
  try {
    // Use the existing findActive method from TournamentDB
    const result = await tournamentDB.findActive()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get active tournaments'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error getting active tournaments:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting active tournaments'
    }
  }
}

/**
 * Get completed tournaments
 * Combines tournaments from both active and completed directories
 */
export async function getCompletedTournaments(): Promise<ActionResult<Tournament[]>> {
  try {
    // Use the existing findCompleted method from TournamentDB
    const result = await tournamentDB.findCompleted()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get completed tournaments'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error getting completed tournaments:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting completed tournaments'
    }
  }
}

/**
 * Get tournaments in a specific date range
 */
export async function getTournamentsInDateRange(
  startDate: string,
  endDate: string
): Promise<ActionResult<Tournament[]>> {
  try {
    if (!startDate || !endDate) {
      return {
        success: false,
        error: 'Start date and end date are required'
      }
    }
    
    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        success: false,
        error: 'Invalid date format. Use ISO date strings'
      }
    }
    
    if (end <= start) {
      return {
        success: false,
        error: 'End date must be after start date'
      }
    }
    
    // Use the existing findInDateRange method from TournamentDB
    const result = await tournamentDB.findInDateRange(start, end)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get tournaments in date range'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error getting tournaments in date range:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournaments in date range'
    }
  }
}

/**
 * Create tournament from template
 * Duplicates an existing tournament with new settings
 */
export async function createTournamentFromTemplate(
  templateId: string,
  overrides: Partial<TournamentFormData>
): Promise<ActionResult<Tournament>> {
  try {
    if (!templateId) {
      return {
        success: false,
        error: 'Template ID is required'
      }
    }
    
    // Use the existing createFromTemplate method from TournamentDB
    const result = await tournamentDB.createFromTemplate(templateId, overrides)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to create tournament from template'
      }
    }
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament created from template successfully'
    }
    
  } catch (error) {
    console.error('Error creating tournament from template:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating tournament from template'
    }
  }
}

/**
 * Get tournament progress percentage
 * Calculates completion based on matches played
 */
export async function getTournamentProgress(id: string): Promise<ActionResult<{ progress: number; isComplete: boolean }>> {
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
    const progress = await import('@/lib/db/tournaments').then(
      module => module.TournamentUtils.getProgress(tournament)
    )
    
    return {
      success: true,
      data: {
        progress,
        isComplete: progress >= 100
      }
    }
    
  } catch (error) {
    console.error('Error getting tournament progress:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournament progress'
    }
  }
}

/**
 * Get tournament duration in hours
 * Calculates duration between start and end dates
 */
export async function getTournamentDuration(id: string): Promise<ActionResult<{ duration: number | null; isOngoing: boolean }>> {
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
    const duration = await import('@/lib/db/tournaments').then(
      module => module.TournamentUtils.getDuration(tournament)
    )
    
    return {
      success: true,
      data: {
        duration,
        isOngoing: duration === null && tournament.status === 'active'
      }
    }
    
  } catch (error) {
    console.error('Error getting tournament duration:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournament duration'
    }
  }
}

/**
 * Validate tournament form data
 * Utility function to validate form data without creating tournament
 */
export async function validateTournamentFormData(data: unknown): Promise<ActionResult<TournamentFormData>> {
  try {
    // Use Zod schema directly for validation
    const { TournamentFormDataSchema } = await import('@/lib/validation/tournament')
    const result = TournamentFormDataSchema.safeParse(data)
    
    if (result.success) {
      return {
        success: true,
        data: result.data as TournamentFormData
      }
    } else {
      const fieldErrors: Record<string, string[]> = {}
      result.error.issues.forEach(err => {
        const path = err.path.join('.')
        if (!fieldErrors[path]) {
          fieldErrors[path] = []
        }
        fieldErrors[path].push(err.message)
      })
      
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors
      }
    }
    
  } catch (error) {
    console.error('Error validating tournament form data:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while validating form data'
    }
  }
}

/**
 * Get tournaments by organizer
 * Useful for user dashboards and organizer-specific views
 */
export async function getTournamentsByOrganizer(organizer: string): Promise<ActionResult<Tournament[]>> {
  try {
    if (!organizer) {
      return {
        success: false,
        error: 'Organizer name is required'
      }
    }
    
    // Use the existing findByOrganizer method from TournamentDB
    const result = await tournamentDB.findByOrganizer(organizer)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get tournaments by organizer'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error getting tournaments by organizer:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournaments by organizer'
    }
  }
}

/**
 * Get all tournament types with counts
 * Useful for dashboard analytics and filter options
 */
export async function getTournamentTypesWithCounts(): Promise<ActionResult<Array<{ type: string; count: number }>>> {
  try {
    const statsResult = await tournamentDB.getStatsSummary()
    
    if (statsResult.error) {
      return {
        success: false,
        error: statsResult.error.message || 'Failed to get tournament types'
      }
    }
    
    const stats = statsResult.data
    const typesWithCounts = Object.entries(stats.byType).map(([type, count]) => ({
      type,
      count
    }))
    
    return {
      success: true,
      data: typesWithCounts
    }
    
  } catch (error) {
    console.error('Error getting tournament types with counts:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting tournament types'
    }
  }
}