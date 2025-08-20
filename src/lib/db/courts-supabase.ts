import { SupabaseDB, DatabaseError } from './supabase-base'
import { Court, CourtStatus, Result, tryCatch } from '@/types'
import { CourtSchema } from '@/lib/validation/common' // Assuming court schema is in common validation

/**
 * Court-specific Supabase database operations
 */
export class CourtSupabaseDB extends SupabaseDB<Court> {
  constructor() {
    super(
      'courts',
      {
        tableName: 'courts',
        enableRealtime: true
      },
      CourtSchema
    )
  }

  /**
   * Find courts by tournament
   */
  async findByTournament(tournamentId: string): Promise<Result<Court[], DatabaseError>> {
    const filters = { tournament_id: tournamentId }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find courts by status
   */
  async findByStatus(status: CourtStatus | CourtStatus[]): Promise<Result<Court[], DatabaseError>> {
    const filters = {
      status: Array.isArray(status) ? status : [status]
    }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find available courts for a tournament
   */
  async findAvailable(tournamentId: string): Promise<Result<Court[], DatabaseError>> {
    const filters = { 
      tournament_id: tournamentId,
      status: 'available'
    }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find occupied courts
   */
  async findOccupied(tournamentId: string): Promise<Result<Court[], DatabaseError>> {
    const filters = { 
      tournament_id: tournamentId,
      status: 'occupied'
    }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Update court status
   */
  async updateStatus(id: string, status: CourtStatus): Promise<Result<Court, DatabaseError>> {
    return this.update(id, { status })
  }

  /**
   * Get courts with current match assignments
   */
  async findWithCurrentMatches(tournamentId: string): Promise<Result<any[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('courts')
        .select(`
          *,
          current_match:matches!court_id(
            id,
            round,
            match_number,
            status,
            start_time,
            team1:teams!team1_id(id, name),
            team2:teams!team2_id(id, name)
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('name', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find courts with matches: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Get court usage statistics
   */
  async getCourtStats(courtId: string): Promise<Result<{
    totalMatches: number
    completedMatches: number
    averageMatchDuration: number // in minutes
    utilizationPercentage: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const { data: matches, error } = await this.supabase
        .from('matches')
        .select('status, start_time, end_time')
        .eq('court_id', courtId)

      if (error) {
        throw new DatabaseError(`Failed to get court stats: ${error.message}`)
      }

      const totalMatches = matches?.length || 0
      const completedMatches = matches?.filter(m => m.status === 'completed').length || 0
      
      // Calculate average match duration for completed matches
      let totalDuration = 0
      let matchesWithDuration = 0

      matches?.forEach(match => {
        if (match.status === 'completed' && match.start_time && match.end_time) {
          const start = new Date(match.start_time)
          const end = new Date(match.end_time)
          const duration = (end.getTime() - start.getTime()) / (1000 * 60) // Convert to minutes
          
          if (duration > 0 && duration < 300) { // Reasonable match duration (5 hours max)
            totalDuration += duration
            matchesWithDuration++
          }
        }
      })

      const averageMatchDuration = matchesWithDuration > 0 ? Math.round(totalDuration / matchesWithDuration) : 0
      const utilizationPercentage = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

      return {
        totalMatches,
        completedMatches,
        averageMatchDuration,
        utilizationPercentage
      }
    })
  }

  /**
   * Get tournament court statistics
   */
  async getTournamentCourtStats(tournamentId: string): Promise<Result<{
    total: number
    available: number
    occupied: number
    maintenance: number
    utilizationRate: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const { data: courts, error: courtsError } = await this.supabase
        .from('courts')
        .select('status')
        .eq('tournament_id', tournamentId)

      if (courtsError) {
        throw new DatabaseError(`Failed to get tournament court stats: ${courtsError.message}`)
      }

      // Get total matches assigned to courts
      const { data: matches, error: matchesError } = await this.supabase
        .from('matches')
        .select('court_id, status')
        .eq('tournament_id', tournamentId)
        .not('court_id', 'is', null)

      if (matchesError) {
        throw new DatabaseError(`Failed to get match court assignments: ${matchesError.message}`)
      }

      const stats = {
        total: courts?.length || 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
        utilizationRate: 0
      }

      courts?.forEach(court => {
        switch (court.status) {
          case 'available':
            stats.available++
            break
          case 'occupied':
            stats.occupied++
            break
          case 'maintenance':
            stats.maintenance++
            break
        }
      })

      // Calculate utilization rate
      const totalMatches = matches?.length || 0
      const totalCourts = stats.total
      const completedMatches = matches?.filter(m => m.status === 'completed').length || 0

      if (totalCourts > 0 && totalMatches > 0) {
        stats.utilizationRate = Math.round((completedMatches / totalMatches) * 100)
      }

      return stats
    })
  }

  /**
   * Assign match to court
   */
  async assignMatch(courtId: string, matchId: string): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      // Update court status to occupied
      const courtUpdate = this.updateStatus(courtId, 'occupied')
      
      // Update match with court assignment
      const { error: matchError } = await this.supabase
        .from('matches')
        .update({ court_id: courtId })
        .eq('id', matchId)

      if (matchError) {
        throw new DatabaseError(`Failed to assign match to court: ${matchError.message}`)
      }

      // Wait for court update to complete
      const courtResult = await courtUpdate
      if (courtResult.error) {
        throw courtResult.error
      }
    })
  }

  /**
   * Release court from match
   */
  async releaseFromMatch(courtId: string, matchId: string): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      // Remove court assignment from match
      const { error: matchError } = await this.supabase
        .from('matches')
        .update({ court_id: null })
        .eq('id', matchId)

      if (matchError) {
        throw new DatabaseError(`Failed to release court from match: ${matchError.message}`)
      }

      // Update court status to available
      const courtResult = await this.updateStatus(courtId, 'available')
      if (courtResult.error) {
        throw courtResult.error
      }
    })
  }

  /**
   * Find next available court
   */
  async findNextAvailable(tournamentId: string): Promise<Result<Court | null, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('courts')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'available')
        .order('name', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        // Handle "not found" case specifically
        if (error.code === 'PGRST116') {
          return null
        }
        throw new DatabaseError(`Failed to find next available court: ${error.message}`)
      }

      return data ? this.validateData(data) : null
    })
  }

  /**
   * Check if court name exists in tournament
   */
  async isNameTaken(tournamentId: string, name: string, excludeCourtId?: string): Promise<Result<boolean, DatabaseError>> {
    return tryCatch(async () => {
      let query = this.supabase
        .from('courts')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('name', name)

      if (excludeCourtId) {
        query = query.neq('id', excludeCourtId)
      }

      const { data, error } = await query

      if (error) {
        throw new DatabaseError(`Failed to check court name: ${error.message}`)
      }

      return (data?.length || 0) > 0
    })
  }

  /**
   * Create multiple courts for a tournament
   */
  async createMultiple(
    tournamentId: string,
    courtData: Array<{
      name: string
      location?: string
      notes?: string
    }>
  ): Promise<Result<Court[], DatabaseError>> {
    return tryCatch(async () => {
      const courts = courtData.map(court => ({
        tournament_id: tournamentId,
        name: court.name,
        location: court.location || null,
        notes: court.notes || null,
        status: 'available' as CourtStatus
      }))

      const { data, error } = await this.supabase
        .from('courts')
        .insert(courts)
        .select()

      if (error) {
        throw new DatabaseError(`Failed to create multiple courts: ${error.message}`)
      }

      return (data || []).map(record => this.validateData(record))
    })
  }
}