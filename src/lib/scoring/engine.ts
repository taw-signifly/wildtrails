import { Match, Score, End, Boule, Position, GameFormat } from '@/types'
import { ActionResult } from '@/types/actions'
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

// Import validation schemas
import { 
  validateEndInput, 
  validateScoringConfiguration, 
  validateScoringEngineOptions,
  validateTeamStatistics,
  TeamStatisticsSchema
} from './schemas'

// Import error handling
import { 
  ScoringError, 
  ValidationError, 
  CalculationError, 
  CacheError,
  createValidationError,
  createCalculationError,
  createCacheError
} from './errors'

// Import cache management
import { AdvancedCache, CacheManager, defaultCacheManager } from './cache'

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
/**
 * Type guards for runtime type safety
 */
function isTeamStatistics(value: unknown): value is TeamStatistics {
  try {
    TeamStatisticsSchema.parse(value)
    return true
  } catch {
    return false
  }
}

function isScoreValidationResult(value: unknown): value is ScoreValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'valid' in value &&
    'errors' in value &&
    'warnings' in value &&
    'suggestions' in value &&
    'ruleViolations' in value
  )
}

/**
 * Main Petanque Scoring Engine with comprehensive error handling and type safety
 */
export class ScoringEngine {
  private config: ScoringConfiguration
  private options: ScoringEngineOptions
  private cacheManager: CacheManager

