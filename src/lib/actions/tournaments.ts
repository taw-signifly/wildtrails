'use server'

import { revalidatePath } from 'next/cache'
import { TournamentSupabaseDB } from '@/lib/db/tournaments-supabase'

// Lazy initialization of the tournament database
let _db: TournamentSupabaseDB | null = null;
const getDB = () => {
  if (!_db) {
    _db = new TournamentSupabaseDB();
  }
  return _db;
}
import { TournamentFormDataSchema } from '@/lib/validation/tournament'
import { sanitizeTournamentData, paginateArray } from '@/lib/api'
import { resultToActionResult, parseFormDataField, parseFormDataBoolean, parseFormDataNumber, parseFormDataDate, formatZodErrors, isValidTournamentType, isValidGameFormat, isValidCourtAssignmentMode, isValidScoringMode } from '@/lib/api/action-utils'
import { Tournament, TournamentFormData, TournamentFilters, TournamentSettings } from '@/types'
import { ActionResult } from '@/types/actions'


/**
 * Convert FormData to TournamentFormData object with type safety
 */
function formDataToTournamentData(formData: FormData): Partial<TournamentFormData> {
  const data: Partial<TournamentFormData> = {}
  
  // Basic fields with validation
  const name = parseFormDataField(formData, 'name', (v) => v.trim(), false)
  if (name) data.name = name
  
  const type = parseFormDataField(formData, 'type', (v) => {
    if (!isValidTournamentType(v)) {
      throw new Error('Invalid tournament type')
    }
    return v
  }, false)
  if (type) data.type = type
  
  const format = parseFormDataField(formData, 'format', (v) => {
    if (!isValidGameFormat(v)) {
      throw new Error('Invalid game format')
    }
    return v
  }, false)
  if (format) data.format = format
  
  const maxPoints = parseFormDataField(formData, 'maxPoints', (v) => 
    parseFormDataNumber(v, 1, 21), false
  )
  if (maxPoints !== undefined) data.maxPoints = maxPoints
  
  data.shortForm = parseFormDataBoolean(formData, 'shortForm', false)
  
  const startDate = parseFormDataField(formData, 'startDate', parseFormDataDate, false)
  if (startDate) data.startDate = startDate
  
  const description = parseFormDataField(formData, 'description', (v) => v.trim(), false)
  if (description) data.description = description
  
  const location = parseFormDataField(formData, 'location', (v) => v.trim(), false)
  if (location) data.location = location
  
  const organizer = parseFormDataField(formData, 'organizer', (v) => v.trim(), false)
  if (organizer) data.organizer = organizer
  
  const maxPlayers = parseFormDataField(formData, 'maxPlayers', (v) => 
    parseFormDataNumber(v, 2, 200), false
  )
  if (maxPlayers !== undefined) data.maxPlayers = maxPlayers
  
  // Settings object with type safety
  const settings: Partial<TournamentSettings> = {}
  
  settings.allowLateRegistration = parseFormDataBoolean(formData, 'settings.allowLateRegistration', false)
  settings.automaticBracketGeneration = parseFormDataBoolean(formData, 'settings.automaticBracketGeneration', true)
  settings.requireCheckin = parseFormDataBoolean(formData, 'settings.requireCheckin', false)
  
  const courtAssignmentMode = parseFormDataField(formData, 'settings.courtAssignmentMode', (v) => {
    if (!isValidCourtAssignmentMode(v)) {
      throw new Error('Invalid court assignment mode')
    }
    return v
  }, false)
  if (courtAssignmentMode) settings.courtAssignmentMode = courtAssignmentMode
  
  const scoringMode = parseFormDataField(formData, 'settings.scoringMode', (v) => {
    if (!isValidScoringMode(v)) {
      throw new Error('Invalid scoring mode')
    }
    return v
  }, false)
  if (scoringMode) settings.scoringMode = scoringMode
  
  settings.realTimeUpdates = parseFormDataBoolean(formData, 'settings.realTimeUpdates', true)
  settings.allowSpectators = parseFormDataBoolean(formData, 'settings.allowSpectators', true)
  
  data.settings = settings
  
  return data
}

/**
 * Get tournaments with filtering and pagination
 * This is a data fetching action, not a form action
 */
export async function getTournaments(
  filters?: TournamentFilters & { page?: number; limit?: number }
): Promise<ActionResult<{ tournaments: Tournament[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    
    // Apply filters to get tournaments
    let tournamentsResult
    
    if (filters?.status) {
      tournamentsResult = await getDB().findByStatus(filters.status)
    } else if (filters?.type) {
      // Note: findByType method needs to be updated to use format field
      tournamentsResult = await getDB().findByFormat(filters.type)
    } else if (filters?.format) {
      tournamentsResult = await getDB().findByFormat(filters.format)
    } else if (filters?.organizer) {
      // Note: findByOrganizer needs to be implemented or use search
      tournamentsResult = await getDB().search(filters.organizer)
    } else if (filters?.dateRange) {
      tournamentsResult = await getDB().findByDateRange(
        filters.dateRange.start,
        filters.dateRange.end
      )
    } else {
      tournamentsResult = await getDB().findAll()
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
    
    const result = await getDB().findById(id)
    
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
    const sanitizedData = {
      ...sanitizeTournamentData(validation.data),
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true,
        ...validation.data.settings
      }
    }
    
    // Create tournament in database
    const result = await getDB().create(sanitizedData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Tournament created successfully')
    
    // Revalidate tournaments page to show new tournament if successful
    if (actionResult.success) {
      revalidatePath('/tournaments')
    }
    
    return actionResult
    
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
    const sanitizedData = {
      ...sanitizeTournamentData(validation.data),
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true,
        ...validation.data.settings
      }
    }
    
    // Create tournament in database
    const result = await getDB().create(sanitizedData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Tournament created successfully')
    
    // Revalidate tournaments page if successful
    if (actionResult.success) {
      revalidatePath('/tournaments')
    }
    
    return actionResult
    
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
    const sanitizedData = {
      ...sanitizeTournamentData(validation.data),
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true,
        ...validation.data.settings
      }
    }
    
    // Update tournament in database
    const result = await getDB().update(id, sanitizedData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Tournament updated successfully')
    
    // Revalidate tournaments page and specific tournament page if successful
    if (actionResult.success) {
      revalidatePath('/tournaments')
      revalidatePath(`/tournaments/${id}`)
    }
    
    return actionResult
    
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
    const sanitizedData = {
      ...sanitizeTournamentData(validation.data),
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true,
        ...validation.data.settings
      }
    }
    
    // Update tournament in database
    const result = await getDB().update(id, sanitizedData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Tournament updated successfully')
    
    // Revalidate caches if successful
    if (actionResult.success) {
      revalidatePath('/tournaments')
      revalidatePath(`/tournaments/${id}`)
    }
    
    return actionResult
    
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
    const tournamentResult = await getDB().findById(id)
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
    const result = await getDB().delete(id)
    
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
    const result = await getDB().search(query.trim())
    
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