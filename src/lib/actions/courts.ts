'use server'

import { revalidatePath } from 'next/cache'
import { courtDB } from '@/lib/db/courts'
import { matchDB } from '@/lib/db/matches'
import { CourtSchema } from '@/lib/validation/match'
import { resultToActionResult, parseFormDataField, parseFormDataBoolean, formatZodErrors } from '@/lib/api/action-utils'
import { broadcastCourtUpdate } from '@/lib/api/sse'
import { Court, Match } from '@/types'
import { ActionResult } from '@/types/actions'
import { CourtStatus, CourtSurface, CourtCreateData } from '@/lib/db/courts'

/**
 * Convert FormData to CourtCreateData object
 */
function formDataToCourtData(formData: FormData): Partial<CourtCreateData> {
  const data: Partial<CourtCreateData> = {}
  
  const name = parseFormDataField(formData, 'name', (v) => v.trim(), false)
  if (name) data.name = name
  
  const location = parseFormDataField(formData, 'location', (v) => v.trim(), false)
  if (location) data.location = location
  
  const surface = parseFormDataField(formData, 'surface', (v) => {
    const validSurfaces: CourtSurface[] = ['gravel', 'sand', 'dirt', 'artificial']
    if (!validSurfaces.includes(v as CourtSurface)) {
      throw new Error('Invalid surface type')
    }
    return v as CourtSurface
  }, false)
  if (surface) data.surface = surface
  
  // Dimensions
  const length = parseFormDataField(formData, 'length', (v) => parseFloat(v), false)
  const width = parseFormDataField(formData, 'width', (v) => parseFloat(v), false)
  const throwingDistance = parseFormDataField(formData, 'throwingDistance', (v) => parseFloat(v), false)
  
  if (length && width && throwingDistance) {
    data.dimensions = { length, width, throwingDistance }
  }
  
  data.lighting = parseFormDataBoolean(formData, 'lighting', false)
  data.covered = parseFormDataBoolean(formData, 'covered', false)
  
  // Amenities
  const amenitiesData = formData.getAll('amenities')
  if (amenitiesData.length > 0) {
    data.amenities = amenitiesData.map(a => a.toString().trim()).filter(a => a.length > 0)
  }
  
  return data
}

/**
 * Get all courts with optional filtering
 */
export async function getCourts(filters?: {
  status?: CourtStatus
  surface?: CourtSurface
  location?: string
  available?: boolean
}): Promise<ActionResult<Court[]>> {
  try {
    let courtsResult
    
    if (filters?.available) {
      courtsResult = await courtDB.findAvailable()
    } else if (filters?.status) {
      courtsResult = await courtDB.findAll({ status: filters.status })
    } else if (filters?.surface) {
      courtsResult = await courtDB.findBySurface(filters.surface)
    } else {
      courtsResult = await courtDB.findAll()
    }
    
    if (courtsResult.error) {
      return {
        success: false,
        error: courtsResult.error.message || 'Failed to fetch courts'
      }
    }
    
    let courts = courtsResult.data || []
    
    // Apply additional filters
    if (filters?.location) {
      const locationResult = await courtDB.findByLocation(filters.location)
      if (locationResult.data) {
        courts = courts.filter(c => locationResult.data!.some(fc => fc.id === c.id))
      }
    }
    
    return {
      success: true,
      data: courts
    }
    
  } catch (error) {
    console.error('Error fetching courts:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching courts'
    }
  }
}

/**
 * Get a single court by ID
 */
export async function getCourtById(id: string): Promise<ActionResult<Court>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    const result = await courtDB.findById(id)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to fetch court'
      }
    }
    
    if (!result.data) {
      return {
        success: false,
        error: `Court with ID '${id}' not found`
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error fetching court:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the court'
    }
  }
}

/**
 * Create a new court (form action)
 */
export async function createCourt(formData: FormData): Promise<ActionResult<Court>> {
  try {
    // Convert FormData to court data
    const courtData = formDataToCourtData(formData)
    
    // Validate required fields
    if (!courtData.name || !courtData.location || !courtData.surface || !courtData.dimensions) {
      return {
        success: false,
        error: 'Name, location, surface, and dimensions are required'
      }
    }
    
    // Create court in database
    const result = await courtDB.create(courtData as CourtCreateData)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Court created successfully')
    
    // Revalidate courts page if successful
    if (actionResult.success) {
      revalidatePath('/courts')
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error creating court:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the court'
    }
  }
}

/**
 * Update court data (programmatic use)
 */
