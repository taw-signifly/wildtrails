import { Tournament, Team, Match, TournamentType } from '@/types'
import { Seeder } from './seeding'
import { BaseFormatHandler } from './formats/base'
import { SingleEliminationHandler } from './formats/single-elimination'
import { RoundRobinHandler } from './formats/round-robin'
import { SwissSystemHandler } from './formats/swiss'
import { BarrageHandler } from './formats/barrage'
import { 
  BracketResult, 
  ProgressionResult, 
  Standings, 
  BracketGenerationOptions,
  SeedingOptions,
  ValidatorResult
} from './types'

export class BracketGenerator {
  private seeder: Seeder
  private formatHandlers: Map<TournamentType, BaseFormatHandler>

  constructor() {
    this.seeder = new Seeder()
    this.formatHandlers = new Map<TournamentType, BaseFormatHandler>()
    this.formatHandlers.set('single-elimination', new SingleEliminationHandler())
    this.formatHandlers.set('round-robin', new RoundRobinHandler())
    this.formatHandlers.set('swiss', new SwissSystemHandler())
    this.formatHandlers.set('barrage', new BarrageHandler())
  }

  /**
   * Generate a complete tournament bracket
   */
  async generateBracket(
    tournament: Tournament,
    teams: Team[],
    options?: Partial<BracketGenerationOptions>
  ): Promise<BracketResult> {
    // Merge with default options
    const fullOptions = this.mergeWithDefaults(options)
    
    // Validate tournament and teams
    const validation = this.validateBracketGeneration(tournament, teams)
    if (!validation.isValid) {
      throw new Error(`Bracket generation failed: ${validation.errors.join(', ')}`)
    }

    // Get format handler
    const handler = this.getFormatHandler(tournament.type)
    
    // Seed teams
    const seededTeams = this.seeder.seedTeams(teams, fullOptions.seeding)
    
    // Generate bracket using format-specific handler
    const result = await handler.generateBracket(tournament, seededTeams, fullOptions)
    
    return {
      ...result,
      seededTeams
    }
  }

  /**
   * Update tournament progression after match completion
   */
  async updateBracketProgression(
    completedMatch: Match,
    tournament: Tournament,
    allMatches: Match[]
  ): Promise<ProgressionResult> {
    const handler = this.getFormatHandler(tournament.type)
    return await handler.updateProgression(completedMatch, tournament, allMatches)
  }

  /**
   * Calculate current tournament standings
   */
  async calculateStandings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<Standings> {
    const handler = this.getFormatHandler(tournament.type)
    return await handler.calculateStandings(tournament, matches)
  }

  /**
   * Check if tournament is complete
   */
  isComplete(tournament: Tournament, matches: Match[]): boolean {
    const handler = this.getFormatHandler(tournament.type)
    return handler.isComplete(tournament, matches)
  }

  /**
   * Validate teams and tournament for bracket generation
   */
  validateBracketGeneration(tournament: Tournament, teams: Team[]): ValidatorResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Basic validation
    if (!tournament) {
      errors.push('Tournament is required')
    }

    if (!teams || teams.length === 0) {
      errors.push('At least one team is required')
    }

