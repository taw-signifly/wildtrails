'use server'

import { revalidatePath } from 'next/cache'
import { teamDB } from '@/lib/db/teams'
import { playerDB } from '@/lib/db/players'
import { TeamFormDataSchema, TeamFormData } from '@/lib/validation/player'
import { paginateArray } from '@/lib/api'
import { resultToActionResult, parseFormDataField, formatZodErrors } from '@/lib/api/action-utils'
import { Team, GameFormat, TeamStats } from '@/types'
import { ActionResult } from '@/types/actions'

export interface TeamFilters {
  tournamentId?: string
  bracketType?: Team['bracketType']
}

/**
 * Convert FormData to TeamFormData object with type safety
 */
function formDataToTeamData(formData: FormData): Partial<TeamFormData> {
  const data: Partial<TeamFormData> = {}
  
  // Basic required fields
  const name = parseFormDataField(formData, 'name', (v) => v.trim(), false)
  if (name) data.name = name
  
  const tournamentId = parseFormDataField(formData, 'tournamentId', (v) => v.trim(), false)
  if (tournamentId) data.tournamentId = tournamentId
  
  // Players array - can be multiple values with same name or JSON string
  const playersJson = formData.get('players')
  if (playersJson) {
    try {
      const players = JSON.parse(playersJson.toString())
      if (Array.isArray(players)) {
        data.players = players.filter(id => typeof id === 'string' && id.trim().length > 0)
      }
    } catch {
      // Fall back to individual player fields
      const players: string[] = []
      formData.forEach((value, key) => {
        if (key.startsWith('player') && typeof value === 'string' && value.trim().length > 0) {
          players.push(value.trim())
        }
      })
      if (players.length > 0) {
        data.players = players
      }
    }
  }
  
  return data
}

/**
 * Get teams with filtering and pagination
 */
export async function getTeams(
  filters?: TeamFilters & { page?: number; limit?: number }
): Promise<ActionResult<{ teams: Team[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    
    // Apply filters to get teams
    let teamsResult
    
    if (filters?.tournamentId) {
      teamsResult = await teamDB.findByTournament(filters.tournamentId)
    } else {
      teamsResult = await teamDB.findAll()
    }
    
    if (teamsResult.error) {
      return {
        success: false,
        error: teamsResult.error.message || 'Failed to fetch teams'
      }
    }
    
    let teams = teamsResult.data || []
    
    // Apply additional filters
    if (filters?.bracketType) {
      teams = teams.filter(t => t.bracketType === filters.bracketType)
    }
    
    // Apply pagination
    const { paginatedData, paginationInfo } = paginateArray(teams, page, limit)
    
    return {
      success: true,
      data: {
        teams: paginatedData,
        pagination: paginationInfo
      }
    }
    
  } catch (error) {
    console.error('Error fetching teams:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching teams'
    }
  }
}

/**
 * Get a single team by ID
 */
export async function getTeamById(id: string): Promise<ActionResult<Team>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    const result = await teamDB.findById(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch team'
      }
    }
    
    if (!result.data) {
      return {
        success: false,
        error: `Team with ID '${id}' not found`
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the team'
    }
  }
}

/**
 * Create a new team (form action)
 */
