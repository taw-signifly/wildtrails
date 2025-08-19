'use server'

import { revalidatePath } from 'next/cache'
import { tournamentDB } from '@/lib/db/tournaments'
import { TournamentFormDataSchema } from '@/lib/validation/tournament'
import { sanitizeTournamentData, parsePaginationParams, paginateArray } from '@/lib/api'
import { Tournament, TournamentFormData, TournamentFilters } from '@/types'
import { ActionResult, ActionState } from '@/types/actions'
import { z } from 'zod'

/**
 * Format Zod validation errors for form field errors
 */
function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  
  error.issues.forEach((err) => {
    const path = err.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    fieldErrors[path].push(err.message)
  })
  
  return fieldErrors
}

/**
 * Convert FormData to TournamentFormData object
 */
function formDataToTournamentData(formData: FormData): Partial<TournamentFormData> {
  const data: any = {}
  
  // Basic fields
  const name = formData.get('name')
  if (name) data.name = name.toString()
  
  const type = formData.get('type')
  if (type) data.type = type.toString()
  
  const format = formData.get('format')
  if (format) data.format = format.toString()
  
  const maxPoints = formData.get('maxPoints')
  if (maxPoints) data.maxPoints = parseInt(maxPoints.toString(), 10)
  
  const shortForm = formData.get('shortForm')
  data.shortForm = shortForm === 'on' || shortForm === 'true'
  
  const startDate = formData.get('startDate')
  if (startDate) data.startDate = new Date(startDate.toString()).toISOString()
  
  const description = formData.get('description')
  if (description) data.description = description.toString()
  
  const location = formData.get('location')
  if (location) data.location = location.toString()
  
  const organizer = formData.get('organizer')
  if (organizer) data.organizer = organizer.toString()
  
  const maxPlayers = formData.get('maxPlayers')
  if (maxPlayers) data.maxPlayers = parseInt(maxPlayers.toString(), 10)
  
  // Settings object
  data.settings = {}
  
  const allowLateRegistration = formData.get('settings.allowLateRegistration')
  data.settings.allowLateRegistration = allowLateRegistration === 'on' || allowLateRegistration === 'true'
  
  const automaticBracketGeneration = formData.get('settings.automaticBracketGeneration')
  data.settings.automaticBracketGeneration = automaticBracketGeneration === 'on' || automaticBracketGeneration === 'true'
  
  const requireCheckin = formData.get('settings.requireCheckin')
  data.settings.requireCheckin = requireCheckin === 'on' || requireCheckin === 'true'
  
  const courtAssignmentMode = formData.get('settings.courtAssignmentMode')
  if (courtAssignmentMode) data.settings.courtAssignmentMode = courtAssignmentMode.toString()
  
  const scoringMode = formData.get('settings.scoringMode')
  if (scoringMode) data.settings.scoringMode = scoringMode.toString()
  
  const realTimeUpdates = formData.get('settings.realTimeUpdates')
  data.settings.realTimeUpdates = realTimeUpdates === 'on' || realTimeUpdates === 'true'
  
  const allowSpectators = formData.get('settings.allowSpectators')
  data.settings.allowSpectators = allowSpectators === 'on' || allowSpectators === 'true'
  
  return data
}

/**
 * Get tournaments with filtering and pagination
 * This is a data fetching action, not a form action
 */
export async function getTournaments(
  filters?: TournamentFilters & { page?: number; limit?: number }
): Promise<ActionResult<{ tournaments: Tournament[]; pagination: any }>> {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    
    // Apply filters to get tournaments
    let tournamentsResult
    
    if (filters?.status) {
      tournamentsResult = await tournamentDB.findByStatus(filters.status)
    } else if (filters?.type) {
      tournamentsResult = await tournamentDB.findByType(filters.type)
    } else if (filters?.format) {
      tournamentsResult = await tournamentDB.findByFormat(filters.format)
    } else if (filters?.organizer) {
      tournamentsResult = await tournamentDB.findByOrganizer(filters.organizer)
    } else if (filters?.dateRange) {
      tournamentsResult = await tournamentDB.findInDateRange(
        new Date(filters.dateRange.start),
        new Date(filters.dateRange.end)
      )
    } else {
      tournamentsResult = await tournamentDB.findAll()
    }
    
    if (tournamentsResult.error) {
      return {
        success: false,
        error: tournamentsResult.error.message || 'Failed to fetch tournaments'
      }
    }
    
    let tournaments = tournamentsResult.data || []
    
    // Apply additional filters
    if (filters?.location) {
      tournaments = tournaments.filter(t => 
        t.location && t.location.toLowerCase().includes(filters.location!.toLowerCase())
      )
    }
    
    // Apply pagination
    const { paginatedData, paginationInfo } = paginateArray(tournaments, page, limit)
    
    return {
      success: true,
      data: {
        tournaments: paginatedData,
        pagination: paginationInfo
      }
    }
    
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching tournaments'
    }
  }
}

/**
 * Get a single tournament by ID
 */
export async function getTournamentById(id: string): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    const result = await tournamentDB.findById(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch tournament'
      }
    }
    
    if (!result.data) {
      return {
        success: false,
        error: `Tournament with ID '${id}' not found`
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the tournament'
    }
  }
}

/**
 * Create a new tournament (form action)
 */
