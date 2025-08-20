import { SupabaseDB, DatabaseError } from './supabase-base'
import { Player, Result, tryCatch } from '@/types'
import { PlayerSchema } from '@/lib/validation/player'

/**
 * Player-specific Supabase database operations
 */
export class PlayerSupabaseDB extends SupabaseDB<Player> {
  constructor() {
    super(
      'players',
      {
        tableName: 'players',
        enableRealtime: true
      },
      PlayerSchema
    )
  }

  /**
   * Find players by name (fuzzy search)
   */
  async findByName(name: string): Promise<Result<Player[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .ilike('name', `%${name}%`)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find players by name: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Find players by club
   */
  async findByClub(club: string): Promise<Result<Player[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('club', club)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to find players by club: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Find players by email
   */
  async findByEmail(email: string): Promise<Result<Player | null, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error) {
        // Handle "not found" case specifically
        if (error.code === 'PGRST116') {
          return null
        }
        throw new DatabaseError(`Failed to find player by email: ${error.message}`, new Error(error.message))
      }

      return data ? this.validateData(data) : null
    })
  }

  /**
   * Get all active players
   */
  async findActive(): Promise<Result<Player[], DatabaseError>> {
    const filters = { is_active: true }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Search players by multiple criteria
   */
  async search(query: string): Promise<Result<Player[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,club.ilike.%${query}%`)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to search players: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Get players with rating in range
   */
  async findByRatingRange(minRating: number, maxRating: number): Promise<Result<Player[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .gte('rating', minRating)
        .lte('rating', maxRating)
        .eq('is_active', true)
        .order('rating', { ascending: false })

      if (error) {
        throw new DatabaseError(`Failed to find players by rating range: ${error.message}`, new Error(error.message))
      }

      return (data || []).map(record => this.validateData(record))
    })
  }

  /**
   * Deactivate a player (soft delete)
   */
  async deactivate(id: string): Promise<Result<Player, DatabaseError>> {
    return this.update(id, { is_active: false })
  }

  /**
   * Reactivate a player
   */
  async reactivate(id: string): Promise<Result<Player, DatabaseError>> {
    return this.update(id, { is_active: true })
  }

  /**
   * Get player statistics for tournaments
   */
  async getPlayerStats(playerId: string): Promise<Result<{
    totalTournaments: number
    totalMatches: number
    wins: number
    losses: number
    winPercentage: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      // Get tournaments where player participated
      const { data: teamMembers, error: teamError } = await this.supabase
        .from('team_members')
        .select('team_id, teams(tournament_id)')
        .eq('player_id', playerId)

      if (teamError) {
        throw new DatabaseError(`Failed to get player tournament stats: ${teamError.message}`)
      }

      const tournamentIds = [...new Set(teamMembers?.map(tm => (tm.teams as any)?.tournament_id).filter(Boolean) || [])]

      // Get match statistics
      const { data: matches, error: matchError } = await this.supabase
        .from('matches')
        .select('winner_id, team1_id, team2_id, teams!team1_id(id), teams!team2_id(id)')
        .in('tournament_id', tournamentIds)
        .eq('status', 'completed')

      if (matchError) {
        throw new DatabaseError(`Failed to get player match stats: ${matchError.message}`)
      }

      // Calculate wins/losses for player's teams
      const playerTeamIds = teamMembers?.map(tm => tm.team_id) || []
      let wins = 0
      let losses = 0

      matches?.forEach(match => {
        const isTeam1 = playerTeamIds.includes(match.team1_id)
        const isTeam2 = playerTeamIds.includes(match.team2_id)
        
        if (isTeam1 || isTeam2) {
          if (match.winner_id && playerTeamIds.includes(match.winner_id)) {
            wins++
          } else if (match.winner_id) {
            losses++
          }
        }
      })

      const totalMatches = wins + losses
      const winPercentage = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

      return {
        totalTournaments: tournamentIds.length,
        totalMatches,
        wins,
        losses,
        winPercentage
      }
    })
  }

  /**
   * Get players with pagination
   */
  async findPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string
      club?: string
      ratingRange?: { min: number; max: number }
      activeOnly?: boolean
    }
  ): Promise<Result<{ players: Player[], total: number, hasMore: boolean }, DatabaseError>> {
    return tryCatch(async () => {
      const offset = (page - 1) * limit

      let query = this.supabase.from('players').select('*', { count: 'exact' })

      // Apply filters
      if (filters?.activeOnly !== false) {
        query = query.eq('is_active', true)
      }

      if (filters?.club) {
        query = query.eq('club', filters.club)
      }

      if (filters?.ratingRange) {
        query = query.gte('rating', filters.ratingRange.min).lte('rating', filters.ratingRange.max)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,club.ilike.%${filters.search}%`)
      }

      // Apply pagination and ordering
      query = query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        throw new DatabaseError(`Failed to find paginated players: ${error.message}`, new Error(error.message))
      }

      const players = (data || []).map(record => this.validateData(record))
      const total = count || 0
      const hasMore = offset + limit < total

      return {
        players,
        total,
        hasMore
      }
    })
  }
}