export async function createTeam(formData: FormData): Promise<ActionResult<Team>> {
  try {
    // Convert FormData to team data
    const teamData = formDataToTeamData(formData)
    
    // Validate the data
    const validation = TeamFormDataSchema.safeParse(teamData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check team name uniqueness within tournament
    const existingTeamResult = await teamDB.findByNameAndTournament(
      validation.data.name, 
      validation.data.tournamentId
    )
    
    if (existingTeamResult.error) {
      return {
        success: false,
        error: existingTeamResult.error.message || 'Failed to check team name uniqueness'
      }
    }
    
    if (existingTeamResult.data) {
      return {
        success: false,
        error: 'Team name already exists in this tournament',
        fieldErrors: { 
          name: ['A team with this name already exists in this tournament'] 
        }
      }
    }
    
    // Business rule: Check players can join team (no duplicate memberships)
    for (const playerId of validation.data.players) {
      const canJoinResult = await teamDB.canPlayerJoinTeam(playerId, validation.data.tournamentId)
      if (canJoinResult.error) {
        return {
          success: false,
          error: canJoinResult.error.message || 'Failed to validate player eligibility'
        }
      }
      
      if (!canJoinResult.data) {
        return {
          success: false,
          error: 'One or more players are already in a team for this tournament',
          fieldErrors: { 
            players: ['One or more players are already in a team for this tournament'] 
          }
        }
      }
    }
    
    // Create team in database
    const result = await teamDB.createFromFormData(validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Team created successfully')
    
    // Revalidate teams page to show new team if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/tournaments/${validation.data.tournamentId}/teams`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the team'
    }
  }
}

/**
 * Create a team with typed data (programmatic use)
 */
export async function createTeamData(data: TeamFormData): Promise<ActionResult<Team>> {
  try {
    // Validate the data
    const validation = TeamFormDataSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Check team name uniqueness within tournament
    const existingTeamResult = await teamDB.findByNameAndTournament(
      validation.data.name, 
      validation.data.tournamentId
    )
    
    if (existingTeamResult.error) {
      return {
        success: false,
        error: existingTeamResult.error.message || 'Failed to check team name uniqueness'
      }
    }
    
    if (existingTeamResult.data) {
      return {
        success: false,
        error: 'Team name already exists in this tournament',
        fieldErrors: { 
          name: ['A team with this name already exists in this tournament'] 
        }
      }
    }
    
    // Business rule: Check players can join team
    for (const playerId of validation.data.players) {
      const canJoinResult = await teamDB.canPlayerJoinTeam(playerId, validation.data.tournamentId)
      if (canJoinResult.error) {
        return {
          success: false,
          error: canJoinResult.error.message || 'Failed to validate player eligibility'
        }
      }
      
      if (!canJoinResult.data) {
        return {
          success: false,
          error: 'One or more players are already in a team for this tournament',
          fieldErrors: { 
            players: ['One or more players are already in a team for this tournament'] 
          }
        }
      }
    }
    
    // Create team in database
    const result = await teamDB.createFromFormData(validation.data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Team created successfully')
    
    // Revalidate teams pages if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/tournaments/${validation.data.tournamentId}/teams`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the team'
    }
  }
}

/**
 * Update an existing team (form action)
 */
export async function updateTeam(id: string, formData: FormData): Promise<ActionResult<Team>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    // Convert FormData to team data
    const updateData = formDataToTeamData(formData)
    
    // Create partial validation schema for updates
    const PartialTeamFormDataSchema = TeamFormDataSchema.partial()
    const validation = PartialTeamFormDataSchema.safeParse(updateData)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Get current team to check tournament
    const currentTeamResult = await teamDB.findById(id)
    if (currentTeamResult.error || !currentTeamResult.data) {
      return {
        success: false,
        error: `Team with ID '${id}' not found`
      }
    }
    
    const currentTeam = currentTeamResult.data
    
    // Business rule: Check name uniqueness if name is being updated
    if (validation.data.name) {
      const existingTeamResult = await teamDB.findByNameAndTournament(
        validation.data.name, 
        currentTeam.tournamentId
      )
      
      if (existingTeamResult.error) {
        return {
          success: false,
          error: existingTeamResult.error.message || 'Failed to check team name uniqueness'
        }
      }
      
      // Allow same team to keep their name, but not another team
      if (existingTeamResult.data && existingTeamResult.data.id !== id) {
        return {
          success: false,
          error: 'Team name already exists in this tournament',
          fieldErrors: { 
            name: ['A team with this name already exists in this tournament'] 
          }
        }
      }
    }
    
    // Business rule: Check players eligibility if players are being updated
    if (validation.data.players) {
      for (const playerId of validation.data.players) {
        const canJoinResult = await teamDB.canPlayerJoinTeam(playerId, currentTeam.tournamentId)
        if (canJoinResult.error) {
          return {
            success: false,
            error: canJoinResult.error.message || 'Failed to validate player eligibility'
          }
        }
        
        // Allow existing team members, or new players not in other teams
        const isCurrentTeamMember = currentTeam.players.some(p => p.id === playerId)
        if (!canJoinResult.data && !isCurrentTeamMember) {
          return {
            success: false,
            error: 'One or more players are already in a team for this tournament',
            fieldErrors: { 
              players: ['One or more players are already in a team for this tournament'] 
            }
          }
        }
      }
    }
    
    // Update team in database (need to handle players separately due to complex validation)
    let updateResult
    if (validation.data.players) {
      // For player updates, we need to recreate the team with proper player objects
      // This is a simplification - in production you'd handle this more carefully
      const playerData = []
      for (const playerId of validation.data.players) {
        const playerResult = await playerDB.findById(playerId)
        if (playerResult.error || !playerResult.data) {
          return {
            success: false,
            error: `Player with ID '${playerId}' not found`
          }
        }
        playerData.push(playerResult.data)
      }
      
      updateResult = await teamDB.update(id, {
        name: validation.data.name,
        players: playerData
      })
    } else {
      // Only update non-player fields
      const { players, ...updateData } = validation.data
      updateResult = await teamDB.update(id, updateData)
    }
    
    // Convert database result to action result
    const actionResult = resultToActionResult(updateResult, 'Team updated successfully')
    
    // Revalidate teams pages if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/teams/${id}`)
      revalidatePath(`/tournaments/${currentTeam.tournamentId}/teams`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the team'
    }
  }
}

