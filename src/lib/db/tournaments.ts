import { BaseDB, DatabaseConfig } from './base'
import { Tournament, TournamentStatus, TournamentType, GameFormat, TournamentFormData, TournamentStats } from '@/types'
import { TournamentSchema, TournamentFormDataSchema } from '@/lib/validation/tournament'

/**
 * Tournament-specific database operations
 */
export class TournamentDB extends BaseDB<Tournament> {
  constructor(config?: Partial<DatabaseConfig>) {
    super(
      'tournaments',
      {
        dataPath: 'data/tournaments/active',
        ...config
      },
      TournamentSchema
    )
  }

  /**
   * Create a new tournament from form data
   */
  async create(formData: TournamentFormData): Promise<Tournament> {
    // Validate form data
    const validatedFormData = TournamentFormDataSchema.parse(formData)
    
    // Convert form data to tournament entity
    const tournamentData = {
      ...validatedFormData,
      status: 'setup' as TournamentStatus,
      currentPlayers: 0,
      endDate: undefined,
      settings: {
        allowLateRegistration: true,
        automaticBracketGeneration: true,
        requireCheckin: true,
        courtAssignmentMode: 'automatic' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true,
        ...validatedFormData.settings
      },
      stats: {
        totalMatches: 0,
        completedMatches: 0,
        averageMatchDuration: 0,
        totalEnds: 0,
        highestScore: 0,
        averageScore: 0
      }
    }

    return super.create(tournamentData)
  }

  /**
   * Find tournaments by status
   */
  async findByStatus(status: TournamentStatus): Promise<Tournament[]> {
    return this.findAll({ status })
  }

  /**
   * Find tournaments by type
   */
  async findByType(type: TournamentType): Promise<Tournament[]> {
    return this.findAll({ type })
  }

  /**
   * Find tournaments by organizer
   */
  async findByOrganizer(organizer: string): Promise<Tournament[]> {
    return this.findAll({ organizer })
  }

  /**
   * Find tournaments by format (singles, doubles, triples)
   */
  async findByFormat(format: GameFormat): Promise<Tournament[]> {
    return this.findAll({ format })
  }

  /**
   * Find active tournaments (status: 'active')
   */
  async findActive(): Promise<Tournament[]> {
    return this.findByStatus('active')
  }

  /**
   * Find completed tournaments
   */
  async findCompleted(): Promise<Tournament[]> {
    // Look in both active and completed directories
    const activeCompleted = await this.findByStatus('completed')
    
    // Also check the completed tournaments directory
    const completedDB = new TournamentDB({ 
      dataPath: 'data/tournaments/completed' 
    })
    const archivedCompleted = await completedDB.findAll()
    
    // Combine and remove duplicates
    const allCompleted = [...activeCompleted, ...archivedCompleted]
    const uniqueCompleted = allCompleted.filter((tournament, index, self) => 
      index === self.findIndex(t => t.id === tournament.id)
    )
    
    return uniqueCompleted
  }

  /**
   * Find upcoming tournaments (status: 'setup' and startDate in the future)
   */
  async findUpcoming(): Promise<Tournament[]> {
    const setupTournaments = await this.findByStatus('setup')
    const now = new Date()
    
    return setupTournaments.filter(tournament => 
      new Date(tournament.startDate) > now
    )
  }

  /**
   * Start a tournament (change status from 'setup' to 'active')
   */
  async startTournament(id: string): Promise<Tournament> {
    const tournament = await this.findById(id)
    if (!tournament) {
      throw new Error(`Tournament with ID ${id} not found`)
    }

    if (tournament.status !== 'setup') {
      throw new Error(`Tournament is not in setup status. Current status: ${tournament.status}`)
    }

    if (tournament.currentPlayers < 4) {
      throw new Error(`Minimum 4 players required to start tournament. Current: ${tournament.currentPlayers}`)
    }

    return this.update(id, { 
      status: 'active',
      startDate: new Date().toISOString() // Update to actual start time
    })
  }

