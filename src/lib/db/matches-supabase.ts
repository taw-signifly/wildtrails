import { SupabaseDB, DatabaseError } from './supabase-base'
import { Match, MatchStatus, Result, tryCatch } from '@/types'
import { MatchSchema } from '@/lib/validation/match'

/**
 * Match-specific Supabase database operations
 */
export class MatchSupabaseDB extends SupabaseDB<Match> {
  constructor() {
    super(
      'matches',
      {
        tableName: 'matches',
        enableRealtime: true
      },
      MatchSchema as any
    )
  }

  /**
   * Find matches by tournament
   */
  async findByTournament(tournamentId: string): Promise<Result<Match[], DatabaseError>> {
    const filters = { tournament_id: tournamentId }
    return this.findAll(filters, { orderBy: 'round', ascending: true })
  }

  /**
   * Find matches by status
   */
  async findByStatus(status: MatchStatus | MatchStatus[]): Promise<Result<Match[], DatabaseError>> {
    const filters = {
      status: Array.isArray(status) ? status : [status]
    }
    return this.findAll(filters, { orderBy: 'updated_at', ascending: false })
  }

  /**
   * Find matches by round
   */
  async findByRound(tournamentId: string, round: number): Promise<Result<Match[], DatabaseError>> {
    const filters = { tournament_id: tournamentId, round }
    return this.findAll(filters, { orderBy: 'match_number', ascending: true })
  }

  /**
   * Find matches for a specific team
   */
  async findByTeam(teamId: string): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('matches')
        .select('*')
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
        .order('round', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find matches by team: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Find matches assigned to a court
   */
  async findByCourt(courtId: string): Promise<Result<Match[], DatabaseError>> {
    const filters = { court_id: courtId }
    return this.findAll(filters, { orderBy: 'start_time', ascending: true })
  }

  /**
   * Find active matches (in progress)
   */
  async findActive(): Promise<Result<Match[], DatabaseError>> {
    return this.findByStatus('active')
  }

  /**
   * Find completed matches
   */
  async findCompleted(tournamentId?: string): Promise<Result<Match[], DatabaseError>> {
    const filters: any = { status: 'completed' }
    if (tournamentId) {
      filters.tournament_id = tournamentId
    }
    return this.findAll(filters, { orderBy: 'end_time', ascending: false })
  }

  /**
   * Find pending matches
   */
  async findPending(tournamentId?: string): Promise<Result<Match[], DatabaseError>> {
    const filters: any = { status: 'pending' }
    if (tournamentId) {
      filters.tournament_id = tournamentId
    }
    return this.findAll(filters, { orderBy: 'round', ascending: true })
  }

  /**
   * Update match status
   */
  async updateStatus(id: string, status: MatchStatus): Promise<Result<Match, DatabaseError>> {
    const updates: any = { status }
    
    if (status === 'active') {
      updates.start_time = new Date().toISOString()
    } else if (status === 'completed') {
      updates.end_time = new Date().toISOString()
    }

    return this.update(id, updates)
  }

  /**
   * Update match score
   */
  async updateScore(id: string, score: any): Promise<Result<Match, DatabaseError>> {
    return this.update(id, { score })
  }

  /**
   * Set match winner
   */
  async setWinner(id: string, winnerId: string): Promise<Result<Match, DatabaseError>> {
    return this.update(id, { 
      winner: winnerId,
      status: 'completed',
      endTime: new Date().toISOString()
    } as any)
  }

  /**
   * Assign match to court
   */
  async assignToCourt(id: string, courtId: string): Promise<Result<Match, DatabaseError>> {
    return this.update(id, { court_id: courtId })
  }

  /**
   * Remove court assignment
   */
  async removeCourtAssignment(id: string): Promise<Result<Match, DatabaseError>> {
    return this.update(id, { courtId: undefined } as any)
  }

  /**
   * Get match statistics for a tournament
   */
  async getTournamentMatchStats(tournamentId: string): Promise<Result<{
    total: number
    pending: number
    inProgress: number
    completed: number
    cancelled: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('matches')
        .select('status')
        .eq('tournament_id', tournamentId)

      if (error) {
        throw new DatabaseError(`Failed to get tournament match stats: ${error.message}`)
      }

      const stats = {
        total: data?.length || 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0
      }

      data?.forEach(match => {
        switch (match.status) {
          case 'pending':
            stats.pending++
            break
          case 'in_progress':
            stats.inProgress++
            break
          case 'completed':
            stats.completed++
            break
          case 'cancelled':
            stats.cancelled++
            break
        }
      })

      return stats
    })
  }

  /**
   * Get matches with detailed team information
   */
  async findWithTeamDetails(filters?: {
    tournamentId?: string
    status?: MatchStatus
    round?: number
  }): Promise<Result<any[], DatabaseError>> {
    return tryCatch(async () => {
      let query = this.supabase
        .from('matches')
        .select(`
          *,
          team1:teams!team1_id(id, name, type),
          team2:teams!team2_id(id, name, type),
          winner:teams!winner_id(id, name),
          court:courts(id, name, location)
        `)

      if (filters?.tournamentId) {
        query = query.eq('tournament_id', filters.tournamentId)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.round) {
        query = query.eq('round', filters.round)
      }

      query = query.order('round', { ascending: true }).order('match_number', { ascending: true })

      const { data, error } = await query

      if (error) {
        throw new DatabaseError(`Failed to find matches with team details: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Create matches for a tournament round
   */
  async createRoundMatches(
    tournamentId: string,
    round: number,
    matchesData: Array<{
      matchNumber: number
      team1Id?: string
      team2Id?: string
      courtId?: string
    }>
  ): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const matches = matchesData.map(match => ({
        tournament_id: tournamentId,
        round,
        match_number: match.matchNumber,
        team1_id: match.team1Id || null,
        team2_id: match.team2Id || null,
        court_id: match.courtId || null,
        status: 'pending' as MatchStatus,
        score: {}
      }))

      const { data, error } = await this.supabase
        .from('matches')
        .insert(matches)
        .select()

      if (error) {
        throw new DatabaseError(`Failed to create round matches: ${error.message}`)
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Get next match number for a round
   */
  async getNextMatchNumber(tournamentId: string, round: number): Promise<Result<number, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('matches')
        .select('match_number')
        .eq('tournament_id', tournamentId)
        .eq('round', round)
        .order('match_number', { ascending: false })
        .limit(1)

      if (error) {
        throw new DatabaseError(`Failed to get next match number: ${error.message}`)
      }

      const maxMatchNumber = data?.[0]?.match_number || 0
      return maxMatchNumber + 1
    })
  }

  /**
   * Cancel all pending matches in a tournament
   */
  async cancelPendingMatches(tournamentId: string): Promise<Result<number, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('tournament_id', tournamentId)
        .eq('status', 'pending')
        .select('id')

      if (error) {
        throw new DatabaseError(`Failed to cancel pending matches: ${error.message}`)
      }

      return data?.length || 0
    })
  }
}