/**
 * Update a team with typed data (programmatic use)
 */
export async function updateTeamData(
  id: string, 
  data: Partial<TeamFormData>
): Promise<ActionResult<Team>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    // Create partial validation schema for updates
    const PartialTeamFormDataSchema = TeamFormDataSchema.partial()
    const validation = PartialTeamFormDataSchema.safeParse(data)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Get current team to check tournament
    const currentTeamResult = await teamDB.findById(id)
    if (currentTeamResult.error || !currentTeamResult.data) {
      return {
        success: false,
        error: `Team with ID '${id}' not found`
      }
    }
    
    const currentTeam = currentTeamResult.data
    
    // Business rules validation (same as form version)
    if (validation.data.name) {
      const existingTeamResult = await teamDB.findByNameAndTournament(
        validation.data.name, 
        currentTeam.tournamentId
      )
      
      if (existingTeamResult.error) {
        return {
          success: false,
          error: existingTeamResult.error.message || 'Failed to check team name uniqueness'
        }
      }
      
      if (existingTeamResult.data && existingTeamResult.data.id !== id) {
        return {
          success: false,
          error: 'Team name already exists in this tournament',
          fieldErrors: { 
            name: ['A team with this name already exists in this tournament'] 
          }
        }
      }
    }
    
    // Handle player updates
    let updateResult
    if (validation.data.players) {
      // Validate players and get their data
      const playerData = []
      for (const playerId of validation.data.players) {
        const canJoinResult = await teamDB.canPlayerJoinTeam(playerId, currentTeam.tournamentId)
        const isCurrentTeamMember = currentTeam.players.some(p => p.id === playerId)
        
        if (canJoinResult.error) {
          return {
            success: false,
            error: canJoinResult.error.message || 'Failed to validate player eligibility'
          }
        }
        
        if (!canJoinResult.data && !isCurrentTeamMember) {
          return {
            success: false,
            error: 'One or more players are already in a team for this tournament',
            fieldErrors: { 
              players: ['One or more players are already in a team for this tournament'] 
            }
          }
        }
        
        const playerResult = await playerDB.findById(playerId)
        if (playerResult.error || !playerResult.data) {
          return {
            success: false,
            error: `Player with ID '${playerId}' not found`
          }
        }
        playerData.push(playerResult.data)
      }
      
      updateResult = await teamDB.update(id, {
        name: validation.data.name,
        players: playerData
      })
    } else {
      // Only update non-player fields
      const { players, ...updateData } = validation.data
      updateResult = await teamDB.update(id, updateData)
    }
    
    // Convert database result to action result
    const actionResult = resultToActionResult(updateResult, 'Team updated successfully')
    
    // Revalidate caches if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/teams/${id}`)
      revalidatePath(`/tournaments/${currentTeam.tournamentId}/teams`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the team'
    }
  }
}

/**
 * Delete (archive) a team
 */
