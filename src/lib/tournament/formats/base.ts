import { Tournament, Team, Match, TournamentType } from '@/types'
import { 
  BracketResult, 
  ProgressionResult, 
  Standings, 
  FormatConstraints,
  ValidatorResult,
  BracketGenerationOptions
} from '../types'

export abstract class BaseFormatHandler {
  abstract readonly formatType: TournamentType
  abstract readonly constraints: FormatConstraints

  /**
   * Generate initial bracket structure and matches for the tournament format
   */
  abstract generateBracket(
    tournament: Tournament, 
    teams: Team[], 
    options: BracketGenerationOptions
  ): Promise<BracketResult>

  /**
   * Update tournament progression after a match completion
   */
  abstract updateProgression(
    completedMatch: Match, 
    tournament: Tournament,
    allMatches: Match[]
  ): Promise<ProgressionResult>

  /**
   * Calculate current standings for all teams
   */
  abstract calculateStandings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<Standings>

  /**
   * Check if tournament is complete
   */
  abstract isComplete(
    tournament: Tournament,
    matches: Match[]
  ): boolean

  /**
   * Validate team count and other constraints for this format
   */
  validateInput(tournament: Tournament, teams: Team[]): ValidatorResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check minimum team count
    if (teams.length < this.constraints.minTeams) {
      errors.push(`${this.formatType} requires at least ${this.constraints.minTeams} teams, got ${teams.length}`)
    }

    // Check maximum team count
    if (this.constraints.maxTeams && teams.length > this.constraints.maxTeams) {
      errors.push(`${this.formatType} supports maximum ${this.constraints.maxTeams} teams, got ${teams.length}`)
    }

    // Check for preferred team counts
    if (this.constraints.preferredTeamCounts.length > 0) {
      const isPreferred = this.constraints.preferredTeamCounts.includes(teams.length)
      if (!isPreferred) {
        const closest = this.findClosestPreferredCount(teams.length)
        warnings.push(`${teams.length} teams is not optimal for ${this.formatType}`)
        suggestions.push(`Consider ${closest} teams for better bracket balance`)
      }
    }

    // Check odd team count support
    if (teams.length % 2 !== 0 && !this.constraints.supportsOddTeamCount) {
      if (this.constraints.supportsByes) {
        warnings.push(`Odd team count (${teams.length}) will require bye assignments`)
      } else {
        errors.push(`${this.formatType} does not support odd team counts`)
      }
    }

    // Check for duplicate teams
    const teamIds = teams.map(t => t.id)
    const uniqueIds = new Set(teamIds)
    if (teamIds.length !== uniqueIds.size) {
      errors.push('Duplicate teams detected in tournament')
    }

    // Check team format compatibility
    const expectedFormat = tournament.format
    const incompatibleTeams = teams.filter(team => {
      const playerCount = team.players.length
      switch (expectedFormat) {
        case 'singles': return playerCount !== 1
        case 'doubles': return playerCount !== 2
        case 'triples': return playerCount !== 3
        default: return false
      }
    })

    if (incompatibleTeams.length > 0) {
      errors.push(`${incompatibleTeams.length} teams have incorrect player count for ${expectedFormat} format`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Get estimated tournament duration in minutes
   */
  protected estimateDuration(
    tournament: Tournament, 
    totalMatches: number, 
    estimatedMatchDuration: number = 45
  ): number {
    // Base calculation: matches * duration
    const baseDuration = totalMatches * estimatedMatchDuration

    // Adjust for tournament settings
    let adjustmentFactor = 1.0

    // Shorter matches for short form games
    if (tournament.shortForm) {
      adjustmentFactor *= 0.7
    }

    // More time needed for manual scoring
    if (tournament.settings.scoringMode === 'self-report') {
      adjustmentFactor *= 1.1
    }

    // More time for manual court assignment
    if (tournament.settings.courtAssignmentMode === 'manual') {
      adjustmentFactor *= 1.2
    }

    return Math.round(baseDuration * adjustmentFactor)
  }

  /**
   * Find the closest preferred team count
   */
  private findClosestPreferredCount(teamCount: number): number {
    if (this.constraints.preferredTeamCounts.length === 0) {
      return teamCount
    }

    return this.constraints.preferredTeamCounts.reduce((closest, current) => {
      return Math.abs(current - teamCount) < Math.abs(closest - teamCount) ? current : closest
    })
  }

  /**
   * Calculate rounds needed for elimination tournaments
   */
  protected calculateEliminationRounds(teamCount: number): number {
    return Math.ceil(Math.log2(teamCount))
  }

  /**
   * Get round name based on round number and total rounds
   */
  protected getRoundName(round: number, totalRounds: number, prefix: string = 'Round'): string {
    const roundsFromEnd = totalRounds - round + 1

    switch (roundsFromEnd) {
      case 1: return 'Final'
      case 2: return 'Semifinal'
      case 3: return 'Quarterfinal'
      case 4: return 'Round of 16'
      case 5: return 'Round of 32'
      default: return `${prefix} ${round}`
    }
  }

  /**
   * Assign byes to teams for elimination tournaments
   */
  protected assignByes(teams: Team[], targetSize: number): { teams: Team[], byes: Team[] } {
    if (teams.length >= targetSize) {
      return { teams, byes: [] }
    }

    const byeCount = targetSize - teams.length
    const byes = teams.slice(0, byeCount)
    const remainingTeams = teams.slice(byeCount)

    return { teams: remainingTeams, byes }
  }

  /**
   * Create bye placeholder team
   */
  protected createByeTeam(originalTeam: Team): Team {
    return {
      ...originalTeam,
      name: `${originalTeam.name} (BYE)`,
      isBye: true
    }
  }
}