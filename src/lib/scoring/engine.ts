import { Match, Score, End, Boule, Position, GameFormat } from '@/types'
import { 
  EndScoreResult, 
  ScoringConfiguration, 
  ScoringEngineOptions, 
  ValidationOptions,
  StatisticsOptions,
  TeamStatistics,
  TournamentStatistics,
  EndInput,
  ScoreValidationResult,
  ScoringEngineState
} from '@/types/scoring'

// Import all scoring modules
import { calculateEndScore, validateEndConfiguration, EndCalculationOptions } from './calculator'
import { validateMatchScore } from './validation'
import { calculateTeamStatistics, calculateTournamentStatistics, calculateAPD, calculateDelta } from './statistics'
import { createDefaultScoringConfiguration, PETANQUE_RULES, PetanqueRules } from './rules'
import { GeometryUtils } from './geometry'

/**
 * Main Petanque Scoring Engine
 * Integrates all scoring components into a unified interface
 */
export class ScoringEngine {
  private config: ScoringConfiguration
  private options: ScoringEngineOptions
  private state: ScoringEngineState

  constructor(
    config?: Partial<ScoringConfiguration>,
    options?: Partial<ScoringEngineOptions>
  ) {
    // Initialize configuration with defaults
    this.config = {
      ...createDefaultScoringConfiguration('triples'),
      ...config
    }

    // Initialize options with defaults
    this.options = {
      precision: 0.1,
      measurementThreshold: 2,
      confidenceThreshold: 0.8,
      debugMode: false,
      ...options
    }

    // Initialize state
    this.state = {
      validationCache: new Map(),
      statisticsCache: new Map()
    }
  }

  /**
   * Calculate score for an end based on boule positions
   * @param boules Array of boules in the end
   * @param jack Jack position
   * @param teamIds Participating team IDs
   * @param options Calculation options
   * @returns End score result
   */
  public calculateEndScore(
    boules: Boule[],
    jack: Position,
    teamIds: string[],
    options?: Partial<EndCalculationOptions>
  ): EndScoreResult {
    const calculationOptions: EndCalculationOptions = {
      measurementThreshold: this.options.measurementThreshold,
      allowTies: false,
      requireAllBoules: false,
      debugMode: this.options.debugMode,
      ...options
    }

    try {
      const result = calculateEndScore(boules, jack, teamIds, calculationOptions)
      
      if (this.options.debugMode) {
        console.log('ScoringEngine.calculateEndScore:', {
          bouleCount: boules.length,
          jackPosition: jack,
          result: {
            winner: result.winner,
            points: result.points,
            confidence: result.confidence,
            isCloseCall: result.isCloseCall
          }
        })
      }

      return result
    } catch (error) {
      if (this.options.debugMode) {
        console.error('ScoringEngine.calculateEndScore error:', error)
      }
      throw error
    }
  }

  /**
   * Validate match score against Petanque rules
   * @param match Match to validate
   * @param options Validation options
   * @returns Validation result
   */
  public validateMatchScore(
    match: Match,
    options?: Partial<ValidationOptions>
  ): ScoreValidationResult {
    const cacheKey = `${match.id}-${match.updatedAt}`
    
    // Check cache first
    if (this.state.validationCache.has(cacheKey)) {
      return this.state.validationCache.get(cacheKey)!
    }

    const validationOptions: ValidationOptions = {
      strict: true,
      allowManualOverrides: false,
      validateProgression: true,
      checkIntegrity: true,
      ...options
    }

    const result = validateMatchScore(match, validationOptions)
    
    // Cache result
    this.state.validationCache.set(cacheKey, result)
    
    return result
  }

  /**
   * Check if game is complete based on score
   * @param score Current score
   * @returns True if game is complete
   */
  public isGameComplete(score: Score): boolean {
    return score.team1 === PETANQUE_RULES.MAX_GAME_POINTS || 
           score.team2 === PETANQUE_RULES.MAX_GAME_POINTS
  }

  /**
   * Get game winner from score
   * @param score Complete game score
   * @returns Winner team identifier or null if no winner
   */
  public getGameWinner(score: Score): string | null {
    if (!score.isComplete) return null
    
    if (score.team1 === PETANQUE_RULES.MAX_GAME_POINTS) return 'team1'
    if (score.team2 === PETANQUE_RULES.MAX_GAME_POINTS) return 'team2'
    
    return null
  }

