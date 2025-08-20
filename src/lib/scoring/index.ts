/**
 * Petanque Scoring Engine
 * Complete scoring system for Petanque tournaments with geometric calculations,
 * rule validation, and comprehensive statistics
 */

// Main Scoring Engine
export { ScoringEngine, defaultScoringEngine, createScoringEngine } from './engine'

// Core calculation modules
export { calculateEndScore, validateEndConfiguration, EndCalculator } from './calculator'
export { GeometryUtils, COURT_CONSTANTS } from './geometry'
export { StatisticsEngine } from './statistics'
export { AdvancedValidation } from './validation'
export { PetanqueRules, PETANQUE_RULES, GAME_FORMAT_RULES } from './rules'

// Import types and functions for internal use
import type {
  EndScoreResult,
  EndMeasurement,
  RelativePosition,
  ScoreValidationResult,
  ScoreIntegrityCheck,
  RuleViolation,
  TeamStatistics,
  PlayerStatistics,
  TournamentStatistics,
  EndAnalysis,
  MatchAnalysis,
  EndInput,
  ScoringConfiguration,
  DistanceCalculationResult,
  ScoringEngineOptions,
  ValidationOptions,
  StatisticsOptions,
  ScoringEvent,
  ScoringEngineState
} from '@/types/scoring'

// Import functions for internal use
import { calculateEndScore } from './calculator'
import { validateMatchScore } from './validation'
import { calculateTeamStatistics } from './statistics'
import { createScoringEngine } from './engine'

// Re-export types
export type {
  EndScoreResult,
  EndMeasurement,
  RelativePosition,
  ScoreValidationResult,
  ScoreIntegrityCheck,
  RuleViolation,
  TeamStatistics,
  PlayerStatistics,
  TournamentStatistics,
  EndAnalysis,
  MatchAnalysis,
  EndInput,
  ScoringConfiguration,
  DistanceCalculationResult,
  ScoringEngineOptions,
  ValidationOptions,
  StatisticsOptions,
  ScoringEvent,
  ScoringEngineState
}

// Utility functions for common tasks
export {
  calculateDistance,
  calculateBouleDistance,
  findClosestBoule,
  sortBoulesByDistance,
  isValidCourtPosition,
  normalizePosition
} from './geometry'

export {
  validateScore,
  validateEndPoints,
  validateGameFormat,
  validateCourtDimensions,
  createDefaultScoringConfiguration,
  isDominantWin,
  isCloseGame,
  classifyGame
} from './rules'

export {
  calculatePointsDifferential,
  calculateAPD,
  calculateDelta,
  calculateTeamStatistics,
  calculateTournamentStatistics
} from './statistics'

export {
  validateMatchScore,
  validateEndProgression,
  performScoreIntegrityCheck
} from './validation'

/**
 * Quick start functions for common operations
 */

/**
 * Calculate end score with minimal setup
 * @param boules Array of boules with positions
 * @param jackPosition Jack position
 * @param teamIds Array of team IDs
 * @returns End score result
 */
export function quickCalculateEnd(
  boules: Array<{ id: string; teamId: string; position: { x: number; y: number } }>,
  jackPosition: { x: number; y: number },
  teamIds: string[]
): EndScoreResult {
  return calculateEndScore(
    boules.map(b => ({
      ...b,
      playerId: 'unknown',
      distance: 0,
      order: 1
    })),
    jackPosition,
    teamIds
  )
}

/**
 * Quick validation of a match
 * @param match Match to validate
 * @returns Simple validation result
 */
export function quickValidateMatch(
  match: any
): { valid: boolean; errors: string[] } {
  const result = validateMatchScore(match)
  return {
    valid: result.valid,
    errors: result.errors
  }
}

/**
 * Quick team statistics calculation
 * @param teamId Team ID
 * @param matches Array of matches
 * @returns Basic team statistics
 */
export function quickTeamStats(
  teamId: string,
  matches: any[]
): {
  wins: number
  losses: number
  winRate: number
  averageScore: number
} {
  const stats = calculateTeamStatistics(teamId, matches)
  return {
    wins: stats.matchesWon,
    losses: stats.matchesLost,
    winRate: stats.winPercentage,
    averageScore: stats.averagePointsFor
  }
}

/**
 * Default engine configurations for different formats
 */
export const SCORING_PRESETS = {
  singles: createScoringEngine('singles'),
  doubles: createScoringEngine('doubles'),
  triples: createScoringEngine('triples'),
  
  // Specialized configurations
  tournament: createScoringEngine('triples', {
    precision: 0.1,
    measurementThreshold: 1.5,
    confidenceThreshold: 0.9,
    debugMode: false
  }),
  
  casual: createScoringEngine('doubles', {
    precision: 0.5,
    measurementThreshold: 3,
    confidenceThreshold: 0.7,
    debugMode: false
  }),
  
  training: createScoringEngine('triples', {
    precision: 0.1,
    measurementThreshold: 2,
    confidenceThreshold: 0.8,
    debugMode: true
  })
} as const

/**
 * Common validation presets
 */
export const VALIDATION_PRESETS = {
  strict: {
    strict: true,
    allowManualOverrides: false,
    validateProgression: true,
    checkIntegrity: true
  },
  
  permissive: {
    strict: false,
    allowManualOverrides: true,
    validateProgression: true,
    checkIntegrity: false
  },
  
  tournament: {
    strict: true,
    allowManualOverrides: false,
    validateProgression: true,
    checkIntegrity: true
  },
  
  casual: {
    strict: false,
    allowManualOverrides: true,
    validateProgression: false,
    checkIntegrity: false
  }
} as const

/**
 * Statistics calculation presets
 */
export const STATISTICS_PRESETS = {
  complete: {
    includeIncompleteMatches: false,
    weightRecentMatches: true,
    minimumMatchesRequired: 3,
    calculationPrecision: 2
  },
  
  comprehensive: {
    includeIncompleteMatches: true,
    weightRecentMatches: true,
    minimumMatchesRequired: 1,
    calculationPrecision: 3
  },
  
  basic: {
    includeIncompleteMatches: false,
    weightRecentMatches: false,
    minimumMatchesRequired: 1,
    calculationPrecision: 1
  }
} as const

/**
 * Version information
 */
export const SCORING_ENGINE_VERSION = '1.0.0'
export const SCORING_ENGINE_INFO = {
  version: SCORING_ENGINE_VERSION,
  features: [
    'End-by-end scoring calculation',
    'Geometric distance measurement',
    'Comprehensive rule validation',
    'Statistical analysis (APD, Delta)',
    'Tournament analytics',
    'Real-time score validation',
    'Multiple game format support',
    'Performance optimization'
  ],
  supportedFormats: ['singles', 'doubles', 'triples'] as const,
  compliance: 'FIPJP Official Rules'
} as const