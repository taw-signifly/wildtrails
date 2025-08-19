import { BaseDB, DatabaseConfig, DatabaseError } from './base'
import { Tournament, TournamentStatus, TournamentType, GameFormat, TournamentFormData, TournamentStats, Result, tryCatch } from '@/types'
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
  async create(formData: TournamentFormData): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
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

      const result = await super.create(tournamentData)
      if (result.error) {
        throw result.error
      }
      return result.data
    })
  }

  /**
   * Find tournaments by status
   */
  async findByStatus(status: TournamentStatus): Promise<Result<Tournament[], DatabaseError>> {
    return this.findAll({ status })
  }

  /**
   * Find tournaments by type
   */
  async findByType(type: TournamentType): Promise<Result<Tournament[], DatabaseError>> {
    return this.findAll({ type })
  }

  /**
   * Find tournaments by organizer
   */
  async findByOrganizer(organizer: string): Promise<Result<Tournament[], DatabaseError>> {
    return this.findAll({ organizer })
  }

  /**
   * Find tournaments by format (singles, doubles, triples)
   */
  async findByFormat(format: GameFormat): Promise<Result<Tournament[], DatabaseError>> {
    return this.findAll({ format })
  }

  /**
   * Find active tournaments (status: 'active')
   */
  async findActive(): Promise<Result<Tournament[], DatabaseError>> {
    return this.findByStatus('active')
  }

  /**
   * Find completed tournaments
   */
  async findCompleted(): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      // Look in both active and completed directories
      const activeCompletedResult = await this.findByStatus('completed')
      if (activeCompletedResult.error) {
        throw activeCompletedResult.error
      }
      const activeCompleted = activeCompletedResult.data
      
      // Also check the completed tournaments directory
      const completedDB = new TournamentDB({ 
        dataPath: 'data/tournaments/completed' 
      })
      const archivedCompletedResult = await completedDB.findAll()
      if (archivedCompletedResult.error) {
        throw archivedCompletedResult.error
      }
      const archivedCompleted = archivedCompletedResult.data
      
      // Combine and remove duplicates
      const allCompleted = [...activeCompleted, ...archivedCompleted]
      const uniqueCompleted = allCompleted.filter((tournament, index, self) => 
        index === self.findIndex(t => t.id === tournament.id)
      )
      
      return uniqueCompleted
    })
  }

  /**
   * Find upcoming tournaments (status: 'setup' and startDate in the future)
   */
  async findUpcoming(): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const setupTournamentsResult = await this.findByStatus('setup')
      if (setupTournamentsResult.error) {
        throw setupTournamentsResult.error
      }
      const setupTournaments = setupTournamentsResult.data
      const now = new Date()
      
      return setupTournaments.filter(tournament => 
        new Date(tournament.startDate) > now
      )
    })
  }

  /**
   * Start a tournament (change status from 'setup' to 'active')
   */
  async startTournament(id: string): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentResult = await this.findById(id)
      if (tournamentResult.error) {
        throw tournamentResult.error
      }
      
      if (!tournamentResult.data) {
        throw new DatabaseError(`Tournament with ID ${id} not found`)
      }

      const tournament = tournamentResult.data
      if (tournament.status !== 'setup') {
        throw new DatabaseError(`Tournament is not in setup status. Current status: ${tournament.status}`)
      }

      if (tournament.currentPlayers < 4) {
        throw new DatabaseError(`Minimum 4 players required to start tournament. Current: ${tournament.currentPlayers}`)
      }

      const updateResult = await this.update(id, { 
        status: 'active',
        startDate: new Date().toISOString() // Update to actual start time
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Complete a tournament (change status to 'completed' and move to completed directory)
   */
  async completeTournament(id: string, finalStats?: Partial<TournamentStats>): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentResult = await this.findById(id)
      if (tournamentResult.error) {
        throw tournamentResult.error
      }
      
      if (!tournamentResult.data) {
        throw new DatabaseError(`Tournament with ID ${id} not found`)
      }

      const tournament = tournamentResult.data
      if (tournament.status !== 'active') {
        throw new DatabaseError(`Tournament is not active. Current status: ${tournament.status}`)
      }

      // Update tournament with final stats and completion
      const updateResult = await this.update(id, { 
        status: 'completed',
        endDate: new Date().toISOString(),
        stats: finalStats ? { ...tournament.stats, ...finalStats } : tournament.stats
      })

      if (updateResult.error) {
        throw updateResult.error
      }

      const updatedTournament = updateResult.data

      // Move to completed tournaments directory
      await this.moveToCompleted(updatedTournament)

      return updatedTournament
    })
  }

  /**
   * Cancel a tournament
   */
  async cancelTournament(id: string): Promise<Result<Tournament, DatabaseError>> {
    return this.update(id, { 
      status: 'cancelled',
      endDate: new Date().toISOString()
    })
  }

  /**
   * Add a player to tournament
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addPlayer(tournamentId: string, _playerId: string): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentResult = await this.findById(tournamentId)
      if (tournamentResult.error) {
        throw tournamentResult.error
      }
      
      if (!tournamentResult.data) {
        throw new DatabaseError(`Tournament with ID ${tournamentId} not found`)
      }

      const tournament = tournamentResult.data
      if (tournament.currentPlayers >= tournament.maxPlayers) {
        throw new DatabaseError(`Tournament is full. Maximum players: ${tournament.maxPlayers}`)
      }

      if (tournament.status !== 'setup' && !tournament.settings.allowLateRegistration) {
        throw new DatabaseError('Late registration is not allowed for this tournament')
      }

      const updateResult = await this.update(tournamentId, {
        currentPlayers: tournament.currentPlayers + 1
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Remove a player from tournament
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async removePlayer(tournamentId: string, _playerId: string): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentResult = await this.findById(tournamentId)
      if (tournamentResult.error) {
        throw tournamentResult.error
      }
      
      if (!tournamentResult.data) {
        throw new DatabaseError(`Tournament with ID ${tournamentId} not found`)
      }

      const tournament = tournamentResult.data
      if (tournament.currentPlayers === 0) {
        throw new DatabaseError('No players to remove from tournament')
      }

      if (tournament.status === 'active') {
        throw new DatabaseError('Cannot remove players from active tournament')
      }

      const updateResult = await this.update(tournamentId, {
        currentPlayers: Math.max(0, tournament.currentPlayers - 1)
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Update tournament statistics
   */
  async updateStats(id: string, stats: Partial<TournamentStats>): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentResult = await this.findById(id)
      if (tournamentResult.error) {
        throw tournamentResult.error
      }
      
      if (!tournamentResult.data) {
        throw new DatabaseError(`Tournament with ID ${id} not found`)
      }

      const tournament = tournamentResult.data
      const updatedStats = {
        ...tournament.stats,
        ...stats
      }

      const updateResult = await this.update(id, { stats: updatedStats })
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Get tournament statistics summary
   */
  async getStatsSummary(): Promise<Result<{
    total: number
    byStatus: Record<TournamentStatus, number>
    byType: Record<TournamentType, number>
    byFormat: Record<GameFormat, number>
    totalPlayers: number
    averagePlayersPerTournament: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const tournamentsResult = await this.findAll()
      if (tournamentsResult.error) {
        throw tournamentsResult.error
      }
      const tournaments = tournamentsResult.data
      
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
    })
  }

  /**
   * Search tournaments by name or description
   */
  async search(query: string): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const tournamentsResult = await this.findAll()
      if (tournamentsResult.error) {
        throw tournamentsResult.error
      }
      const tournaments = tournamentsResult.data
      const lowerQuery = query.toLowerCase()
      
      return tournaments.filter(tournament => 
        tournament.name.toLowerCase().includes(lowerQuery) ||
        (tournament.description && tournament.description.toLowerCase().includes(lowerQuery)) ||
        tournament.organizer.toLowerCase().includes(lowerQuery) ||
        (tournament.location && tournament.location.toLowerCase().includes(lowerQuery))
      )
    })
  }

  /**
   * Get tournaments in date range
   */
  async findInDateRange(startDate: Date, endDate: Date): Promise<Result<Tournament[], DatabaseError>> {
    return tryCatch(async () => {
      const tournamentsResult = await this.findAll()
      if (tournamentsResult.error) {
        throw tournamentsResult.error
      }
      const tournaments = tournamentsResult.data
      
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
    })
  }

  /**
   * Create tournament from template
   */
  async createFromTemplate(templateId: string, overrides: Partial<TournamentFormData>): Promise<Result<Tournament, DatabaseError>> {
    return tryCatch(async () => {
      // Load template from templates directory
      const templateDB = new TournamentDB({ 
        dataPath: 'data/tournaments/templates' 
      })
      
      const templateResult = await templateDB.findById(templateId)
      if (templateResult.error) {
        throw templateResult.error
      }
      
      if (!templateResult.data) {
        throw new DatabaseError(`Tournament template with ID ${templateId} not found`)
      }

      const template = templateResult.data

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

      const createResult = await this.create(tournamentData)
      if (createResult.error) {
        throw createResult.error
      }
      
      return createResult.data
    })
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
      const errorMsg = `Failed to move tournament ${tournament.id} to completed directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.warn(errorMsg, error)
      // Don't throw error as the tournament is already updated - this is just an organizational operation
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