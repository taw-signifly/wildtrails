import { BaseDB, DatabaseConfig, RecordNotFoundError, DatabaseError } from './base'
import { Team, TeamStats, GameFormat, Result, tryCatch, Player } from '@/types'
import { TeamSchema, TeamFormDataSchema, TeamFormData } from '@/lib/validation/player'
import { playerDB } from './players'

/**
 * Team-specific database operations
 */
export class TeamDB extends BaseDB<Team> {
  constructor(config?: Partial<DatabaseConfig>) {
    super(
      'teams',
      {
        dataPath: 'data/teams',
        ...config
      },
      TeamSchema
    )
  }

  /**
   * Create a new team from form data
   */
  async createFromFormData(formData: TeamFormData): Promise<Result<Team, DatabaseError>> {
    return tryCatch(async () => {
      // Validate form data
      const validatedFormData = TeamFormDataSchema.parse(formData)
      
      // Check if team name is unique within tournament
      const existingTeamResult = await this.findByNameAndTournament(
        validatedFormData.name, 
        validatedFormData.tournamentId
      )
      
      if (existingTeamResult.error) {
        throw existingTeamResult.error
      }
      
      if (existingTeamResult.data) {
        throw new Error(`Team with name '${validatedFormData.name}' already exists in this tournament`)
      }

      // Validate players exist and get their data
      const playerData: Player[] = []
      for (const playerId of validatedFormData.players) {
        const playerResult = await playerDB.findById(playerId)
        if (playerResult.error) {
          throw new Error(`Player with ID '${playerId}' not found`)
        }
        if (!playerResult.data) {
          throw new Error(`Player with ID '${playerId}' not found`)
        }
        playerData.push(playerResult.data)
      }

      // Validate team format against number of players
      if (playerData.length < 1 || playerData.length > 3) {
        throw new Error('Team must have between 1 and 3 players')
      }

      // Convert form data to team entity
      const teamData = {
        name: validatedFormData.name,
        players: playerData,
        tournamentId: validatedFormData.tournamentId,
        seed: undefined,
        bracketType: 'winner' as const,
        stats: {
          matchesPlayed: 0,
          matchesWon: 0,
          setsWon: 0,
          setsLost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDifferential: 0,
          averagePointsDifferential: 0,
          currentStreak: 0,
          longestStreak: 0
        } as TeamStats
      }

      const result = await super.create(teamData)
      if (result.error) {
        throw result.error
      }
      return result.data
    })
  }