    if (tournament && teams) {
      // Get format-specific validation
      const handler = this.formatHandlers.get(tournament.type)
      if (!handler) {
        errors.push(`Unsupported tournament type: ${tournament.type}`)
      } else {
        const formatValidation = handler.validateInput(tournament, teams)
        errors.push(...formatValidation.errors)
        warnings.push(...formatValidation.warnings)
        suggestions.push(...formatValidation.suggestions)
      }

      // Tournament-specific validation
      if (tournament.format) {
        const invalidTeams = teams.filter(team => {
          const playerCount = team.players?.length || 0
          switch (tournament.format) {
            case 'singles': return playerCount !== 1
            case 'doubles': return playerCount !== 2
            case 'triples': return playerCount !== 3
            default: return false
          }
        })

        if (invalidTeams.length > 0) {
          errors.push(`${invalidTeams.length} teams have incorrect player count for ${tournament.format} format`)
        }
      }

      // Check for team name conflicts
      const teamNames = teams.map(t => t.name.toLowerCase().trim())
      const uniqueNames = new Set(teamNames)
      if (teamNames.length !== uniqueNames.size) {
        warnings.push('Some teams have similar or identical names')
      }

      // Check for sufficient courts if specified
      if (tournament.maxPlayers && teams.length > tournament.maxPlayers) {
        errors.push(`Tournament has ${teams.length} teams but maximum allowed is ${tournament.maxPlayers}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Get available tournament formats and their constraints
   */
  getAvailableFormats(): Array<{
    type: TournamentType
    name: string
    description: string
    constraints: any
  }> {
    return Array.from(this.formatHandlers.entries()).map(([type, handler]) => ({
      type,
      name: this.getFormatDisplayName(type),
      description: this.getFormatDescription(type),
      constraints: handler.constraints
    }))
  }

  /**
   * Get optimal tournament format recommendation
   */
  recommendFormat(teamCount: number, timeConstraints?: number): TournamentType {
    // Based on team count and time constraints, recommend best format
    
    if (teamCount <= 4) {
      return 'round-robin' // Everyone plays everyone
    }
    
    if (teamCount <= 8) {
      return timeConstraints && timeConstraints < 120 ? 'single-elimination' : 'round-robin'
    }
    
    if (teamCount <= 16) {
      return timeConstraints && timeConstraints < 180 ? 'single-elimination' : 'swiss'
    }
    
    if (teamCount <= 32) {
      return 'swiss' // Swiss handles medium tournaments well
    }
    
    // Large tournaments
    return 'swiss' // Swiss scales well to large tournaments
  }

  /**
   * Estimate tournament duration
   */
  estimateTournamentDuration(
    tournament: Tournament,
    teams: Team[],
    options?: Partial<BracketGenerationOptions>
  ): {
    estimatedMatches: number
    estimatedDuration: number // minutes
    breakdown: {
      matchDuration: number
      setupTime: number
      breaks: number
      total: number
    }
  } {
    const handler = this.getFormatHandler(tournament.type)
    const fullOptions = this.mergeWithDefaults(options)
    
    // Calculate based on format
    let estimatedMatches = 0
    
    switch (tournament.type) {
      case 'single-elimination':
        estimatedMatches = teams.length - 1
        break
      case 'round-robin':
        estimatedMatches = teams.length * (teams.length - 1) / 2
        break
      case 'swiss':
        const rounds = Math.ceil(Math.log2(teams.length))
        estimatedMatches = Math.floor(teams.length / 2) * rounds
        break
      case 'barrage':
        estimatedMatches = Math.ceil(teams.length * 2.5)
        break
      default:
        estimatedMatches = teams.length
    }

    // Base match duration
    const baseMatchDuration = tournament.shortForm ? 30 : 45 // minutes
    
    // Additional time factors
    const setupTimePerMatch = 5 // minutes between matches
    const breakTime = Math.floor(estimatedMatches / 10) * 15 // 15 min break every 10 matches
    
    const matchTime = estimatedMatches * baseMatchDuration
    const setupTime = estimatedMatches * setupTimePerMatch
    const totalBreaks = breakTime
    
    const totalDuration = matchTime + setupTime + totalBreaks

    return {
      estimatedMatches,
      estimatedDuration: totalDuration,
      breakdown: {
        matchDuration: matchTime,
        setupTime,
        breaks: totalBreaks,
        total: totalDuration
      }
    }
  }

  /**
   * Generate seeding preview without creating matches
   */
  previewSeeding(teams: Team[], options: SeedingOptions): Team[] {
    return this.seeder.seedTeams(teams, options)
  }

  private getFormatHandler(type: TournamentType): BaseFormatHandler {
    const handler = this.formatHandlers.get(type)
    if (!handler) {
      throw new Error(`Unsupported tournament format: ${type}`)
    }
    return handler
  }

  private mergeWithDefaults(options?: Partial<BracketGenerationOptions>): BracketGenerationOptions {
    const defaultSeeding: SeedingOptions = {
      method: 'ranked',
      avoidSameClub: true,
      regionalBalance: false,
      skillDistribution: 'even'
    }

    return {
      seeding: { ...defaultSeeding, ...options?.seeding },
      allowByes: options?.allowByes ?? true,
      byePlacement: options?.byePlacement ?? 'top',
      validateTeamCount: options?.validateTeamCount ?? true
    }
  }

  private getFormatDisplayName(type: TournamentType): string {
    switch (type) {
      case 'single-elimination': return 'Single Elimination'
      case 'double-elimination': return 'Double Elimination'
      case 'round-robin': return 'Round Robin'
      case 'swiss': return 'Swiss System'
      case 'barrage': return 'Barrage Qualification'
      default: return type
    }
  }

  private getFormatDescription(type: TournamentType): string {
    switch (type) {
      case 'single-elimination':
        return 'Traditional knockout tournament. Lose once and you\'re out. Fast but less forgiving.'
        
      case 'double-elimination':
        return 'Two-bracket system with winners and losers brackets. More forgiving than single elimination.'
        
      case 'round-robin':
        return 'Everyone plays everyone else. Most fair but takes longest time. Best for smaller groups.'
        
      case 'swiss':
        return 'Pairs teams with similar records each round. Good balance of fairness and efficiency for larger tournaments.'
        
      case 'barrage':
        return 'Qualification format where teams need 2 wins to qualify and are eliminated after 2 losses. Traditional Petanque format.'
        
      default:
        return 'Tournament format'
    }
  }
}