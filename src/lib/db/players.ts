import { BaseDB, DatabaseConfig, RecordNotFoundError } from './base'
import { Player, PlayerFormData, PlayerStats, PlayerPreferences, GameFormat } from '@/types'
import { PlayerSchema, PlayerFormDataSchema } from '@/lib/validation/player'

/**
 * Player-specific database operations
 */
export class PlayerDB extends BaseDB<Player> {
  constructor(config?: Partial<DatabaseConfig>) {
    super(
      'players',
      {
        dataPath: 'data/players',
        ...config
      },
      PlayerSchema
    )
  }

  /**
   * Create a new player from form data
   */
  async create(formData: PlayerFormData): Promise<Player> {
    // Validate form data
    const validatedFormData = PlayerFormDataSchema.parse(formData)
    
    // Check if player with email already exists
    const existingPlayer = await this.findByEmail(validatedFormData.email)
    if (existingPlayer) {
      throw new Error(`Player with email ${validatedFormData.email} already exists`)
    }

    // Convert form data to player entity
    const playerData = {
      ...validatedFormData,
      displayName: `${validatedFormData.firstName} ${validatedFormData.lastName}`,
      phone: validatedFormData.phone || undefined,
      club: validatedFormData.club || undefined,
      ranking: validatedFormData.ranking || undefined,
      handicap: undefined,
      avatar: undefined,
      stats: {
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        winPercentage: 0,
        averagePointsFor: 0,
        averagePointsAgainst: 0,
        pointsDifferential: 0,
        bestFinish: 'N/A',
        recentForm: []
      },
      preferences: {
        preferredFormat: 'doubles' as GameFormat,
        notificationEmail: true,
        notificationPush: true,
        publicProfile: true
      }
    }

    return super.create(playerData)
  }

  /**
   * Find player by email address
   */
  async findByEmail(email: string): Promise<Player | null> {
    const players = await this.findAll({ email: email.toLowerCase() })
    return players.length > 0 ? players[0] : null
  }

  /**
   * Find players by club
   */
  async findByClub(club: string): Promise<Player[]> {
    return this.findAll({ club })
  }

  /**
   * Find players by ranking range
   */
  async findByRankingRange(minRanking: number, maxRanking: number): Promise<Player[]> {
    const players = await this.findAll()
    return players.filter(player => 
      player.ranking && 
      player.ranking >= minRanking && 
      player.ranking <= maxRanking
    )
  }

  /**
   * Find players by preferred format
   */
  async findByPreferredFormat(format: GameFormat): Promise<Player[]> {
    const players = await this.findAll()
    return players.filter(player => player.preferences.preferredFormat === format)
  }

  /**
   * Find players participating in a tournament
   */
  async findByTournament(tournamentId: string): Promise<Player[]> {
    // This would typically query a junction table or tournament-player relationship
    // For now, we'll implement a basic version that could be extended
    const players = await this.findAll()
    
    // This is a placeholder - in a real implementation, you'd check tournament registrations
    // For now, return empty array as tournament-player relationships would be handled separately
    return []
  }