  /**
   * Create team with full team data (overrides BaseDB create)
   */
  async create(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Team, DatabaseError>> {
    return super.create(data)
  }

  /**
   * Find team by name and tournament
   */
  async findByNameAndTournament(name: string, tournamentId: string): Promise<Result<Team | null, Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findAll({ name, tournamentId })
      if (teamsResult.error) {
        throw teamsResult.error
      }
      return teamsResult.data.length > 0 ? teamsResult.data[0] : null
    })
  }

  /**
   * Find teams by tournament
   */
  async findByTournament(tournamentId: string): Promise<Result<Team[], Error>> {
    return this.findAll({ tournamentId })
  }

  /**
   * Find teams containing a specific player
   */
  async findByPlayer(playerId: string): Promise<Result<Team[], Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findAll()
      if (teamsResult.error) {
        throw teamsResult.error
      }
      
      return teamsResult.data.filter(team => 
        team.players.some(player => player.id === playerId)
      )
    })
  }

  /**
   * Find teams by bracket type
   */
  async findByBracketType(tournamentId: string, bracketType: Team['bracketType']): Promise<Result<Team[], Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findByTournament(tournamentId)
      if (teamsResult.error) {
        throw teamsResult.error
      }
      
      return teamsResult.data.filter(team => team.bracketType === bracketType)
    })
  }

  /**
   * Add player to team
   */
  async addPlayer(teamId: string, playerId: string): Promise<Result<Team, Error>> {
    return tryCatch(async () => {
      const teamResult = await this.findById(teamId)
      if (teamResult.error) {
        throw teamResult.error
      }
      
      if (!teamResult.data) {
        throw new RecordNotFoundError(teamId, this.entityName)
      }

      const team = teamResult.data
      
      // Check if player is already in team
      if (team.players.some(p => p.id === playerId)) {
        throw new Error('Player is already in this team')
      }

      // Check team size limit (max 3 players)
      if (team.players.length >= 3) {
        throw new Error('Team cannot have more than 3 players')
      }

      // Get player data
      const playerResult = await playerDB.findById(playerId)
      if (playerResult.error) {
        throw new Error(`Player with ID '${playerId}' not found`)
      }
      if (!playerResult.data) {
        throw new Error(`Player with ID '${playerId}' not found`)
      }

      // Add player to team
      const updatedPlayers = [...team.players, playerResult.data]
      
      const updateResult = await this.update(teamId, { players: updatedPlayers })
      if (updateResult.error) {
        throw updateResult.error
      }
      return updateResult.data
    })
  }

  /**
   * Remove player from team
   */
  async removePlayer(teamId: string, playerId: string): Promise<Result<Team, Error>> {
    return tryCatch(async () => {
      const teamResult = await this.findById(teamId)
      if (teamResult.error) {
        throw teamResult.error
      }
      
      if (!teamResult.data) {
        throw new RecordNotFoundError(teamId, this.entityName)
      }

      const team = teamResult.data
      
      // Check if player is in team
      if (!team.players.some(p => p.id === playerId)) {
        throw new Error('Player is not in this team')
      }

      // Check minimum team size (min 1 player)
      if (team.players.length <= 1) {
        throw new Error('Team must have at least 1 player')
      }

      // Remove player from team
      const updatedPlayers = team.players.filter(p => p.id !== playerId)
      
      const updateResult = await this.update(teamId, { players: updatedPlayers })
      if (updateResult.error) {
        throw updateResult.error
      }
      return updateResult.data
    })
  }

  /**
   * Validate team formation for tournament format
   */
  async validateTeamFormation(playerIds: string[], format: GameFormat): Promise<Result<boolean, Error>> {
    return tryCatch(async () => {
      // Check player count matches format
      const expectedPlayerCount = format === 'singles' ? 1 : format === 'doubles' ? 2 : 3
      
      if (playerIds.length !== expectedPlayerCount) {
        throw new Error(`${format} format requires exactly ${expectedPlayerCount} player(s)`)
      }

      // Check all players exist
      for (const playerId of playerIds) {
        const playerResult = await playerDB.findById(playerId)
        if (playerResult.error || !playerResult.data) {
          throw new Error(`Player with ID '${playerId}' not found`)
        }
      }

      return true
    })
  }

  /**
   * Update team statistics
   */
  async updateStats(id: string, stats: Partial<TeamStats>): Promise<Result<Team, Error>> {
    return tryCatch(async () => {
      const teamResult = await this.findById(id)
      if (teamResult.error) {
        throw teamResult.error
      }
      
      if (!teamResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const team = teamResult.data
      const updatedStats = {
        ...team.stats,
        ...stats
      }

      // Recalculate derived statistics
      if (stats.pointsFor !== undefined || stats.pointsAgainst !== undefined) {
        const pointsFor = stats.pointsFor ?? updatedStats.pointsFor
        const pointsAgainst = stats.pointsAgainst ?? updatedStats.pointsAgainst
        
        updatedStats.pointsDifferential = pointsFor - pointsAgainst
        
        if (updatedStats.matchesPlayed > 0) {
          updatedStats.averagePointsDifferential = 
            Math.round((updatedStats.pointsDifferential / updatedStats.matchesPlayed) * 10) / 10
        }
      }

      const updateResult = await this.update(id, { stats: updatedStats })
      if (updateResult.error) {
        throw updateResult.error
      }
      return updateResult.data
    })
  }

  /**
   * Record match result for team
   */
  async recordMatchResult(
    id: string,
    won: boolean,
    pointsFor: number,
    pointsAgainst: number,
    setsWon?: number,
    setsLost?: number
  ): Promise<Result<Team, Error>> {
    return tryCatch(async () => {
      const teamResult = await this.findById(id)
      if (teamResult.error) {
        throw teamResult.error
      }
      
      if (!teamResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const team = teamResult.data
      const newStats = { ...team.stats }
      
      // Update match statistics
      newStats.matchesPlayed += 1
      if (won) {
        newStats.matchesWon += 1
      }

      // Update set statistics if provided
      if (setsWon !== undefined) {
        newStats.setsWon += setsWon
      }
      if (setsLost !== undefined) {
        newStats.setsLost += setsLost
      }

      // Update point statistics
      newStats.pointsFor += pointsFor
      newStats.pointsAgainst += pointsAgainst
      newStats.pointsDifferential = newStats.pointsFor - newStats.pointsAgainst
      newStats.averagePointsDifferential = Math.round((newStats.pointsDifferential / newStats.matchesPlayed) * 10) / 10

      // Update streak statistics
      if (won) {
        newStats.currentStreak = newStats.currentStreak >= 0 ? newStats.currentStreak + 1 : 1
      } else {
        newStats.currentStreak = newStats.currentStreak <= 0 ? newStats.currentStreak - 1 : -1
      }
      
      newStats.longestStreak = Math.max(newStats.longestStreak, Math.abs(newStats.currentStreak))

      const updateResult = await this.updateStats(id, newStats)
      if (updateResult.error) {
        throw updateResult.error
      }
      return updateResult.data
    })
  }

  /**
   * Get team standings for tournament
   */
  async getStandings(tournamentId: string): Promise<Result<Team[], Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findByTournament(tournamentId)
      if (teamsResult.error) {
        throw teamsResult.error
      }
      
      const teams = teamsResult.data
      
      // Sort by wins descending, then by points differential descending
      return teams.sort((a, b) => {
        // Primary sort: matches won
        if (b.stats.matchesWon !== a.stats.matchesWon) {
          return b.stats.matchesWon - a.stats.matchesWon
        }
        
        // Secondary sort: points differential
        if (b.stats.pointsDifferential !== a.stats.pointsDifferential) {
          return b.stats.pointsDifferential - a.stats.pointsDifferential
        }
        
        // Tertiary sort: points for
        return b.stats.pointsFor - a.stats.pointsFor
      })
    })
  }

  /**
   * Search teams by name
   */
  async searchByName(query: string): Promise<Result<Team[], Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findAll()
      if (teamsResult.error) {
        throw teamsResult.error
      }
      
      const teams = teamsResult.data
      const lowerQuery = query.toLowerCase()
      
      return teams.filter(team => 
        team.name.toLowerCase().includes(lowerQuery)
      )
    })
  }

  /**
   * Check if player can join team (no duplicate memberships in same tournament)
   */
  async canPlayerJoinTeam(playerId: string, tournamentId: string): Promise<Result<boolean, Error>> {
    return tryCatch(async () => {
      const teamsResult = await this.findByTournament(tournamentId)
      if (teamsResult.error) {
        throw teamsResult.error
      }
      
      const teams = teamsResult.data
      
      // Check if player is already in a team for this tournament
      const playerInTeam = teams.some(team => 
        team.players.some(player => player.id === playerId)
      )
      
      return !playerInTeam
    })
  }
}