  constructor(
    config?: Partial<ScoringConfiguration>,
    options?: Partial<ScoringEngineOptions>
  ) {
    try {
      // Validate and initialize configuration
      const defaultConfig = createDefaultScoringConfiguration('triples')
      const mergedConfig = { ...defaultConfig, ...config }
      this.config = validateScoringConfiguration(mergedConfig)

      // Validate and initialize options
      const defaultOptions = {
        precision: 0.1,
        measurementThreshold: 2,
        confidenceThreshold: 0.8,
        debugMode: false
      }
      const mergedOptions = { ...defaultOptions, ...options }
      this.options = validateScoringEngineOptions(mergedOptions)

      // Initialize cache manager with proper limits
      this.cacheManager = new CacheManager()
      
      if (this.options.debugMode) {
        console.log('ScoringEngine initialized:', {
          config: this.config,
          options: this.options
        })
      }
    } catch (error) {
      throw createValidationError(
        `Failed to initialize ScoringEngine: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'constructor',
        undefined,
        { config, options }
      )
    }
  }

  /**
   * Calculate score for an end based on boule positions
   * @param boules Array of boules in the end
   * @param jack Jack position
   * @param teamIds Participating team IDs
   * @param options Calculation options
   * @returns ActionResult with end score result
   */
  public calculateEndScore(
    boules: Boule[],
    jack: Position,
    teamIds: string[],
    options?: Partial<EndCalculationOptions>
  ): ActionResult<EndScoreResult> {
    try {
      // Validate inputs
      if (!Array.isArray(boules) || boules.length === 0) {
        return {
          success: false,
          error: 'At least one boule is required for end calculation'
        }
      }

      if (!jack || typeof jack.x !== 'number' || typeof jack.y !== 'number') {
        return {
          success: false,
          error: 'Valid jack position is required'
        }
      }

      if (!Array.isArray(teamIds) || teamIds.length < 2) {
        return {
          success: false,
          error: 'At least two team IDs are required'
        }
      }

      const calculationOptions: EndCalculationOptions = {
        measurementThreshold: this.options.measurementThreshold,
        allowTies: false,
        requireAllBoules: false,
        debugMode: this.options.debugMode,
        ...options
      }

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

      return { success: true, data: result }
    } catch (error) {
      if (this.options.debugMode) {
        console.error('ScoringEngine.calculateEndScore error:', error)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'End calculation failed'
      }
    }
  }

  /**
   * Validate match score against Petanque rules
   * @param match Match to validate
   * @param options Validation options
   * @returns ActionResult with validation result
   */
  public validateMatchScore(
    match: Match,
    options?: Partial<ValidationOptions>
  ): ActionResult<ScoreValidationResult> {
    try {
      // Validate input
      if (!match || !match.id) {
        return {
          success: false,
          error: 'Valid match object with ID is required'
        }
      }

      const cacheKey = `validation-${match.id}-${match.updatedAt}`
      const validationCache = this.cacheManager.getCache<ScoreValidationResult>('validation')
      
      // Check cache first with type safety
      const cached = validationCache.get(cacheKey)
      if (cached !== null && isScoreValidationResult(cached)) {
        return { success: true, data: cached }
      }

      const validationOptions: ValidationOptions = {
        strict: true,
        allowManualOverrides: false,
        validateProgression: true,
        checkIntegrity: true,
        ...options
      }

      const result = validateMatchScore(match, validationOptions)
      
      // Cache result safely
      validationCache.set(cacheKey, result)
      
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Match validation failed'
      }
    }
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
   * Process end scoring for a match with comprehensive validation
   * @param matchId Match ID
   * @param endData End input data
   * @returns ActionResult with end score result
   */
  public async processEndScoring(
    matchId: string,
    endData: unknown
  ): Promise<ActionResult<EndScoreResult>> {
    try {
      // Validate inputs with Zod schemas
      if (!matchId || typeof matchId !== 'string') {
        return {
          success: false,
          error: 'Valid match ID is required'
        }
      }

      const validatedEndData = validateEndInput(endData)

      // Calculate boule distances first
      const boulesWithDistances: Boule[] = validatedEndData.boules.map(boule => ({
        ...boule,
        distance: GeometryUtils.calculateDistance(boule.position, validatedEndData.jackPosition)
      }))

      // Extract team IDs from boules
      const teamIds = [...new Set(boulesWithDistances.map(b => b.teamId))]

      // Validate end configuration
      const validation = validateEndConfiguration(
        boulesWithDistances, 
        validatedEndData.jackPosition, 
        teamIds
      )

      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid end configuration: ${validation.errors.join(', ')}`,
          fieldErrors: validation.errors.reduce((acc, error, index) => {
            acc[`validation_${index}`] = [error]
            return acc
          }, {} as Record<string, string[]>)
        }
      }

      // Calculate end score
      const scoreResult = this.calculateEndScore(
        boulesWithDistances,
        validatedEndData.jackPosition,
        teamIds
      )

      if (!scoreResult.success) {
        return scoreResult
      }

      if (this.options.debugMode) {
        console.log('ScoringEngine.processEndScoring:', {
          matchId,
          endNumber: validatedEndData.endNumber,
          result: scoreResult.data
        })
      }

      return scoreResult
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          fieldErrors: error.fieldErrors
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'End scoring processing failed'
      }
    }
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
   * Calculate team statistics with proper caching and type safety
   * @param teamId Team ID
   * @param matches Array of matches
   * @param options Statistics options
   * @returns ActionResult with team statistics
   */
  public calculateTeamStatistics(
    teamId: string,
    matches: Match[],
    options?: Partial<StatisticsOptions>
  ): ActionResult<TeamStatistics> {
    try {
      // Validate inputs
      if (!teamId || typeof teamId !== 'string') {
        return {
          success: false,
          error: 'Valid team ID is required'
        }
      }

      if (!Array.isArray(matches)) {
        return {
          success: false,
          error: 'Valid matches array is required'
        }
      }

      const cacheKey = `team-${teamId}-${matches.length}-${Date.now()}`
      const statisticsCache = this.cacheManager.getCache<TeamStatistics>('statistics')
      
      // Check cache with proper type safety
      const cached = statisticsCache.get(cacheKey)
      if (cached !== null && isTeamStatistics(cached)) {
        return { success: true, data: cached }
      }

      const statisticsOptions: StatisticsOptions = {
        includeIncompleteMatches: false,
        weightRecentMatches: true,
        minimumMatchesRequired: 1,
        calculationPrecision: 2,
        ...options
      }

      const stats = calculateTeamStatistics(teamId, matches, statisticsOptions)
      
      // Validate calculated statistics before caching
      const validatedStats = validateTeamStatistics(stats)
      
      // Cache result safely
      statisticsCache.set(cacheKey, validatedStats)
      
      return { success: true, data: validatedStats }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Team statistics calculation failed'
      }
    }
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
   * Update scoring configuration with validation
   * @param newConfig Partial configuration to update
   * @returns ActionResult indicating success or failure
   */
  public updateConfiguration(newConfig: Partial<ScoringConfiguration>): ActionResult<ScoringConfiguration> {
    try {
      const updatedConfig = { ...this.config, ...newConfig }
      const validatedConfig = validateScoringConfiguration(updatedConfig)
      
      this.config = validatedConfig
      
      if (this.options.debugMode) {
        console.log('ScoringEngine configuration updated:', this.config)
      }

      return { success: true, data: this.config }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update configuration'
      }
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
   * Clear all caches safely
   */
  public clearCaches(): void {
    try {
      this.cacheManager.clearAll()
      
      if (this.options.debugMode) {
        console.log('ScoringEngine caches cleared')
      }
    } catch (error) {
      console.warn('Failed to clear caches:', error)
    }
  }

  /**
   * Get current engine state with cache metrics
   * @returns Current state information
   */
  public getState(): {
    config: ScoringConfiguration
    options: ScoringEngineOptions
    cacheMetrics: Record<string, any>
    memoryUsage: number
  } {
    return {
      config: { ...this.config },
      options: { ...this.options },
      cacheMetrics: this.cacheManager.getAllMetrics(),
      memoryUsage: this.cacheManager.getTotalMemoryUsage()
    }
  }

  /**
   * Get comprehensive engine performance metrics
   * @returns Performance metrics
   */
  public getPerformanceMetrics(): {
    cacheMetrics: Record<string, any>
    totalMemoryUsage: number
    cacheNames: string[]
    overallHitRate: number
  } {
    const allMetrics = this.cacheManager.getAllMetrics()
    
    // Calculate overall hit rate across all caches
    let totalHits = 0
    let totalRequests = 0
    
    Object.values(allMetrics).forEach(metrics => {
      totalHits += metrics.hits
      totalRequests += metrics.hits + metrics.misses
    })
    
    const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    
    return {
      cacheMetrics: allMetrics,
      totalMemoryUsage: this.cacheManager.getTotalMemoryUsage(),
      cacheNames: this.cacheManager.getCacheNames(),
      overallHitRate
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
   * @returns ActionResult with validation details
   */
  public validateSetup(): ActionResult<{
    valid: boolean
    issues: string[]
    recommendations: string[]
    cacheHealth: boolean
    memoryUsage: number
  }> {
    try {
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

      // Check cache health
      const memoryUsage = this.cacheManager.getTotalMemoryUsage()
      const cacheHealth = memoryUsage < 100 // MB limit
      
      if (!cacheHealth) {
        issues.push('Cache memory usage is high')
        recommendations.push('Consider clearing caches or reducing cache sizes')
      }

      return {
        success: true,
        data: {
          valid: issues.length === 0,
          issues,
          recommendations,
          cacheHealth,
          memoryUsage
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate engine setup'
      }
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