export async function updateCourtData(id: string, data: Partial<Court>): Promise<ActionResult<Court>> {
  try {
    if (!id) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    // Update court in database
    const result = await courtDB.update(id, data)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Court updated successfully')
    
    // Revalidate courts page if successful
    if (actionResult.success) {
      revalidatePath('/courts')
      revalidatePath(`/courts/${id}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating court:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the court'
    }
  }
}

/**
 * Update court status
 */
export async function updateCourtStatus(courtId: string, status: CourtStatus): Promise<ActionResult<Court>> {
  try {
    if (!courtId) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    const validStatuses: CourtStatus[] = ['available', 'in-use', 'maintenance', 'reserved']
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: 'Invalid court status'
      }
    }
    
    // Update court status in database
    const result = await courtDB.updateStatus(courtId, status)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, `Court status updated to ${status}`)
    
    // Revalidate courts page if successful
    if (actionResult.success) {
      revalidatePath('/courts')
      revalidatePath(`/courts/${courtId}`)
      
      // Broadcast court status update via SSE
      broadcastCourtUpdate(courtId, actionResult.data, [`status changed to ${status}`])
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error updating court status:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating court status'
    }
  }
}

/**
 * Assign a match to a court
 */
export async function assignMatchToCourt(matchId: string, courtId: string): Promise<ActionResult<{
  match: Match
  court: Court
}>> {
  try {
    if (!matchId || !courtId) {
      return {
        success: false,
        error: 'Match ID and Court ID are required'
      }
    }
    
    // Check if court is available
    const courtResult = await courtDB.findById(courtId)
    if (courtResult.error || !courtResult.data) {
      return {
        success: false,
        error: 'Court not found'
      }
    }
    
    const court = courtResult.data
    if (court.status !== 'available' && court.status !== 'reserved') {
      return {
        success: false,
        error: `Court is not available (current status: ${court.status})`
      }
    }
    
    // Check if match exists and can be assigned
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    if (match.status === 'completed' || match.status === 'cancelled') {
      return {
        success: false,
        error: `Cannot assign court to ${match.status} match`
      }
    }
    
    // Assign court to match
    const courtAssignResult = await courtDB.assignMatch(courtId, matchId)
    if (courtAssignResult.error) {
      return {
        success: false,
        error: courtAssignResult.error.message || 'Failed to assign court'
      }
    }
    
    // Update match with court assignment
    const matchUpdateResult = await matchDB.assignCourt(matchId, courtId)
    if (matchUpdateResult.error) {
      return {
        success: false,
        error: matchUpdateResult.error.message || 'Failed to update match with court assignment'
      }
    }
    
    // Revalidate pages
    revalidatePath(`/matches/${matchId}`)
    revalidatePath(`/courts/${courtId}`)
    revalidatePath(`/tournaments/${match.tournamentId}`)
    
    return {
      success: true,
      data: {
        match: matchUpdateResult.data,
        court: courtAssignResult.data
      },
      message: 'Match assigned to court successfully'
    }
    
  } catch (error) {
    console.error('Error assigning match to court:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while assigning match to court'
    }
  }
}

/**
 * Release court assignment from a match
 */
export async function releaseCourtAssignment(matchId: string): Promise<ActionResult<{
  match: Match
  court?: Court
}>> {
  try {
    if (!matchId) {
      return {
        success: false,
        error: 'Match ID is required'
      }
    }
    
    // Get match to find court
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    const match = matchResult.data
    if (!match.courtId) {
      return {
        success: false,
        error: 'Match is not assigned to any court'
      }
    }
    
    // Release court from match
    const courtReleaseResult = await courtDB.releaseFromMatch(match.courtId)
    if (courtReleaseResult.error) {
      return {
        success: false,
        error: courtReleaseResult.error.message || 'Failed to release court'
      }
    }
    
    // Update match to remove court assignment
    const matchUpdateResult = await matchDB.update(matchId, { courtId: undefined })
    if (matchUpdateResult.error) {
      return {
        success: false,
        error: matchUpdateResult.error.message || 'Failed to update match'
      }
    }
    
    // Revalidate pages
    revalidatePath(`/matches/${matchId}`)
    revalidatePath(`/courts/${match.courtId}`)
    revalidatePath(`/tournaments/${match.tournamentId}`)
    
    return {
      success: true,
      data: {
        match: matchUpdateResult.data,
        court: courtReleaseResult.data
      },
      message: 'Court assignment released successfully'
    }
    
  } catch (error) {
    console.error('Error releasing court assignment:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while releasing court assignment'
    }
  }
}

/**
 * Find available court for a tournament
 */
export async function findAvailableCourt(
  tournamentId: string,
  requirements?: {
    preferredSurface?: CourtSurface
    requireLighting?: boolean
    requireCovered?: boolean
    requiredAmenities?: string[]
  }
): Promise<ActionResult<Court | null>> {
  try {
    if (!tournamentId) {
      return {
        success: false,
        error: 'Tournament ID is required'
      }
    }
    
    // Find suitable courts based on requirements
    const suitableCourtsResult = await courtDB.findSuitableForTournament({
      minCourts: 1,
      preferredSurface: requirements?.preferredSurface,
      requireLighting: requirements?.requireLighting,
      requireCovered: requirements?.requireCovered,
      requiredAmenities: requirements?.requiredAmenities,
      excludeInMaintenance: true
    })
    
    if (suitableCourtsResult.error) {
      return {
        success: false,
        error: suitableCourtsResult.error.message || 'Failed to find suitable courts'
      }
    }
    
    const suitableCourts = suitableCourtsResult.data || []
    
    // Filter for available courts only
    const availableCourts = suitableCourts.filter(court => court.status === 'available')
    
    if (availableCourts.length === 0) {
      return {
        success: true,
        data: null,
        message: 'No suitable courts available at this time'
      }
    }
    
    // Return the first available court (could be enhanced with more sophisticated selection logic)
    return {
      success: true,
      data: availableCourts[0],
      message: 'Available court found'
    }
    
  } catch (error) {
    console.error('Error finding available court:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while finding available court'
    }
  }
}

/**
 * Get court availability for date range
 */
export async function getCourtAvailability(
  courtId: string,
  dateRange?: { start: string; end: string }
): Promise<ActionResult<{
  court: Court
  availability: {
    status: CourtStatus
    currentMatch?: string
    nextMatch?: string
    estimatedAvailableTime?: Date
  }
  upcomingMatches: Match[]
}>> {
  try {
    if (!courtId) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    // Get court data
    const courtResult = await courtDB.findById(courtId)
    if (courtResult.error || !courtResult.data) {
      return {
        success: false,
        error: 'Court not found'
      }
    }
    
    const court = courtResult.data
    
    // Get court schedule
    const scheduleResult = await courtDB.getSchedule(courtId)
    if (scheduleResult.error) {
      return {
        success: false,
        error: scheduleResult.error.message || 'Failed to get court schedule'
      }
    }
    
    const schedule = scheduleResult.data
    
    // Get upcoming matches for this court
    let upcomingMatches: Match[] = []
    const matchesResult = await matchDB.findByCourt(courtId)
    if (matchesResult.data) {
      upcomingMatches = matchesResult.data.filter(match => 
        match.status === 'scheduled' && 
        (!dateRange || (
          match.scheduledTime &&
          new Date(match.scheduledTime) >= new Date(dateRange.start) &&
          new Date(match.scheduledTime) <= new Date(dateRange.end)
        ))
      ).sort((a, b) => 
        new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime()
      )
    }
    
    return {
      success: true,
      data: {
        court,
        availability: {
          status: schedule.status,
          currentMatch: schedule.currentMatch,
          nextMatch: schedule.nextMatch,
          estimatedAvailableTime: schedule.estimatedAvailableTime
        },
        upcomingMatches
      }
    }
    
  } catch (error) {
    console.error('Error getting court availability:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting court availability'
    }
  }
}

/**
 * Get court schedule
 */
export async function getCourtSchedule(
  courtId: string,
  dateRange?: { start: string; end: string }
): Promise<ActionResult<{
  court: Court
  matches: Match[]
  utilization: {
    totalHours: number
    usedHours: number
    utilizationRate: number
  }
}>> {
  try {
    if (!courtId) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    // Get court data
    const courtResult = await courtDB.findById(courtId)
    if (courtResult.error || !courtResult.data) {
      return {
        success: false,
        error: 'Court not found'
      }
    }
    
    const court = courtResult.data
    
    // Get matches for this court
    let matchesResult
    if (dateRange) {
      matchesResult = await matchDB.findInDateRange(
        new Date(dateRange.start),
        new Date(dateRange.end)
      )
    } else {
      matchesResult = await matchDB.findByCourt(courtId)
    }
    
    if (matchesResult.error) {
      return {
        success: false,
        error: matchesResult.error.message || 'Failed to get court matches'
      }
    }
    
    let matches = matchesResult.data || []
    
    // Filter by court if we got all matches in date range
    if (dateRange) {
      matches = matches.filter(match => match.courtId === courtId)
    }
    
    // Calculate utilization
    let totalHours = 24 // Default to 24 hours if no date range
    let usedHours = 0
    
    if (dateRange) {
      const start = new Date(dateRange.start)
      const end = new Date(dateRange.end)
      totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }
    
    // Calculate used hours from match durations
    matches.forEach(match => {
      if (match.duration) {
        usedHours += match.duration / 60 // Convert minutes to hours
      } else if (match.startTime && match.endTime) {
        const duration = (new Date(match.endTime).getTime() - new Date(match.startTime).getTime()) / (1000 * 60 * 60)
        usedHours += duration
      } else if (match.status === 'active') {
        // Estimate 1.5 hours for active matches
        usedHours += 1.5
      }
    })
    
    const utilizationRate = totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0
    
    return {
      success: true,
      data: {
        court,
        matches,
        utilization: {
          totalHours: Math.round(totalHours * 10) / 10,
          usedHours: Math.round(usedHours * 10) / 10,
          utilizationRate
        }
      }
    }
    
  } catch (error) {
    console.error('Error getting court schedule:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting court schedule'
    }
  }
}

/**
 * Reserve court for match
 */
export async function reserveCourtForMatch(courtId: string, matchId: string): Promise<ActionResult<{
  court: Court
  match: Match
}>> {
  try {
    if (!courtId || !matchId) {
      return {
        success: false,
        error: 'Court ID and Match ID are required'
      }
    }
    
    // Reserve court for match
    const courtReserveResult = await courtDB.reserveForMatch(courtId, matchId)
    if (courtReserveResult.error) {
      return {
        success: false,
        error: courtReserveResult.error.message || 'Failed to reserve court'
      }
    }
    
    // Get match data
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }
    
    // Revalidate pages
    revalidatePath(`/courts/${courtId}`)
    revalidatePath(`/matches/${matchId}`)
    revalidatePath(`/tournaments/${matchResult.data.tournamentId}`)
    
    return {
      success: true,
      data: {
        court: courtReserveResult.data,
        match: matchResult.data
      },
      message: 'Court reserved for match successfully'
    }
    
  } catch (error) {
    console.error('Error reserving court for match:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while reserving court for match'
    }
  }
}

/**
 * Set court maintenance mode
 */
export async function setCourtMaintenance(courtId: string, reason?: string): Promise<ActionResult<Court>> {
  try {
    if (!courtId) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    // Set court to maintenance mode
    const result = await courtDB.setMaintenance(courtId, reason)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Court set to maintenance mode')
    
    // Revalidate courts page if successful
    if (actionResult.success) {
      revalidatePath('/courts')
      revalidatePath(`/courts/${courtId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error setting court maintenance:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while setting court maintenance'
    }
  }
}

/**
 * Remove court from maintenance mode
 */
export async function removeCourtMaintenance(courtId: string): Promise<ActionResult<Court>> {
  try {
    if (!courtId) {
      return {
        success: false,
        error: 'Court ID is required'
      }
    }
    
    // Remove court from maintenance mode
    const result = await courtDB.removeMaintenance(courtId)
    
    // Convert database result to action result
    const actionResult = resultToActionResult(result, 'Court removed from maintenance mode')
    
    // Revalidate courts page if successful
    if (actionResult.success) {
      revalidatePath('/courts')
      revalidatePath(`/courts/${courtId}`)
    }
    
    return actionResult
    
  } catch (error) {
    console.error('Error removing court maintenance:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while removing court maintenance'
    }
  }
}

/**
 * Get court utilization statistics
 */
export async function getCourtUtilization(dateRange?: { start: string; end: string }): Promise<ActionResult<{
  total: number
  available: number
  inUse: number
  maintenance: number
  reserved: number
  utilizationRate: number
  byLocation: Record<string, number>
  bySurface: Record<CourtSurface, number>
}>> {
  try {
    // Get court utilization stats
    const result = await courtDB.getUtilizationStats()
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to get court utilization statistics'
      }
    }
    
    return {
      success: true,
      data: result.data
    }
    
  } catch (error) {
    console.error('Error getting court utilization:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while getting court utilization statistics'
    }
  }
}

/**
 * Search courts by name, location, or amenities
 */
export async function searchCourts(query: string): Promise<ActionResult<Court[]>> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      }
    }
    
    const result = await courtDB.search(query)
    
    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to search courts'
      }
    }
    
    return {
      success: true,
      data: result.data || []
    }
    
  } catch (error) {
    console.error('Error searching courts:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while searching courts'
    }
  }
}