  /**
   * Search players by name (first name, last name, or display name)
   */
  async searchByName(query: string): Promise<Player[]> {
    const players = await this.findAll()
    const lowerQuery = query.toLowerCase()
    
    return players.filter(player => 
      player.firstName.toLowerCase().includes(lowerQuery) ||
      player.lastName.toLowerCase().includes(lowerQuery) ||
      player.displayName.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Update player statistics
   */
  async updateStats(id: string, stats: Partial<PlayerStats>): Promise<Player> {
    const player = await this.findById(id)
    if (!player) {
      throw new RecordNotFoundError(id, this.entityName)
    }

    const updatedStats = {
      ...player.stats,
      ...stats
    }

    // Recalculate win percentage if matches data is updated
    if (stats.matchesPlayed !== undefined || stats.matchesWon !== undefined) {
      const matchesPlayed = stats.matchesPlayed ?? updatedStats.matchesPlayed
      const matchesWon = stats.matchesWon ?? updatedStats.matchesWon
      
      updatedStats.winPercentage = matchesPlayed > 0 
        ? Math.round((matchesWon / matchesPlayed) * 100 * 10) / 10 // Round to 1 decimal
        : 0
    }

    // Update points differential
    if (stats.averagePointsFor !== undefined || stats.averagePointsAgainst !== undefined) {
      const pointsFor = stats.averagePointsFor ?? updatedStats.averagePointsFor
      const pointsAgainst = stats.averagePointsAgainst ?? updatedStats.averagePointsAgainst
      
      updatedStats.pointsDifferential = Math.round((pointsFor - pointsAgainst) * 10) / 10
    }

    return this.update(id, { stats: updatedStats })
  }

  /**
   * Update player preferences
   */
  async updatePreferences(id: string, preferences: Partial<PlayerPreferences>): Promise<Player> {
    const player = await this.findById(id)
    if (!player) {
      throw new RecordNotFoundError(id, this.entityName)
    }

    const updatedPreferences = {
      ...player.preferences,
      ...preferences
    }

    return this.update(id, { preferences: updatedPreferences })
  }

  /**
   * Update player ranking
   */
  async updateRanking(id: string, ranking: number): Promise<Player> {
    if (ranking < 1 || ranking > 10000) {
      throw new Error('Ranking must be between 1 and 10000')
    }

    return this.update(id, { ranking })
  }

  /**
   * Update player handicap
   */
  async updateHandicap(id: string, handicap: number): Promise<Player> {
    if (handicap < -10 || handicap > 10) {
      throw new Error('Handicap must be between -10 and 10')
    }

    return this.update(id, { handicap })
  }

  /**
   * Record match result for player
   */
  async recordMatchResult(
    id: string, 
    won: boolean, 
    pointsFor: number, 
    pointsAgainst: number,
    tournamentWon?: boolean
  ): Promise<Player> {
    const player = await this.findById(id)
    if (!player) {
      throw new RecordNotFoundError(id, this.entityName)
    }

    const newStats = { ...player.stats }
    
    // Update match statistics
    newStats.matchesPlayed += 1
    if (won) {
      newStats.matchesWon += 1
    }

    // Update tournament statistics if provided
    if (tournamentWon !== undefined) {
      if (tournamentWon) {
        newStats.tournamentsWon += 1
      }
      newStats.tournamentsPlayed += 1
    }

    // Recalculate averages
    const totalMatches = newStats.matchesPlayed
    const previousTotalPointsFor = player.stats.averagePointsFor * (totalMatches - 1)
    const previousTotalPointsAgainst = player.stats.averagePointsAgainst * (totalMatches - 1)
    
    newStats.averagePointsFor = Math.round(((previousTotalPointsFor + pointsFor) / totalMatches) * 10) / 10
    newStats.averagePointsAgainst = Math.round(((previousTotalPointsAgainst + pointsAgainst) / totalMatches) * 10) / 10
    newStats.pointsDifferential = Math.round((newStats.averagePointsFor - newStats.averagePointsAgainst) * 10) / 10
    
    // Recalculate win percentage
    newStats.winPercentage = Math.round((newStats.matchesWon / newStats.matchesPlayed) * 100 * 10) / 10

    // Update recent form (last 5 matches)
    const recentForm = [...player.stats.recentForm]
    recentForm.unshift(won ? 1 : 0)
    if (recentForm.length > 5) {
      recentForm.pop()
    }
    newStats.recentForm = recentForm

    return this.updateStats(id, newStats)
  }

  /**
   * Get player rankings (sorted by ranking)
   */
  async getRankings(limit?: number): Promise<Player[]> {
    const players = await this.findAll()
    
    // Filter players with rankings and sort
    const rankedPlayers = players
      .filter(player => player.ranking !== undefined)
      .sort((a, b) => (a.ranking || Infinity) - (b.ranking || Infinity))
    
    return limit ? rankedPlayers.slice(0, limit) : rankedPlayers
  }

  /**
   * Get top players by win percentage
   */
  async getTopPlayersByWinRate(limit: number = 10, minMatches: number = 5): Promise<Player[]> {
    const players = await this.findAll()
    
    return players
      .filter(player => player.stats.matchesPlayed >= minMatches)
      .sort((a, b) => {
        // Primary sort by win percentage
        if (b.stats.winPercentage !== a.stats.winPercentage) {
          return b.stats.winPercentage - a.stats.winPercentage
        }
        // Secondary sort by matches played (more matches = higher rank for same win %)
        return b.stats.matchesPlayed - a.stats.matchesPlayed
      })
      .slice(0, limit)
  }

  /**
   * Get player statistics summary
   */
  async getStatsSummary(): Promise<{
    totalPlayers: number
    activeClubs: string[]
    averageWinPercentage: number
    topWinPercentage: number
    totalMatches: number
    totalTournaments: number
    formatPreferences: Record<GameFormat, number>
  }> {
    const players = await this.findAll()
    
    const summary = {
      totalPlayers: players.length,
      activeClubs: [] as string[],
      averageWinPercentage: 0,
      topWinPercentage: 0,
      totalMatches: 0,
      totalTournaments: 0,
      formatPreferences: {
        singles: 0,
        doubles: 0,
        triples: 0
      } as Record<GameFormat, number>
    }

    if (players.length === 0) return summary

    // Calculate statistics
    let totalWinPercentage = 0
    const clubs = new Set<string>()

    players.forEach(player => {
      // Club tracking
      if (player.club) {
        clubs.add(player.club)
      }

      // Win percentage
      totalWinPercentage += player.stats.winPercentage
      summary.topWinPercentage = Math.max(summary.topWinPercentage, player.stats.winPercentage)

      // Totals
      summary.totalMatches += player.stats.matchesPlayed
      summary.totalTournaments += player.stats.tournamentsPlayed

      // Format preferences
      summary.formatPreferences[player.preferences.preferredFormat]++
    })

    summary.activeClubs = Array.from(clubs).sort()
    summary.averageWinPercentage = Math.round((totalWinPercentage / players.length) * 10) / 10

    return summary
  }

  /**
   * Get players needing ranking updates (no ranking set)
   */
  async getUnrankedPlayers(): Promise<Player[]> {
    const players = await this.findAll()
    return players.filter(player => player.ranking === undefined)
  }

  /**
   * Get inactive players (no recent matches)
   */
  async getInactivePlayers(daysSinceLastMatch: number = 90): Promise<Player[]> {
    // This would typically check last match date from match history
    // For now, we'll use a simple heuristic based on empty recent form
    const players = await this.findAll()
    return players.filter(player => 
      player.stats.recentForm.length === 0 || player.stats.matchesPlayed === 0
    )
  }

  /**
   * Bulk import players from array
   */
  async bulkImport(playersData: PlayerFormData[]): Promise<{
    successful: Player[]
    failed: { data: PlayerFormData; error: string }[]
  }> {
    const result = {
      successful: [] as Player[],
      failed: [] as { data: PlayerFormData; error: string }[]
    }

    for (const playerData of playersData) {
      try {
        const player = await this.create(playerData)
        result.successful.push(player)
      } catch (error) {
        result.failed.push({
          data: playerData,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  /**
   * Merge duplicate players (combine stats and keep most recent)
   */
  async mergePlayers(primaryId: string, duplicateId: string): Promise<Player> {
    const primary = await this.findById(primaryId)
    const duplicate = await this.findById(duplicateId)

    if (!primary || !duplicate) {
      throw new Error('One or both players not found')
    }

    // Merge statistics
    const mergedStats: PlayerStats = {
      tournamentsPlayed: primary.stats.tournamentsPlayed + duplicate.stats.tournamentsPlayed,
      tournamentsWon: primary.stats.tournamentsWon + duplicate.stats.tournamentsWon,
      matchesPlayed: primary.stats.matchesPlayed + duplicate.stats.matchesPlayed,
      matchesWon: primary.stats.matchesWon + duplicate.stats.matchesWon,
      winPercentage: 0, // Will be recalculated
      averagePointsFor: 0, // Will be recalculated
      averagePointsAgainst: 0, // Will be recalculated
      pointsDifferential: 0, // Will be recalculated
      bestFinish: primary.stats.bestFinish, // Keep primary's best finish
      recentForm: [...duplicate.stats.recentForm, ...primary.stats.recentForm].slice(0, 5)
    }

    // Recalculate averages
    if (mergedStats.matchesPlayed > 0) {
      mergedStats.winPercentage = Math.round((mergedStats.matchesWon / mergedStats.matchesPlayed) * 100 * 10) / 10
      
      // For simplicity, average the averages weighted by matches played
      const primaryWeight = primary.stats.matchesPlayed / mergedStats.matchesPlayed
      const duplicateWeight = duplicate.stats.matchesPlayed / mergedStats.matchesPlayed
      
      mergedStats.averagePointsFor = Math.round((
        primary.stats.averagePointsFor * primaryWeight +
        duplicate.stats.averagePointsFor * duplicateWeight
      ) * 10) / 10
      
      mergedStats.averagePointsAgainst = Math.round((
        primary.stats.averagePointsAgainst * primaryWeight +
        duplicate.stats.averagePointsAgainst * duplicateWeight
      ) * 10) / 10
      
      mergedStats.pointsDifferential = Math.round((mergedStats.averagePointsFor - mergedStats.averagePointsAgainst) * 10) / 10
    }

    // Update primary player with merged stats
    const updatedPrimary = await this.update(primaryId, { stats: mergedStats })

    // Archive the duplicate player
    await this.delete(duplicateId)

    return updatedPrimary
  }
}

// Export default instance
export const playerDB = new PlayerDB()

// Export utility functions
export const PlayerUtils = {
  /**
   * Validate player form data
   */
  validateFormData: (data: unknown) => PlayerFormDataSchema.parse(data),

  /**
   * Calculate player performance rating
   */
  calculatePerformanceRating: (player: Player): number => {
    const { stats } = player
    if (stats.matchesPlayed === 0) return 0

    // Simple rating calculation based on win percentage, matches played, and point differential
    const winRating = stats.winPercentage * 0.6
    const experienceRating = Math.min(stats.matchesPlayed / 50, 1) * 20 // Up to 20 points for experience
    const consistencyRating = Math.max(0, stats.pointsDifferential) * 0.2 // Bonus for positive point differential

    return Math.round((winRating + experienceRating + consistencyRating) * 10) / 10
  },

  /**
   * Get player recent form as string
   */
  getRecentFormString: (player: Player): string => {
    if (player.stats.recentForm.length === 0) return 'No recent matches'
    
    return player.stats.recentForm
      .map(result => result === 1 ? 'W' : 'L')
      .join('')
  },

  /**
   * Check if player is active (has recent matches)
   */
  isActivePlayer: (player: Player): boolean => {
    return player.stats.matchesPlayed > 0 && player.stats.recentForm.length > 0
  },

  /**
   * Generate player display summary
   */
  getDisplaySummary: (player: Player): string => {
    const { stats } = player
    const winRate = stats.winPercentage
    const matches = stats.matchesPlayed
    const club = player.club ? ` (${player.club})` : ''
    
    if (matches === 0) {
      return `${player.displayName}${club} - New Player`
    }
    
    return `${player.displayName}${club} - ${winRate}% win rate (${stats.matchesWon}/${matches})`
  }
}