'use server'

import { revalidatePath } from 'next/cache'
import { playerDB } from '@/lib/db/players'
import { PlayerFormDataSchema } from '@/lib/validation/player'
import { paginateArray } from '@/lib/api'
import { resultToActionResult, parseFormDataField, parseFormDataNumber, formatZodErrors } from '@/lib/api/action-utils'
import { Player, PlayerFormData, PlayerFilters, PlayerStats, TournamentParticipation } from '@/types'
import { ActionResult } from '@/types/actions'

/**
 * Validate email uniqueness - returns error result if email already exists
 */
async function validateEmailUniqueness(
  email: string, 
  excludeId?: string
): Promise<{ isValid: boolean; error?: ActionResult<never> }> {
  const existingPlayerResult = await playerDB.findByEmail(email)
  
  if (existingPlayerResult.error) {
    return {
      isValid: false,
      error: {
        success: false,
        error: existingPlayerResult.error.message || 'Failed to check email uniqueness'
      }
    }
  }
  
  // Allow same player to keep their email during updates
  if (existingPlayerResult.data && existingPlayerResult.data.id !== excludeId) {
    return {
      isValid: false,
      error: {
        success: false,
        error: 'Email already exists',
        fieldErrors: { 
          email: ['A player with this email already exists'] 
        }
      }
    }
  }
  
  return { isValid: true }
}

/**
 * Convert FormData to PlayerFormData object with type safety
 */
function formDataToPlayerData(formData: FormData): Partial<PlayerFormData> {
  const data: Partial<PlayerFormData> = {}
  
  // Basic required fields
  const firstName = parseFormDataField(formData, 'firstName', (v) => v.trim(), false)
  if (firstName) data.firstName = firstName
  
  const lastName = parseFormDataField(formData, 'lastName', (v) => v.trim(), false)
  if (lastName) data.lastName = lastName
  
  const email = parseFormDataField(formData, 'email', (v) => v.trim().toLowerCase(), false)
  if (email) data.email = email
  
  // Optional fields
  const phone = parseFormDataField(formData, 'phone', (v) => v.trim(), false)
  if (phone && phone.length > 0) data.phone = phone
  
  const club = parseFormDataField(formData, 'club', (v) => v.trim(), false)
  if (club && club.length > 0) data.club = club
  
  const ranking = parseFormDataField(formData, 'ranking', (v) => 
    parseFormDataNumber(v, 1, 10000), false
  )
  if (ranking !== undefined) data.ranking = ranking
  
  return data
}

/**
 * Get players with filtering and pagination
 */
export async function getPlayers(
  filters?: PlayerFilters & { page?: number; limit?: number }
): Promise<ActionResult<{ players: Player[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    
    // Get all players first
    const playersResult = await playerDB.findAll()
    
    if (playersResult.error) {
      return {
        success: false,
        error: playersResult.error.message || 'Failed to fetch players'
      }
    }
    
    let players = playersResult.data || []
    
    // Apply filters
    if (filters?.club) {
      const clubFilter = filters.club.toLowerCase()
      players = players.filter(p => 
        p.club && p.club.toLowerCase().includes(clubFilter)
      )
    }
    
    if (filters?.ranking && filters.ranking.min !== undefined && filters.ranking.max !== undefined) {
      const { min: rankingMin, max: rankingMax } = filters.ranking
      players = players.filter(p => 
        p.ranking && 
        p.ranking >= rankingMin && 
        p.ranking <= rankingMax
      )
    }
    
    if (filters?.winPercentage && filters.winPercentage.min !== undefined && filters.winPercentage.max !== undefined) {
      const { min: winPercentageMin, max: winPercentageMax } = filters.winPercentage
      players = players.filter(p => 
        p.stats.winPercentage >= winPercentageMin && 
        p.stats.winPercentage <= winPercentageMax
      )
    }
    
    // Apply pagination
    const { paginatedData, paginationInfo } = paginateArray(players, page, limit)
    
    return {
      success: true,
      data: {
        players: paginatedData,
        pagination: paginationInfo
      }
    }
    
  } catch (error) {
    console.error('Error fetching players:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching players'
    }
  }
}