export async function deleteTeam(id: string): Promise<ActionResult<{ id: string; archived: boolean }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    // Check if team exists
    const teamResult = await teamDB.findById(id)
    if (teamResult.error || !teamResult.data) {
      return {
        success: false,
        error: `Team with ID '${id}' not found`
      }
    }
    
    const team = teamResult.data
    
    // Business rule: Could add checks here like "can't delete team in active tournament"
    // For now, we'll allow deletion as it's a soft delete (archive)
    
    // Delete the team (soft delete - moves to archived)
    const result = await teamDB.delete(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to delete team'
      }
    }
    
    // Revalidate teams pages
    revalidatePath('/teams')
    revalidatePath(`/tournaments/${team.tournamentId}/teams`)
    
    return {
      success: true,
      data: { id, archived: true },
      message: 'Team archived successfully'
    }
    
  } catch (error) {
    console.error('Error deleting team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the team'
    }
  }
}

/**
 * Add player to team
 */
export async function addPlayerToTeam(
  teamId: string, 
  playerId: string
): Promise<ActionResult<Team>> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Add player to team using database method
    const result = await teamDB.addPlayer(teamId, playerId)
    
    // Convert database result to action result with proper error handling
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to add player to team'
      }
    }
    
    const actionResult = {
      success: true as const,
      data: result.data,
      message: 'Player added to team successfully'
    }
    
    // Revalidate team pages if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/teams/${teamId}`)
      if (actionResult.data) {
        revalidatePath(`/tournaments/${actionResult.data.tournamentId}/teams`)
      }
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error adding player to team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while adding player to team'
    }
  }
}

/**
 * Remove player from team
 */
export async function removePlayerFromTeam(
  teamId: string, 
  playerId: string
): Promise<ActionResult<Team>> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    if (!playerId) {
      return {
        success: false,
        error: 'Player ID is required'
      }
    }
    
    // Remove player from team using database method
    const result = await teamDB.removePlayer(teamId, playerId)
    
    // Convert database result to action result with proper error handling
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to remove player from team'
      }
    }
    
    const actionResult = {
      success: true as const,
      data: result.data,
      message: 'Player removed from team successfully'
    }
    
    // Revalidate team pages if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/teams/${teamId}`)
      if (actionResult.data) {
        revalidatePath(`/tournaments/${actionResult.data.tournamentId}/teams`)
      }
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error removing player from team:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while removing player from team'
    }
  }
}

/**
 * Validate team formation for tournament format
 */
export async function validateTeamFormation(
  players: string[], 
  format: GameFormat
): Promise<ActionResult<boolean>> {
  try {
    if (!players || players.length === 0) {
      return {
        success: false,
        error: 'Players array is required'
      }
    }
    
    if (!format) {
      return {
        success: false,
        error: 'Game format is required'
      }
    }
    
    // Validate team formation using database method
    const result = await teamDB.validateTeamFormation(players, format)
    
    // Convert database result to action result with proper error handling
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to validate team formation'
      }
    }
    
    return {
      success: true,
      data: result.data,
      message: 'Team formation is valid'
    }
    
  } catch (error) {
    console.error('Error validating team formation:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while validating team formation'
    }
  }
}

/**
 * Get teams by tournament
 */
export async function getTeamsByTournament(tournamentId: string): Promise<ActionResult<Team[]>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    const result = await teamDB.findByTournament(tournamentId)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch teams for tournament'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error fetching teams for tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching teams for tournament'
    }
  }
}

/**
 * Update team statistics
 */
export async function updateTeamStats(
  teamId: string, 
  stats: Partial<TeamStats>
): Promise<ActionResult<Team>> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: 'Team ID is required'
      }
    }
    
    // Update team statistics in database
    const result = await teamDB.updateStats(teamId, stats)
    
    // Convert database result to action result with proper error handling
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to update team statistics'
      }
    }
    
    const actionResult = {
      success: true as const,
      data: result.data,
      message: 'Team statistics updated successfully'
    }
    
    // Revalidate team pages if successful
    if (actionResult.success) {
      revalidatePath('/teams')
      revalidatePath(`/teams/${teamId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating team statistics:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating team statistics'
    }
  }
}