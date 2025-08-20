import { SupabaseDB, DatabaseError } from './supabase-base'
import { Tournament, TournamentStatus, TournamentFormData, TournamentStats, Result, tryCatch } from '@/types'
import { TournamentSchema, TournamentFormDataSchema } from '@/lib/validation/tournament'

/**
 * Tournament-specific Supabase database operations
 */
export class TournamentSupabaseDB extends SupabaseDB<Tournament> {
  constructor() {
    super(
      'tournaments',
      {
        tableName: 'tournaments',
        enableRealtime: true
      },
      TournamentSchema
    )
  }

  /**
   * Create a new tournament from form data
   */
  async create(formData: TournamentFormData): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      // Validate form data
      const validatedFormData = TournamentFormDataSchema.parse(formData)
      
      // Convert form data to tournament entity with default settings
      const defaultSettings = {
        allowLateRegistration: true,
        automaticBracketGeneration: true,
        requireCheckin: true,
        courtAssignmentMode: 'automatic' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true
      }

      const tournamentData = {
        name: validatedFormData.name,
        description: validatedFormData.description,
        format: validatedFormData.format,
        max_players: validatedFormData.maxPlayers,
        start_date: validatedFormData.startDate,
        end_date: validatedFormData.endDate,
        registration_deadline: validatedFormData.registrationDeadline,
        location: validatedFormData.location,
        settings: {
          ...defaultSettings,
          ...(validatedFormData.settings || {})
        },
        bracket_data: {}
      }

      const { data: insertedData, error } = await this.supabase
        .from('tournaments')
        .insert(tournamentData)
        .select()
        .single()

      if (error) {
        throw new DatabaseError(`Failed to create tournament: ${error.message}`, new Error(error.message))
      }

      return this.validateData(insertedData)
    })
  }

  /**
   * Find tournaments by status
   */
  async findByStatus(status: TournamentStatus | TournamentStatus[]): Promise<Result<Tournament[], DatabaseError>> {
    const filters = {
      status: Array.isArray(status) ? status : [status]
    }
    return this.findAll(filters)
  }

  /**
   * Find tournaments by format
   */
  async findByFormat(format: string): Promise<Result<Tournament[], DatabaseError>> {
    const filters = { format }
    return this.findAll(filters)
  }

  /**
   * Find active tournaments
   */
  async findActive(): Promise<Result<Tournament[], DatabaseError>> {
    return this.findByStatus(['registration', 'in_progress'])
  }

  /**
   * Find tournaments by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('tournaments')
        .select('*')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find tournaments by date range: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Search tournaments by name or location
   */
  async search(query: string): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('tournaments')
        .select('*')
        .or(`name.ilike.%${query}%,location.ilike.%${query}%,description.ilike.%${query}%`)
        .order('updated_at', { ascending: false })

      if (error) {
        throw new DatabaseError(`Failed to search tournaments: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Update tournament status
   */
  async updateStatus(id: string, status: TournamentStatus): Promise<Result<Tournament, DatabaseError>> {
    return this.update(id, { status })
  }

  /**
   * Update tournament settings
   */
  async updateSettings(id: string, settings: Partial<Tournament['settings']>): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      // Get current tournament to merge settings
      const currentResult = await this.findById(id)
      if (currentResult.error) {
        throw currentResult.error
      }
      if (!currentResult.data) {
        throw new DatabaseError(`Tournament ${id} not found`)
      }

      const mergedSettings = {
        ...currentResult.data.settings,
        ...settings
      }

      return this.update(id, { settings: mergedSettings })
    })
  }

  /**
   * Update bracket data
   */
  async updateBracketData(id: string, bracketData: any): Promise<Result<Tournament, DatabaseError>> {
    return this.update(id, { bracket_data: bracketData })
  }

  /**
   * Update player count
   */
  async updatePlayerCount(id: string, playerCount: number): Promise<Result<Tournament, DatabaseError>> {
    return this.update(id, { current_players: playerCount })
  }

  /**
   * Get tournaments requiring action (draft status, registration deadline passed, etc.)
   */
  async findRequiringAction(): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const now = new Date().toISOString()
      
      const { data, error } = await this.supabase
        .from('tournaments')
        .select('*')
        .or(`status.eq.draft,and(status.eq.registration,registration_deadline.lt.${now})`)
        .order('start_date', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find tournaments requiring action: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Get tournament statistics
   */
  async getStats(id: string): Promise<Result<TournamentStats, DatabaseError>> {
    return tryCatch(async () => {
      // Get tournament details
      const tournamentResult = await this.findById(id)
      if (tournamentResult.error) throw tournamentResult.error
      if (!tournamentResult.data) throw new DatabaseError(`Tournament ${id} not found`)

      // Get match statistics
      const { data: matchStats, error: matchError } = await this.supabase
        .from('matches')
        .select('status')
        .eq('tournament_id', id)

      if (matchError) {
        throw new DatabaseError(`Failed to get match statistics: ${matchError.message}`)
      }

      // Get team/player statistics  
      const { data: teamStats, error: teamError } = await this.supabase
        .from('teams')
        .select('status')
        .eq('tournament_id', id)

      if (teamError) {
        throw new DatabaseError(`Failed to get team statistics: ${teamError.message}`)
      }

      const totalMatches = matchStats?.length || 0
      const completedMatches = matchStats?.filter(m => m.status === 'completed').length || 0
      const totalTeams = teamStats?.length || 0
      const activeTeams = teamStats?.filter(t => t.status === 'active').length || 0

      const stats: TournamentStats = {
        totalMatches,
        completedMatches,
        pendingMatches: totalMatches - completedMatches,
        totalTeams,
        activeTeams,
        eliminatedTeams: totalTeams - activeTeams,
        completionPercentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
      }

      return stats
    })
  }

  /**
   * Get tournaments with pagination
   */
  async findPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: TournamentStatus[]
      format?: string
      search?: string
    }
  ): Promise<Result<{ tournaments: Tournament[], total: number, hasMore: boolean }, DatabaseError>> {
    return tryCatch(async () => {
      const offset = (page - 1) * limit

      let query = this.supabase.from('tournaments').select('*', { count: 'exact' })

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters?.format) {
        query = query.eq('format', filters.format)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,location.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      // Apply pagination and ordering
      query = query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        throw new DatabaseError(`Failed to find paginated tournaments: ${error.message}`, new Error(error.message))
      }

      const tournaments = (data || []).map(record => this.validateData(record))
      const total = count || 0
      const hasMore = offset + limit < total

      return {
        tournaments,
        total,
        hasMore
      }
    })
  }

  /**
   * Archive completed tournaments
   */
  async archiveCompleted(): Promise<Result<number, DatabaseError>> {
    return tryCatch(async () => {
      // Update completed tournaments to archived status
      const { data, error } = await this.supabase
        .from('tournaments')
        .update({ status: 'archived' })
        .eq('status', 'completed')
        .select('id')

      if (error) {
        throw new DatabaseError(`Failed to archive completed tournaments: ${error.message}`, new Error(error.message))
      }

      return data?.length || 0
    })
  }
}