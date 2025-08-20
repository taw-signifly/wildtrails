import { BaseDB, DatabaseConfig, RecordNotFoundError, DatabaseError } from './base'
import { Match, MatchStatus, Score, End, BracketType, Team, Result, tryCatch } from '@/types'
import { MatchSchema, MatchFormDataSchema, ScoreSchema, EndSchema } from '@/lib/validation/match'

/**
 * Match-specific database operations
 */
export class MatchDB extends BaseDB<any> {
  constructor(config?: Partial<DatabaseConfig>) {
    super(
      'matches',
      {
        dataPath: 'data/matches',
        ...config
      },
      MatchSchema
    )
  }

  /**
   * Create a new match
   */
  async create(matchData: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      // Initialize default match data
      const fullMatchData = {
        ...matchData,
        status: 'scheduled' as MatchStatus,
        score: {
          team1: 0,
          team2: 0,
          isComplete: false
        },
        ends: [],
        duration: undefined,
        winner: undefined,
        startTime: undefined,
        endTime: undefined
      }

      const result = await super.create(fullMatchData)
      if (result.error) {
        throw result.error
      }
      return result.data
    })
  }

  /**
   * Find matches by tournament
   */
  async findByTournament(tournamentId: string): Promise<Result<Match[], DatabaseError>> {
    return this.findAll({ tournamentId })
  }

  /**
   * Find matches by player
   */
  async findByPlayer(playerId: string): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const matchesResult = await this.findAll()
      if (matchesResult.error) {
        throw matchesResult.error
      }
      const matches = matchesResult.data
      return matches.filter(match => 
        match.team1.players.some((p: any) => p.id === playerId) ||
        match.team2.players.some((p: any) => p.id === playerId)
      )
    })
  }

  /**
   * Find matches by team
   */
  async findByTeam(teamId: string): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const matchesResult = await this.findAll()
      if (matchesResult.error) {
        throw matchesResult.error
      }
      const matches = matchesResult.data
      return matches.filter(match => 
        match.team1.id === teamId || match.team2.id === teamId
      )
    })
  }

  /**
   * Find matches by status
   */
  async findByStatus(status: MatchStatus): Promise<Result<Match[], DatabaseError>> {
    return this.findAll({ status })
  }

  /**
   * Find matches by round
   */
  async findByRound(tournamentId: string, round: number): Promise<Result<Match[], DatabaseError>> {
    return this.findAll({ tournamentId, round })
  }

  /**
   * Find matches by bracket type
   */
  async findByBracketType(tournamentId: string, bracketType: BracketType): Promise<Result<Match[], DatabaseError>> {
    return this.findAll({ tournamentId, bracketType })
  }

  /**
   * Find matches by court
   */
  async findByCourt(courtId: string): Promise<Result<Match[], DatabaseError>> {
    return this.findAll({ courtId })
  }

  /**
   * Find active matches
   */
  async findActive(): Promise<Result<Match[], DatabaseError>> {
    return this.findByStatus('active')
  }

  /**
   * Find scheduled matches
   */
  async findScheduled(): Promise<Result<Match[], DatabaseError>> {
    return this.findByStatus('scheduled')
  }

  /**
   * Find completed matches
   */
  async findCompleted(): Promise<Result<Match[], DatabaseError>> {
    return this.findByStatus('completed')
  }

  /**
   * Find matches in date range
   */
  async findInDateRange(startDate: Date, endDate: Date): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const matchesResult = await this.findAll()
      if (matchesResult.error) {
        throw matchesResult.error
      }
      const matches = matchesResult.data
      
      return matches.filter(match => {
        const matchDate = match.scheduledTime || match.startTime
        if (!matchDate) return false
        
        const date = new Date(matchDate)
        return date >= startDate && date <= endDate
      })
    })
  }

  /**
   * Start a match (change status from scheduled to active)
   */
  async startMatch(id: string, courtId?: string): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status !== 'scheduled') {
        throw new DatabaseError(`Match cannot be started. Current status: ${match.status}`)
      }

      const updateData: Partial<Match> = {
        status: 'active',
        startTime: new Date().toISOString()
      }

      if (courtId) {
        updateData.courtId = courtId
      }

      const updateResult = await this.update(id, updateData)
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Update match score
   */
  async updateScore(id: string, scoreUpdate: Partial<Score>): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status === 'completed' || match.status === 'cancelled') {
        throw new DatabaseError('Cannot update score for completed or cancelled match')
      }

      const updatedScore = {
        ...match.score,
        ...scoreUpdate
      }

      // Validate score
      const scoreValidation = ScoreSchema.safeParse(updatedScore)
      if (!scoreValidation.success) {
        throw new DatabaseError(`Invalid score: ${scoreValidation.error.message}`)
      }

      const updateData: Partial<Match> = {
        score: updatedScore
      }

      // If score is complete, set winner and complete match
      if (updatedScore.isComplete) {
        if (updatedScore.team1 === 13) {
          updateData.winner = match.team1.id
        } else if (updatedScore.team2 === 13) {
          updateData.winner = match.team2.id
        }

        updateData.status = 'completed'
        updateData.endTime = new Date().toISOString()
        
        // Calculate duration
        if (match.startTime) {
          const startTime = new Date(match.startTime).getTime()
          const endTime = new Date().getTime()
          updateData.duration = Math.round((endTime - startTime) / (1000 * 60)) // minutes
        }
      }

      const updateResult = await this.update(id, updateData)
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Add an end to a match
   */
  async addEnd(id: string, endData: Omit<End, 'id' | 'createdAt'>): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status !== 'active') {
        throw new DatabaseError('Can only add ends to active matches')
      }

      // Create the end with ID and timestamp
      const end: End = {
        ...endData,
        id: this.generateId(),
        createdAt: new Date().toISOString()
      }

      // Validate end
      const endValidation = EndSchema.safeParse(end)
      if (!endValidation.success) {
        throw new DatabaseError(`Invalid end data: ${endValidation.error.message}`)
      }

      // Add end to match
      const updatedEnds = [...match.ends, end]

      // Update match score based on ends
      const team1Score = updatedEnds
        .filter(e => e.winner === match.team1.id)
        .reduce((sum, e) => sum + e.points, 0)
      
      const team2Score = updatedEnds
        .filter(e => e.winner === match.team2.id)
        .reduce((sum, e) => sum + e.points, 0)

      const updatedScore: Score = {
        team1: team1Score,
        team2: team2Score,
        isComplete: team1Score === 13 || team2Score === 13
      }

      const updateData: Partial<Match> = {
        ends: updatedEnds,
        score: updatedScore
      }

      // If score is complete, set winner and complete match
      if (updatedScore.isComplete) {
        updateData.winner = team1Score === 13 ? match.team1.id : match.team2.id
        updateData.status = 'completed'
        updateData.endTime = new Date().toISOString()
        
        // Calculate duration
        if (match.startTime) {
          const startTime = new Date(match.startTime).getTime()
          const endTime = new Date().getTime()
          updateData.duration = Math.round((endTime - startTime) / (1000 * 60))
        }
      }

      const updateResult = await this.update(id, updateData)
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Update an existing end
   */
  async updateEnd(matchId: string, endId: string, endUpdate: Partial<End>): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(matchId)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(matchId, this.entityName)
      }

      const match = matchResult.data
      const endIndex = match.ends.findIndex((e: any) => e.id === endId)
      if (endIndex === -1) {
        throw new DatabaseError(`End with ID ${endId} not found in match`)
      }

      // Update the end
      const updatedEnd = {
        ...match.ends[endIndex],
        ...endUpdate
      }

      // Validate updated end
      const endValidation = EndSchema.safeParse(updatedEnd)
      if (!endValidation.success) {
        throw new DatabaseError(`Invalid end data: ${endValidation.error.message}`)
      }

      // Update ends array
      const updatedEnds = [...match.ends]
      updatedEnds[endIndex] = updatedEnd

      // Recalculate match score
      const team1Score = updatedEnds
        .filter(e => e.winner === match.team1.id)
        .reduce((sum, e) => sum + e.points, 0)
      
      const team2Score = updatedEnds
        .filter(e => e.winner === match.team2.id)
        .reduce((sum, e) => sum + e.points, 0)

      const updatedScore: Score = {
        team1: team1Score,
        team2: team2Score,
        isComplete: team1Score === 13 || team2Score === 13
      }

      const updateResult = await this.update(matchId, {
        ends: updatedEnds,
        score: updatedScore
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Complete a match manually
   */
  async completeMatch(id: string, finalScore: Score, winnerId: string): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status === 'completed') {
        throw new DatabaseError('Match is already completed')
      }

      // Validate final score
      const scoreValidation = ScoreSchema.safeParse(finalScore)
      if (!scoreValidation.success) {
        throw new DatabaseError(`Invalid final score: ${scoreValidation.error.message}`)
      }

      if (!finalScore.isComplete) {
        throw new DatabaseError('Final score must be complete')
      }

      // Validate winner
      if (winnerId !== match.team1.id && winnerId !== match.team2.id) {
        throw new DatabaseError('Winner must be one of the participating teams')
      }

      const updateData: Partial<Match> = {
        status: 'completed',
        score: finalScore,
        winner: winnerId,
        endTime: new Date().toISOString()
      }

      // Calculate duration if match was started
      if (match.startTime) {
        const startTime = new Date(match.startTime).getTime()
        const endTime = new Date().getTime()
        updateData.duration = Math.round((endTime - startTime) / (1000 * 60))
      }

      const updateResult = await this.update(id, updateData)
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Cancel a match
   */
  async cancelMatch(id: string, reason?: string): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status === 'completed') {
        throw new DatabaseError('Cannot cancel completed match')
      }

      const updateData: Partial<Match> = {
        status: 'cancelled',
        endTime: new Date().toISOString()
      }

      if (reason) {
        updateData.notes = match.notes ? `${match.notes}\n\nCancellation reason: ${reason}` : `Cancelled: ${reason}`
      }

      const updateResult = await this.update(id, updateData)
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Assign court to match
   */
  async assignCourt(id: string, courtId: string): Promise<Result<Match, DatabaseError>> {
    return this.update(id, { courtId })
  }

  /**
   * Update match schedule
   */
  async updateSchedule(id: string, scheduledTime: string): Promise<Result<Match, DatabaseError>> {
    return tryCatch(async () => {
      const matchResult = await this.findById(id)
      if (matchResult.error) {
        throw matchResult.error
      }
      
      if (!matchResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const match = matchResult.data
      if (match.status !== 'scheduled') {
        throw new DatabaseError('Can only reschedule scheduled matches')
      }

      const updateResult = await this.update(id, { scheduledTime })
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Get match statistics for tournament
   */
  async getTournamentStats(tournamentId: string): Promise<Result<{
    totalMatches: number
    completedMatches: number
    activeMatches: number
    scheduledMatches: number
    cancelledMatches: number
    averageDuration: number
    totalDuration: number
  }, DatabaseError>> {
    return tryCatch(async () => {
      const matchesResult = await this.findByTournament(tournamentId)
      if (matchesResult.error) {
        throw matchesResult.error
      }
      const matches = matchesResult.data
      
      const stats = {
        totalMatches: matches.length,
        completedMatches: 0,
        activeMatches: 0,
        scheduledMatches: 0,
        cancelledMatches: 0,
        averageDuration: 0,
        totalDuration: 0
      }

      let totalDuration = 0
      let matchesWithDuration = 0

      matches.forEach(match => {
        switch (match.status) {
          case 'completed':
            stats.completedMatches++
            if (match.duration) {
              totalDuration += match.duration
              matchesWithDuration++
            }
            break
          case 'active':
            stats.activeMatches++
            break
          case 'scheduled':
            stats.scheduledMatches++
            break
          case 'cancelled':
            stats.cancelledMatches++
            break
        }
      })

      stats.totalDuration = totalDuration
      stats.averageDuration = matchesWithDuration > 0 
        ? Math.round(totalDuration / matchesWithDuration) 
        : 0

      return stats
    })
  }

  /**
   * Get upcoming matches for player
   */
  async getUpcomingMatchesForPlayer(playerId: string, limit: number = 10): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const playerMatchesResult = await this.findByPlayer(playerId)
      if (playerMatchesResult.error) {
        throw playerMatchesResult.error
      }
      const playerMatches = playerMatchesResult.data
      const now = new Date()
      
      return playerMatches
        .filter(match => 
          match.status === 'scheduled' && 
          match.scheduledTime && 
          new Date(match.scheduledTime) > now
        )
        .sort((a, b) => 
          new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime()
        )
        .slice(0, limit)
    })
  }

  /**
   * Get recent matches for player
   */
  async getRecentMatchesForPlayer(playerId: string, limit: number = 10): Promise<Result<Match[], DatabaseError>> {
    return tryCatch(async () => {
      const playerMatchesResult = await this.findByPlayer(playerId)
      if (playerMatchesResult.error) {
        throw playerMatchesResult.error
      }
      const playerMatches = playerMatchesResult.data
      
      return playerMatches
        .filter(match => match.status === 'completed')
        .sort((a, b) => 
          new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
        )
        .slice(0, limit)
    })
  }

  /**
   * Get live matches (active status)
   */
  async getLiveMatches(): Promise<Result<Match[], DatabaseError>> {
    return this.findActive()
  }

  /**
   * Get match results for bracket generation
   */
  async getBracketResults(tournamentId: string, round: number, bracketType: BracketType): Promise<Result<{
    winners: string[]
    losers: string[]
    matches: Match[]
  }, DatabaseError>> {
    return tryCatch(async () => {
      const matchesResult = await this.findAll({ 
        tournamentId, 
        round, 
        bracketType,
        status: 'completed'
      })

      if (matchesResult.error) {
        throw matchesResult.error
      }
      const matches = matchesResult.data

      const winners: string[] = []
      const losers: string[] = []

      matches.forEach(match => {
        if (match.winner && match.status === 'completed') {
          winners.push(match.winner)
          
          // Determine loser
          const loserId = match.winner === match.team1.id ? match.team2.id : match.team1.id
          losers.push(loserId)
        }
      })

      return { winners, losers, matches }
    })
  }

  /**
   * Bulk create matches (for tournament bracket generation)
   */
  async bulkCreate(matchesData: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Result<{
    successful: Match[]
    failed: { data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>; error: string }[]
  }, DatabaseError>> {
    return tryCatch(async () => {
      const result = {
        successful: [] as Match[],
        failed: [] as { data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>; error: string }[]
      }

      for (const matchData of matchesData) {
        const matchResult = await this.create(matchData)
        if (matchResult.error) {
          result.failed.push({
            data: matchData,
            error: matchResult.error.message
          })
        } else {
          result.successful.push(matchResult.data)
        }
      }

      return result
    })
  }
}

// Export default instance
export const matchDB = new MatchDB()

// Export utility functions
export const MatchUtils = {
  /**
   * Validate match form data
   */
  validateFormData: (data: unknown) => MatchFormDataSchema.safeParse(data),

  /**
   * Check if match can be started
   */
  canStart: (match: Match): { canStart: boolean; reason?: string } => {
    if (match.status !== 'scheduled') {
      return { canStart: false, reason: `Match is not scheduled (current status: ${match.status})` }
    }
    
    return { canStart: true }
  },

  /**
   * Check if match can be updated
   */
  canUpdate: (match: Match): { canUpdate: boolean; reason?: string } => {
    if (match.status === 'completed') {
      return { canUpdate: false, reason: 'Cannot update completed match' }
    }
    
    if (match.status === 'cancelled') {
      return { canUpdate: false, reason: 'Cannot update cancelled match' }
    }
    
    return { canUpdate: true }
  },

  /**
   * Get match progress percentage
   */
  getProgress: (match: Match): number => {
    if (match.status === 'completed') return 100
    if (match.status === 'cancelled') return 0
    if (match.status === 'scheduled') return 0
    
    // For active matches, calculate based on score (out of 13)
    const maxScore = Math.max(match.score?.team1 || 0, match.score?.team2 || 0)
    return Math.round((maxScore / 13) * 100)
  },

  /**
   * Get match winner team
   */
  getWinnerTeam: (match: Match): Team | null => {
    if (!match.winner) return null
    return match.winner === match.team1?.id ? match.team1 : match.team2 || null
  },

  /**
   * Get match loser team
   */
  getLoserTeam: (match: Match): Team | null => {
    if (!match.winner) return null
    return match.winner === match.team1?.id ? (match.team2 || null) : (match.team1 || null)
  },

  /**
   * Format match result string
   */
  formatResult: (match: Match): string => {
    if (match.status === 'cancelled') return 'Cancelled'
    if (match.status === 'scheduled') return 'Scheduled'
    if (match.status === 'active') return 'In Progress'
    
    return `${match.score?.team1 || 0} - ${match.score?.team2 || 0}`
  },

  /**
   * Check if player won the match
   */
  didPlayerWin: (match: Match, playerId: string): boolean | null => {
    if (!match.winner || match.status !== 'completed') return null
    
    const winningTeam = match.winner === match.team1?.id ? match.team1 : match.team2
    return winningTeam?.players.some((p: any) => p.id === playerId) || false
  },

  /**
   * Get opponent team for a player
   */
  getOpponentTeam: (match: Match, playerId: string): Team | null => {
    const isInTeam1 = match.team1?.players.some((p: any) => p.id === playerId) || false
    const isInTeam2 = match.team2?.players.some((p: any) => p.id === playerId) || false
    
    if (isInTeam1) return match.team2 || null
    if (isInTeam2) return match.team1 || null
    
    return null
  }
}