  /**
   * Complete a tournament (change status to 'completed' and move to completed directory)
   */
  async completeTournament(id: string, finalStats?: Partial<TournamentStats>): Promise<Tournament> {
    const tournament = await this.findById(id)
    if (!tournament) {
      throw new Error(`Tournament with ID ${id} not found`)
    }

    if (tournament.status !== 'active') {
      throw new Error(`Tournament is not active. Current status: ${tournament.status}`)
    }

    // Update tournament with final stats and completion
    const updatedTournament = await this.update(id, { 
      status: 'completed',
      endDate: new Date().toISOString(),
      stats: finalStats ? { ...tournament.stats, ...finalStats } : tournament.stats
    })

    // Move to completed tournaments directory
    await this.moveToCompleted(updatedTournament)

    return updatedTournament
  }

  /**
   * Cancel a tournament
   */
  async cancelTournament(id: string): Promise<Tournament> {
    return this.update(id, { 
      status: 'cancelled',
      endDate: new Date().toISOString()
    })
  }

  /**
   * Add a player to tournament
   */
  async addPlayer(tournamentId: string, playerId: string): Promise<Tournament> {
    const tournament = await this.findById(tournamentId)
    if (!tournament) {
      throw new Error(`Tournament with ID ${tournamentId} not found`)
    }

    if (tournament.currentPlayers >= tournament.maxPlayers) {
      throw new Error(`Tournament is full. Maximum players: ${tournament.maxPlayers}`)
    }

    if (tournament.status !== 'setup' && !tournament.settings.allowLateRegistration) {
      throw new Error('Late registration is not allowed for this tournament')
    }

    return this.update(tournamentId, {
      currentPlayers: tournament.currentPlayers + 1
    })
  }

  /**
   * Remove a player from tournament
   */
  async removePlayer(tournamentId: string, playerId: string): Promise<Tournament> {
    const tournament = await this.findById(tournamentId)
    if (!tournament) {
      throw new Error(`Tournament with ID ${tournamentId} not found`)
    }

    if (tournament.currentPlayers === 0) {
      throw new Error('No players to remove from tournament')
    }

    if (tournament.status === 'active') {
      throw new Error('Cannot remove players from active tournament')
    }

    return this.update(tournamentId, {
      currentPlayers: Math.max(0, tournament.currentPlayers - 1)
    })
  }

  /**
   * Update tournament statistics
   */
  async updateStats(id: string, stats: Partial<TournamentStats>): Promise<Tournament> {
    const tournament = await this.findById(id)
    if (!tournament) {
      throw new Error(`Tournament with ID ${id} not found`)
    }

    const updatedStats = {
      ...tournament.stats,
      ...stats
    }

    return this.update(id, { stats: updatedStats })
  }

  /**
   * Get tournament statistics summary
   */
  async getStatsSummary(): Promise<{
    total: number
    byStatus: Record<TournamentStatus, number>
    byType: Record<TournamentType, number>
    byFormat: Record<GameFormat, number>
    totalPlayers: number
    averagePlayersPerTournament: number
  }> {
    const tournaments = await this.findAll()
    
    const summary = {
      total: tournaments.length,
      byStatus: {} as Record<TournamentStatus, number>,
      byType: {} as Record<TournamentType, number>,
      byFormat: {} as Record<GameFormat, number>,
      totalPlayers: 0,
      averagePlayersPerTournament: 0
    }

    tournaments.forEach(tournament => {
      // Count by status
      summary.byStatus[tournament.status] = (summary.byStatus[tournament.status] || 0) + 1
      
      // Count by type
      summary.byType[tournament.type] = (summary.byType[tournament.type] || 0) + 1
      
      // Count by format
      summary.byFormat[tournament.format] = (summary.byFormat[tournament.format] || 0) + 1
      
      // Total players
      summary.totalPlayers += tournament.currentPlayers
    })

    // Calculate average
    summary.averagePlayersPerTournament = tournaments.length > 0 
      ? summary.totalPlayers / tournaments.length 
      : 0

    return summary
  }