/**
 * Get a single player by ID
 */
export async function getPlayerById(id: string): Promise<ActionResult<Player>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    const result = await playerDB.findById(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch player'
      }
    }
    
    if (!result.data) {
      return {
        success: false,
        error: `Player with ID '${id}' not found`
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the player'
    }
  }
}

/**
 * Create a new player (form action)
 */
export async function createPlayer(formData: FormData): Promise<ActionResult<Player>> {
  try {
    // Convert FormData to player data
    const playerData = formDataToPlayerData(formData)
    
    // Validate the data
    const validation = PlayerFormDataSchema.safeParse(playerData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check email uniqueness
    const emailValidation = await validateEmailUniqueness(validation.data.email)
    if (!emailValidation.isValid && emailValidation.error) {
      return emailValidation.error
    }
    
    // Create player in database
    const result = await playerDB.create(validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Player created successfully')
    
    // Revalidate players page to show new player if successful
    if (actionResult.success) {
      revalidatePath('/players')
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the player'
    }
  }
}

/**
 * Create a player with typed data (programmatic use)
 */
export async function createPlayerData(data: PlayerFormData): Promise<ActionResult<Player>> {
  try {
    // Validate the data
    const validation = PlayerFormDataSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check email uniqueness
    const emailValidation = await validateEmailUniqueness(validation.data.email)
    if (!emailValidation.isValid && emailValidation.error) {
      return emailValidation.error
    }
    
    // Create player in database
    const result = await playerDB.create(validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Player created successfully')
    
    // Revalidate players page if successful
    if (actionResult.success) {
      revalidatePath('/players')
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the player'
    }
  }
}

/**
 * Update an existing player (form action)
 */
export async function updatePlayer(id: string, formData: FormData): Promise<ActionResult<Player>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Convert FormData to player data
    const updateData = formDataToPlayerData(formData)
    
    // Create partial validation schema for updates
    const PartialPlayerFormDataSchema = PlayerFormDataSchema.partial()
    const validation = PartialPlayerFormDataSchema.safeParse(updateData)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check email uniqueness if email is being updated
    if (validation.data.email) {
      const emailValidation = await validateEmailUniqueness(validation.data.email, id)
      if (!emailValidation.isValid && emailValidation.error) {
        return emailValidation.error
      }
    }
    
    // Update player in database
    const result = await playerDB.update(id, validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Player updated successfully')
    
    // Revalidate players page and specific player page if successful
    if (actionResult.success) {
      revalidatePath('/players')
      revalidatePath(`/players/${id}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the player'
    }
  }
}

/**
 * Update a player with typed data (programmatic use)
 */
export async function updatePlayerData(
  id: string, 
  data: Partial<PlayerFormData>
): Promise<ActionResult<Player>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Create partial validation schema for updates
    const PartialPlayerFormDataSchema = PlayerFormDataSchema.partial()
    const validation = PartialPlayerFormDataSchema.safeParse(data)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check email uniqueness if email is being updated
    if (validation.data.email) {
      const emailValidation = await validateEmailUniqueness(validation.data.email, id)
      if (!emailValidation.isValid && emailValidation.error) {
        return emailValidation.error
      }
    }
    
    // Update player in database
    const result = await playerDB.update(id, validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Player updated successfully')
    
    // Revalidate caches if successful
    if (actionResult.success) {
      revalidatePath('/players')
      revalidatePath(`/players/${id}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the player'
    }
  }
}

/**
 * Delete (archive) a player
 */
export async function deletePlayer(id: string): Promise<ActionResult<{ id: string; archived: boolean }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Check if player exists
    const playerResult = await playerDB.findById(id)
    if (playerResult.error || !playerResult.data) {
      return {
        success: false,
        error: `Player with ID '${id}' not found`
      }
    }
    
    // Business rule: Could add checks here like "can't delete player in active tournament"
    // For now, we'll allow deletion as it's a soft delete (archive)
    
    // Delete the player (soft delete - moves to archived)
    const result = await playerDB.delete(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to delete player'
      }
    }
    
    // Revalidate players page
    revalidatePath('/players')
    
    return {
      success: true,
      data: { id, archived: true },
      message: 'Player archived successfully'
    }
    
  } catch (error) {
    console.error('Error deleting player:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the player'
    }
  }
}