export async function createTournament(formData: FormData): Promise<ActionResult<Tournament>> {
  try {
    // Convert FormData to tournament data
    const tournamentData = formDataToTournamentData(formData)
    
    // Validate the data
    const validation = TournamentFormDataSchema.safeParse(tournamentData)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Sanitize the data
    const sanitizedData = sanitizeTournamentData(validation.data)
    
    // Create tournament in database
    const result = await tournamentDB.create(sanitizedData as any)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to create tournament'
      }
    }
    
    // Revalidate tournaments page to show new tournament
    revalidatePath('/tournaments')
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament created successfully'
    }
    
  } catch (error) {
    console.error('Error creating tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the tournament'
    }
  }
}

/**
 * Create a tournament with typed data (programmatic use)
 */
export async function createTournamentData(data: TournamentFormData): Promise<ActionResult<Tournament>> {
  try {
    // Validate the data
    const validation = TournamentFormDataSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Sanitize the data
    const sanitizedData = sanitizeTournamentData(validation.data)
    
    // Create tournament in database
    const result = await tournamentDB.create(sanitizedData as any)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to create tournament'
      }
    }
    
    // Revalidate tournaments page
    revalidatePath('/tournaments')
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament created successfully'
    }
    
  } catch (error) {
    console.error('Error creating tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the tournament'
    }
  }
}

/**
 * Update an existing tournament (form action)
 */
export async function updateTournament(id: string, formData: FormData): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Convert FormData to tournament data
    const updateData = formDataToTournamentData(formData)
    
    // Create partial validation schema for updates
    const PartialTournamentFormDataSchema = TournamentFormDataSchema.partial()
    const validation = PartialTournamentFormDataSchema.safeParse(updateData)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Sanitize the data
    const sanitizedData = sanitizeTournamentData(validation.data)
    
    // Update tournament in database
    const result = await tournamentDB.update(id, sanitizedData as any)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to update tournament'
      }
    }
    
    // Revalidate tournaments page and specific tournament page
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${id}`)
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament updated successfully'
    }
    
  } catch (error) {
    console.error('Error updating tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the tournament'
    }
  }
}

/**
 * Update a tournament with typed data (programmatic use)
 */
export async function updateTournamentData(
  id: string, 
  data: Partial<TournamentFormData>
): Promise<ActionResult<Tournament>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Create partial validation schema for updates
    const PartialTournamentFormDataSchema = TournamentFormDataSchema.partial()
    const validation = PartialTournamentFormDataSchema.safeParse(data)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Sanitize the data
    const sanitizedData = sanitizeTournamentData(validation.data)
    
    // Update tournament in database
    const result = await tournamentDB.update(id, sanitizedData as any)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to update tournament'
      }
    }
    
    // Revalidate caches
    revalidatePath('/tournaments')
    revalidatePath(`/tournaments/${id}`)
    
    return {
      success: true,
      data: result.data,
      message: 'Tournament updated successfully'
    }
    
  } catch (error) {
    console.error('Error updating tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the tournament'
    }
  }
}

/**
 * Delete (archive) a tournament
 */
export async function deleteTournament(id: string): Promise<ActionResult<{ id: string; archived: boolean }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Check if tournament exists and can be deleted
    const tournamentResult = await tournamentDB.findById(id)
    if (tournamentResult.error || !tournamentResult.data) {
      return {
        success: false,
        error: `Tournament with ID '${id}' not found`
      }
    }
    
    const tournament = tournamentResult.data
    
    // Business rule: can't delete active tournaments
    if (tournament.status === 'active') {
      return {
        success: false,
        error: 'Cannot delete an active tournament. Cancel it first.'
      }
    }
    
    // Delete the tournament (soft delete - moves to archived)
    const result = await tournamentDB.delete(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to delete tournament'
      }
    }
    
    // Revalidate tournaments page
    revalidatePath('/tournaments')
    
    return {
      success: true,
      data: { id, archived: true },
      message: 'Tournament archived successfully'
    }
    
  } catch (error) {
    console.error('Error deleting tournament:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the tournament'
    }
  }
}

/**
 * Search tournaments by name, description, organizer, or location
 */
export async function searchTournaments(
  query: string, 
  filters?: TournamentFilters
): Promise<ActionResult<Tournament[]>> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      }
    }
    
    // Use the search method from TournamentDB
    const result = await tournamentDB.search(query.trim())
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to search tournaments'
      }
    }
    
    let tournaments = result.data || []
    
    // Apply additional filters if provided
    if (filters) {
      if (filters.status) {
        tournaments = tournaments.filter(t => t.status === filters.status)
      }
      if (filters.type) {
        tournaments = tournaments.filter(t => t.type === filters.type)
      }
      if (filters.format) {
        tournaments = tournaments.filter(t => t.format === filters.format)
      }
      if (filters.dateRange) {
        const startDate = new Date(filters.dateRange.start)
        const endDate = new Date(filters.dateRange.end)
        tournaments = tournaments.filter(t => {
          const tournamentDate = new Date(t.startDate)
          return tournamentDate >= startDate && tournamentDate <= endDate
        })
      }
    }
    
    return {
      success: true,
      data: tournaments
    }
    
  } catch (error) {
    console.error('Error searching tournaments:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while searching tournaments'
    }
  }
}