  /**
   * Calculate points differential for a match
   * @param finalScore Final match score
   * @returns Points differential
   */
  public calculatePointsDifferential(finalScore: Score): number {
    if (!finalScore.isComplete) {
      throw new Error('Cannot calculate points differential for incomplete match')
    }

    const winnerScore = Math.max(finalScore.team1, finalScore.team2)
    const loserScore = Math.min(finalScore.team1, finalScore.team2)
    
    return winnerScore - loserScore
  }

  /**
   * Process end scoring for a match
   * @param matchId Match ID
   * @param endData End input data
   * @returns End score result
   */
  public async processEndScoring(
    matchId: string,
    endData: EndInput
  ): Promise<EndScoreResult> {
    // Set active scoring session
    this.state.activeScoringSession = {
      matchId,
      startTime: new Date().toISOString(),
      endCount: endData.endNumber,
      configuration: this.config
    }

    // Calculate boule distances first
    const boulesWithDistances: Boule[] = endData.boules.map(boule => ({
      ...boule,
      distance: GeometryUtils.calculateDistance(boule.position, endData.jackPosition)
    }))

    // Extract team IDs from boules
    const teamIds = [...new Set(boulesWithDistances.map(b => b.teamId))]

    // Validate end configuration
    const validation = validateEndConfiguration(
      boulesWithDistances, 
      endData.jackPosition, 
      teamIds
    )

    if (!validation.valid) {
      throw new Error(`Invalid end configuration: ${validation.errors.join(', ')}`)
    }

    // Calculate end score
    const result = this.calculateEndScore(
      boulesWithDistances,
      endData.jackPosition,
      teamIds
    )

    if (this.options.debugMode) {
      console.log('ScoringEngine.processEndScoring:', {
        matchId,
        endNumber: endData.endNumber,
        result
      })
    }

    return result
  }

  /**
   * Validate score progression
   * @param currentScore Current match score
   * @param newScore Proposed new score
   * @returns True if progression is valid
   */
  public validateScoreProgression(currentScore: Score, newScore: Score): boolean {
    // Check that scores only increase
    if (newScore.team1 < currentScore.team1 || newScore.team2 < currentScore.team2) {
      return false
    }

    // Check maximum increase per end
    const team1Increase = newScore.team1 - currentScore.team1
    const team2Increase = newScore.team2 - currentScore.team2

    // Only one team should score in an end
    if (team1Increase > 0 && team2Increase > 0) {
      return false
    }

    // Check maximum points per end
    const maxIncrease = Math.max(team1Increase, team2Increase)
    if (maxIncrease > this.config.maxPointsPerEnd) {
      return false
    }

    // Check minimum points per end (if any increase)
    if (maxIncrease > 0 && maxIncrease < PETANQUE_RULES.MIN_END_POINTS) {
      return false
    }

    return true
  }

  /**
   * Calculate team statistics
   * @param teamId Team ID
   * @param matches Array of matches
   * @param options Statistics options
   * @returns Team statistics
   */
  public calculateTeamStatistics(
    teamId: string,
    matches: Match[],
    options?: Partial<StatisticsOptions>
  ): TeamStatistics {
    const cacheKey = `team-${teamId}-${matches.length}`
    
    if (this.state.statisticsCache.has(cacheKey)) {
      return this.state.statisticsCache.get(cacheKey)! as TeamStatistics
    }

    const statisticsOptions: StatisticsOptions = {
      includeIncompleteMatches: false,
      weightRecentMatches: true,
      minimumMatchesRequired: 1,
      calculationPrecision: 2,
      ...options
    }

    const stats = calculateTeamStatistics(teamId, matches, statisticsOptions)
    
    this.state.statisticsCache.set(cacheKey, stats)
    
    return stats
  }

  /**
   * Calculate tournament statistics
   * @param tournamentId Tournament ID
   * @param matches Array of tournament matches
   * @param options Statistics options
   * @returns Tournament statistics
   */
  public calculateTournamentStatistics(
    tournamentId: string,
    matches: Match[],
    options?: Partial<StatisticsOptions>
  ): TournamentStatistics {
    const statisticsOptions: StatisticsOptions = {
      includeIncompleteMatches: false,
      weightRecentMatches: true,
      minimumMatchesRequired: 1,
      calculationPrecision: 2,
      ...options
    }
    
    return calculateTournamentStatistics(tournamentId, matches, statisticsOptions)
  }