/**
 * Search players by name, email, club
 */
export async function searchPlayers(
  query: string, 
  filters?: PlayerFilters
): Promise<ActionResult<Player[]>> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      }
    }
    
    // Use the search method from PlayerDB - searching by name
    const result = await playerDB.searchByName(query.trim())
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to search players'
      }
    }
    
    let players = result.data || []
    
    // Apply additional filters if provided
    if (filters) {
      if (filters.club) {
        const clubFilter = filters.club.toLowerCase()
        players = players.filter(p => 
          p.club && p.club.toLowerCase().includes(clubFilter)
        )
      }
      if (filters.ranking && filters.ranking.min !== undefined && filters.ranking.max !== undefined) {
        const { min: rankingMin, max: rankingMax } = filters.ranking
        players = players.filter(p => 
          p.ranking && 
          p.ranking >= rankingMin && 
          p.ranking <= rankingMax
        )
      }
      if (filters.winPercentage && filters.winPercentage.min !== undefined && filters.winPercentage.max !== undefined) {
        const { min: winPercentageMin, max: winPercentageMax } = filters.winPercentage
        players = players.filter(p => 
          p.stats.winPercentage >= winPercentageMin && 
          p.stats.winPercentage <= winPercentageMax
        )
      }
    }
    
    return {
      success: true,
      data: players
    }
    
  } catch (error) {
    console.error('Error searching players:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while searching players'
    }
  }
}

/**
 * Update player statistics
 */
export async function updatePlayerStats(
  playerId: string, 
  stats: Partial<PlayerStats>
): Promise<ActionResult<Player>> {
  try {
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Update player statistics in database
    const result = await playerDB.updateStats(playerId, stats)
    
    // Convert database result to action result with proper error handling
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to update player statistics'
      }
    }
    
    const actionResult = {
      success: true as const,
      data: result.data,
      message: 'Player statistics updated successfully'
    }
    
    // Revalidate player pages if successful
    if (actionResult.success) {
      revalidatePath('/players')
      revalidatePath(`/players/${playerId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating player statistics:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating player statistics'
    }
  }
}

/**
 * Get player tournament history
 */
export async function getPlayerTournamentHistory(
  playerId: string, 
  limit?: number
): Promise<ActionResult<TournamentParticipation[]>> {
  try {
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Check if player exists
    const playerResult = await playerDB.findById(playerId)
    if (playerResult.error || !playerResult.data) {
      return {
        success: false,
        error: `Player with ID '${playerId}' not found`
      }
    }
    
    // This would typically query tournament-player relationships
    // For now, returning empty array as a placeholder
    // In full implementation, would integrate with tournament system
    // The limit parameter would be used to limit results
    const tournaments: TournamentParticipation[] = [] // Properly typed placeholder
    const limitedTournaments = limit && limit > 0 ? tournaments.slice(0, limit) : tournaments
    
    return {
      success: true,
      data: limitedTournaments
    }
    
  } catch (error) {
    console.error('Error fetching player tournament history:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching tournament history'
    }
  }
}

/**
 * Get player performance statistics
 */
export async function getPlayerPerformanceStats(playerId: string): Promise<ActionResult<PlayerStats>> {
  try {
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Get player with statistics
    const playerResult = await playerDB.findById(playerId)
    if (playerResult.error || !playerResult.data) {
      return {
        success: false,
        error: `Player with ID '${playerId}' not found`
      }
    }
    
    return {
      success: true,
      data: playerResult.data.stats
    }
    
  } catch (error) {
    console.error('Error fetching player performance statistics:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching performance statistics'
    }
  }
}