// Export default instance
export const teamDB = new TeamDB()

// Export utility functions
export const TeamUtils = {
  /**
   * Validate team form data
   */
  validateFormData: (data: unknown) => TeamFormDataSchema.parse(data),

  /**
   * Get team display name with player count
   */
  getDisplayName: (team: Team): string => {
    const playerCount = team.players.length
    const formatSuffix = playerCount === 1 ? '(Singles)' : playerCount === 2 ? '(Doubles)' : '(Triples)'
    return `${team.name} ${formatSuffix}`
  },

  /**
   * Calculate team rating based on performance
   */
  calculateTeamRating: (team: Team): number => {
    const { stats } = team
    if (stats.matchesPlayed === 0) return 0

    // Simple rating calculation
    const winRate = (stats.matchesWon / stats.matchesPlayed) * 100
    const avgPointsDiff = stats.averagePointsDifferential
    const experienceBonus = Math.min(stats.matchesPlayed / 10, 5) // Up to 5 points

    return Math.round((winRate + avgPointsDiff + experienceBonus) * 10) / 10
  },

  /**
   * Get team format based on player count
   */
  getTeamFormat: (team: Team): GameFormat => {
    const playerCount = team.players.length
    return playerCount === 1 ? 'singles' : playerCount === 2 ? 'doubles' : 'triples'
  },

  /**
   * Check if team is complete for format
   */
  isTeamComplete: (team: Team, requiredFormat: GameFormat): boolean => {
    const expectedPlayerCount = requiredFormat === 'singles' ? 1 : requiredFormat === 'doubles' ? 2 : 3
    return team.players.length === expectedPlayerCount
  }
}