import { SupabaseDB, DatabaseError } from './supabase-base'
import { Team, TeamStatus, TeamType, Result, tryCatch } from '@/types'
import { TeamSchema } from '@/lib/validation/player' // Assuming team schema is in player validation

/**
 * Team-specific Supabase database operations
 */
export class TeamSupabaseDB extends SupabaseDB<Team> {
  constructor() {
    super(
      'teams',
      {
        tableName: 'teams',
        enableRealtime: true
      },
      TeamSchema
    )
  }

  /**
   * Find teams by tournament
   */
  async findByTournament(tournamentId: string): Promise<Result<Team[], DatabaseError>> {
    const filters = { tournament_id: tournamentId }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find teams by status
   */
  async findByStatus(status: TeamStatus | TeamStatus[]): Promise<Result<Team[], DatabaseError>> {
    const filters = {
      status: Array.isArray(status) ? status : [status]
    }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find teams by type
   */
  async findByType(type: TeamType): Promise<Result<Team[], DatabaseError>> {
    const filters = { type }
    return this.findAll(filters, { orderBy: 'name', ascending: true })
  }

  /**
   * Find teams with their members
   */
  async findWithMembers(tournamentId?: string): Promise<Result<any[], DatabaseError>> {
    return tryCatch(async () => {
      let query = this.supabase
        .from('teams')
        .select(`
          *,
          team_members(
            id,
            role,
            joined_at,
            player:players(id, name, email, club, rating)
          )
        `)

      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId)
      }

      query = query.order('name', { ascending: true })

      const { data, error } = await query

      if (error) {
        throw new DatabaseError(`Failed to find teams with members: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Add player to team
   */
  async addPlayer(teamId: string, playerId: string, role: 'player' | 'captain' | 'substitute' = 'player'): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      const { error } = await this.supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          player_id: playerId,
          role
        })

      if (error) {
        throw new DatabaseError(`Failed to add player to team: ${error.message}`)
      }
    })
  }

  /**
   * Remove player from team
   */
  async removePlayer(teamId: string, playerId: string): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      const { error } = await this.supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('player_id', playerId)

      if (error) {
        throw new DatabaseError(`Failed to remove player from team: ${error.message}`)
      }
    })
  }

  /**
   * Update player role in team
   */
  async updatePlayerRole(teamId: string, playerId: string, role: 'player' | 'captain' | 'substitute'): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      const { error } = await this.supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', teamId)
        .eq('player_id', playerId)

      if (error) {
        throw new DatabaseError(`Failed to update player role: ${error.message}`)
      }
    })
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<Result<any[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('team_members')
        .select(`
          id,
          role,
          joined_at,
          player:players(id, name, email, club, rating)
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true })

      if (error) {
        throw new DatabaseError(`Failed to get team members: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Find teams for a specific player
   */
  async findByPlayer(playerId: string): Promise<Result<any[], DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('team_members')
        .select(`
          id,
          role,
          joined_at,
          team:teams(
            id,
            name,
            type,
            status,
            tournament:tournaments(id, name, status)
          )
        `)
        .eq('player_id', playerId)
        .order('joined_at', { ascending: false })

      if (error) {
        throw new DatabaseError(`Failed to find teams by player: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Update team status
   */
  async updateStatus(id: string, status: TeamStatus): Promise<Result<Team, DatabaseError>> {
    return this.update(id, { status })
  }

  /**
   * Set team seed
   */
  async setSeed(id: string, seed: number): Promise<Result<Team, DatabaseError>> {
    return this.update(id, { seed })
  }

  /**
   * Get team statistics
   */
  async getTeamStats(teamId: string): Promise<Result<{
    totalMatches: number
    wins: number
    losses: number
    winPercentage: number
    averageScore: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const { data: matches, error } = await this.supabase
        .from('matches')
        .select('winner_id, team1_id, team2_id, score')
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
        .eq('status', 'completed')

      if (error) {
        throw new DatabaseError(`Failed to get team stats: ${error.message}`)
      }

      let wins = 0
      let losses = 0
      let totalScore = 0
      let scoreCount = 0

      matches?.forEach(match => {
        if (match.winner_id === teamId) {
          wins++
        } else if (match.winner_id) {
          losses++
        }

        // Calculate average score if score data is available
        if (match.score && typeof match.score === 'object') {
          const team1Score = match.score.team1 || 0
          const team2Score = match.score.team2 || 0
          
          if (match.team1_id === teamId) {
            totalScore += team1Score
          } else if (match.team2_id === teamId) {
            totalScore += team2Score
          }
          scoreCount++
        }
      })

      const totalMatches = wins + losses
      const winPercentage = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
      const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0

      return {
        totalMatches,
        wins,
        losses,
        winPercentage,
        averageScore
      }
    })
  }

  /**
   * Get tournament team statistics
   */
  async getTournamentTeamStats(tournamentId: string): Promise<Result<{
    total: number
    registered: number
    checkedIn: number
    active: number
    eliminated: number
    byType: Record<TeamType, number>
  }, DatabaseError>> {
    return tryCatch(async () => {
      const { data, error } = await this.supabase
        .from('teams')
        .select('status, type')
        .eq('tournament_id', tournamentId)

      if (error) {
        throw new DatabaseError(`Failed to get tournament team stats: ${error.message}`)
      }

      const stats = {
        total: data?.length || 0,
        registered: 0,
        checkedIn: 0,
        active: 0,
        eliminated: 0,
        byType: {
          singles: 0,
          doubles: 0,
          triples: 0
        } as Record<TeamType, number>
      }

      data?.forEach(team => {
        // Count by status
        switch (team.status) {
          case 'registered':
            stats.registered++
            break
          case 'checked_in':
            stats.checkedIn++
            break
          case 'active':
            stats.active++
            break
          case 'eliminated':
            stats.eliminated++
            break
        }

        // Count by type
        if (team.type in stats.byType) {
          stats.byType[team.type as TeamType]++
        }
      })

      return stats
    })
  }

  /**
   * Check if team name exists in tournament
   */
  async isNameTaken(tournamentId: string, name: string, excludeTeamId?: string): Promise<Result<boolean, DatabaseError>> {
    return tryCatch(async () => {
      let query = this.supabase
        .from('teams')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('name', name)

      if (excludeTeamId) {
        query = query.neq('id', excludeTeamId)
      }

      const { data, error } = await query

      if (error) {
        throw new DatabaseError(`Failed to check team name: ${error.message}`)
      }

      return (data?.length || 0) > 0
    })
  }

  /**
   * Get available teams for bracket generation
   */
  async findAvailableForBracket(tournamentId: string): Promise<Result<Team[], DatabaseError>> {
    const filters = { 
      tournament_id: tournamentId,
      status: ['checked_in', 'active'] 
    }
    return this.findAll(filters, { orderBy: 'seed', ascending: true })
  }
}