  /**
   * Calculate Average Points Differential (APD)
   * @param matches Array of matches
   * @param teamId Optional team ID for team-specific APD
   * @returns APD value
   */
  public calculateAPD(matches: Match[], teamId?: string): number {
    return calculateAPD(matches, teamId)
  }

  /**
   * Calculate Delta system value for tie-breaking
   * @param matches Array of matches
   * @param teamId Team ID
   * @returns Delta value
   */
  public calculateDelta(matches: Match[], teamId: string): number {
    return calculateDelta(matches, teamId)
  }

  /**
   * Get current scoring configuration
   * @returns Current configuration
   */
  public getConfiguration(): ScoringConfiguration {
    return { ...this.config }
  }

  /**
   * Update scoring configuration
   * @param newConfig Partial configuration to update
   */
  public updateConfiguration(newConfig: Partial<ScoringConfiguration>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (this.options.debugMode) {
      console.log('ScoringEngine configuration updated:', this.config)
    }
  }

  /**
   * Get current engine options
   * @returns Current options
   */
  public getOptions(): ScoringEngineOptions {
    return { ...this.options }
  }

  /**
   * Update engine options
   * @param newOptions Partial options to update
   */
  public updateOptions(newOptions: Partial<ScoringEngineOptions>): void {
    this.options = { ...this.options, ...newOptions }
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.state.validationCache.clear()
    this.state.statisticsCache.clear()
    
    if (this.options.debugMode) {
      console.log('ScoringEngine caches cleared')
    }
  }

  /**
   * Get current engine state
   * @returns Current state information
   */
  public getState(): Readonly<ScoringEngineState> {
    return {
      ...this.state,
      validationCache: new Map(this.state.validationCache),
      statisticsCache: new Map(this.state.statisticsCache)
    }
  }

  /**
   * Get engine performance metrics
   * @returns Performance metrics
   */
  public getPerformanceMetrics(): {
    cacheHitRate: number
    validationCacheSize: number
    statisticsCacheSize: number
    activeSessions: number
  } {
    return {
      cacheHitRate: 0, // Would need to track hit/miss ratio
      validationCacheSize: this.state.validationCache.size,
      statisticsCacheSize: this.state.statisticsCache.size,
      activeSessions: this.state.activeScoringSession ? 1 : 0
    }
  }

  /**
   * Create a new scoring engine instance with specific configuration
   * @param format Game format
   * @param options Engine options
   * @returns New ScoringEngine instance
   */
  public static createForFormat(
    format: GameFormat,
    options?: Partial<ScoringEngineOptions>
  ): ScoringEngine {
    const config = createDefaultScoringConfiguration(format)
    return new ScoringEngine(config, options)
  }

  /**
   * Validate engine setup and configuration
   * @returns Validation result
   */
  public validateSetup(): {
    valid: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Validate configuration
    if (this.config.maxPoints !== PETANQUE_RULES.MAX_GAME_POINTS) {
      issues.push('Non-standard maximum points configuration')
    }

    if (this.config.measurementPrecision < 0.1) {
      recommendations.push('Very high precision may impact performance')
    }

    // Validate options
    if (this.options.confidenceThreshold < 0.5) {
      recommendations.push('Low confidence threshold may accept unreliable calculations')
    }

    if (this.options.measurementThreshold < 1) {
      recommendations.push('Very low measurement threshold may require frequent physical measurements')
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    }
  }
}

/**
 * Default scoring engine instance for convenience
 */
export const defaultScoringEngine = new ScoringEngine()

/**
 * Create scoring engine for specific game format
 */
export function createScoringEngine(
  format: GameFormat = 'triples',
  options?: Partial<ScoringEngineOptions>
): ScoringEngine {
  return ScoringEngine.createForFormat(format, options)
}

/**
 * Export utility functions for direct use
 */
export {
  GeometryUtils,
  PetanqueRules,
  calculateEndScore,
  validateMatchScore,
  calculateTeamStatistics,
  calculateTournamentStatistics
}