  /**
   * Search tournaments by name or description
   */
  async search(query: string): Promise<Tournament[]> {
    const tournaments = await this.findAll()
    const lowerQuery = query.toLowerCase()
    
    return tournaments.filter(tournament => 
      tournament.name.toLowerCase().includes(lowerQuery) ||
      (tournament.description && tournament.description.toLowerCase().includes(lowerQuery)) ||
      tournament.organizer.toLowerCase().includes(lowerQuery) ||
      (tournament.location && tournament.location.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Get tournaments in date range
   */
  async findInDateRange(startDate: Date, endDate: Date): Promise<Tournament[]> {
    const tournaments = await this.findAll()
    
    return tournaments.filter(tournament => {
      const tournamentStart = new Date(tournament.startDate)
      const tournamentEnd = tournament.endDate ? new Date(tournament.endDate) : null
      
      // Tournament starts within range or is ongoing during the range
      return (
        (tournamentStart >= startDate && tournamentStart <= endDate) ||
        (tournamentEnd && tournamentEnd >= startDate && tournamentEnd <= endDate) ||
        (tournamentStart <= startDate && (!tournamentEnd || tournamentEnd >= endDate))
      )
    })
  }

  /**
   * Create tournament from template
   */
  async createFromTemplate(templateId: string, overrides: Partial<TournamentFormData>): Promise<Tournament> {
    // Load template from templates directory
    const templateDB = new TournamentDB({ 
      dataPath: 'data/tournaments/templates' 
    })
    
    const template = await templateDB.findById(templateId)
    if (!template) {
      throw new Error(`Tournament template with ID ${templateId} not found`)
    }

    // Create tournament data from template with overrides
    const tournamentData: TournamentFormData = {
      name: overrides.name || `${template.name} - ${new Date().toLocaleDateString()}`,
      type: overrides.type || template.type,
      format: overrides.format || template.format,
      maxPoints: overrides.maxPoints || template.maxPoints,
      shortForm: overrides.shortForm || template.shortForm,
      startDate: overrides.startDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default to next week
      description: overrides.description || template.description,
      location: overrides.location || template.location,
      organizer: overrides.organizer || template.organizer,
      maxPlayers: overrides.maxPlayers || template.maxPlayers,
      settings: { ...template.settings, ...overrides.settings }
    }

    return this.create(tournamentData)
  }

  // Private helper methods

  /**
   * Move completed tournament to completed directory
   */
  private async moveToCompleted(tournament: Tournament): Promise<void> {
    try {
      const completedDB = new TournamentDB({ 
        dataPath: 'data/tournaments/completed' 
      })
      
      // Save to completed directory
      await completedDB.writeFile(
        completedDB.getFilePath(tournament.id),
        tournament
      )
      
      // Remove from active directory
      const activeFilePath = this.getFilePath(tournament.id)
      if (await this.fileExists(activeFilePath)) {
        await this.delete(tournament.id)
      }
    } catch (error) {
      console.warn(`Failed to move tournament ${tournament.id} to completed directory:`, error)
      // Don't throw error as the tournament is already updated
    }
  }
}

// Export default instance
export const tournamentDB = new TournamentDB()

// Export utility functions
export const TournamentUtils = {
  /**
   * Validate tournament form data
   */
  validateFormData: (data: unknown) => TournamentFormDataSchema.parse(data),

  /**
   * Check if tournament can be started
   */
  canStart: (tournament: Tournament): { canStart: boolean; reason?: string } => {
    if (tournament.status !== 'setup') {
      return { canStart: false, reason: `Tournament is not in setup status (current: ${tournament.status})` }
    }
    
    if (tournament.currentPlayers < 4) {
      return { canStart: false, reason: `Minimum 4 players required (current: ${tournament.currentPlayers})` }
    }
    
    return { canStart: true }
  },

  /**
   * Check if tournament can accept more players
   */
  canAddPlayer: (tournament: Tournament): { canAdd: boolean; reason?: string } => {
    if (tournament.currentPlayers >= tournament.maxPlayers) {
      return { canAdd: false, reason: 'Tournament is full' }
    }
    
    if (tournament.status !== 'setup' && !tournament.settings.allowLateRegistration) {
      return { canAdd: false, reason: 'Late registration not allowed' }
    }
    
    if (tournament.status === 'completed' || tournament.status === 'cancelled') {
      return { canAdd: false, reason: 'Tournament is finished' }
    }
    
    return { canAdd: true }
  },

  /**
   * Calculate tournament progress percentage
   */
  getProgress: (tournament: Tournament): number => {
    if (tournament.stats.totalMatches === 0) return 0
    return Math.round((tournament.stats.completedMatches / tournament.stats.totalMatches) * 100)
  },

  /**
   * Get tournament duration in hours
   */
  getDuration: (tournament: Tournament): number | null => {
    if (!tournament.endDate) return null
    
    const start = new Date(tournament.startDate)
    const end = new Date(tournament.endDate)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60))
  }
}