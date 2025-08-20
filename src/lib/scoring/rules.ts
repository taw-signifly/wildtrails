import { GameFormat, CourtDimensions } from '@/types'
import { RuleViolation, ScoringConfiguration } from '@/types/scoring'

/**
 * Official Petanque rule definitions and validation
 * Based on FIPJP (Fédération Internationale de Pétanque et Jeu Provençal) rules
 */

// Core Petanque rule constants
export const PETANQUE_RULES = {
  // Game scoring
  MAX_GAME_POINTS: 13,
  MIN_END_POINTS: 1,
  MAX_END_POINTS: 6,
  
  // Boule allocation by format
  SINGLES_BOULES_PER_PLAYER: 3,
  DOUBLES_BOULES_PER_PLAYER: 3,
  TRIPLES_BOULES_PER_PLAYER: 2,
  
  // Court dimensions (standard)
  STANDARD_COURT_LENGTH: 15,    // meters
  STANDARD_COURT_WIDTH: 4,      // meters
  MIN_COURT_LENGTH: 12,         // meters
  MAX_COURT_LENGTH: 15,         // meters
  MIN_COURT_WIDTH: 3,           // meters
  MAX_COURT_WIDTH: 5,           // meters
  
  // Jack throwing distances
  MIN_THROWING_DISTANCE: 6,     // meters
  MAX_THROWING_DISTANCE: 10,    // meters
  
  // Equipment specifications
  JACK_DIAMETER: 3,             // cm
  JACK_WEIGHT_MIN: 10,          // grams
  JACK_WEIGHT_MAX: 18,          // grams
  
  BOULE_DIAMETER_MIN: 7.05,     // cm
  BOULE_DIAMETER_MAX: 8.0,      // cm
  BOULE_WEIGHT_MIN: 650,        // grams
  BOULE_WEIGHT_MAX: 800,        // grams
  
  // Measurement and precision
  MEASUREMENT_PRECISION: 0.1,   // cm
  MEASUREMENT_THRESHOLD: 2,     // cm - when physical measurement needed
  PHOTO_FINISH_THRESHOLD: 0.5,  // cm - extremely close calls
  
  // Timing and duration
  MAX_END_DURATION: 1800,       // seconds (30 minutes)
  MAX_MATCH_DURATION: 7200,     // seconds (2 hours)
  
  // Circle and throwing
  THROWING_CIRCLE_DIAMETER: 50, // cm
  CIRCLE_BOUNDARY_WIDTH: 2,     // cm
  
} as const

// Game format configurations
export const GAME_FORMAT_RULES: Record<GameFormat, {
  playersPerTeam: number
  boulesPerPlayer: number
  maxPointsPerEnd: number
  recommendedCourtWidth: number
}> = {
  singles: {
    playersPerTeam: 1,
    boulesPerPlayer: PETANQUE_RULES.SINGLES_BOULES_PER_PLAYER,
    maxPointsPerEnd: 3,  // maximum with 3 boules per player
    recommendedCourtWidth: 3
  },
  doubles: {
    playersPerTeam: 2,
    boulesPerPlayer: PETANQUE_RULES.DOUBLES_BOULES_PER_PLAYER,
    maxPointsPerEnd: 6,  // maximum with 6 boules per team
    recommendedCourtWidth: 4
  },
  triples: {
    playersPerTeam: 3,
    boulesPerPlayer: PETANQUE_RULES.TRIPLES_BOULES_PER_PLAYER,
    maxPointsPerEnd: 6,  // maximum with 6 boules per team
    recommendedCourtWidth: 4
  }
}

// Rule validation functions
export interface RuleCheck {
  valid: boolean
  violations: RuleViolation[]
}

/**
 * Validate game format configuration
 */
export function validateGameFormat(format: GameFormat): RuleCheck {
  const violations: RuleViolation[] = []
  
  if (!GAME_FORMAT_RULES[format]) {
    violations.push({
      rule: 'VALID_GAME_FORMAT',
      severity: 'error',
      description: `Invalid game format: ${format}`,
      suggestion: 'Use singles, doubles, or triples format'
    })
  }
  
  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * Validate court dimensions according to official rules
 */
export function validateCourtDimensions(dimensions: CourtDimensions): RuleCheck {
  const violations: RuleViolation[] = []
  
  // Length validation
  if (dimensions.length < PETANQUE_RULES.MIN_COURT_LENGTH) {
    violations.push({
      rule: 'MIN_COURT_LENGTH',
      severity: 'error',
      description: `Court length ${dimensions.length}m is below minimum ${PETANQUE_RULES.MIN_COURT_LENGTH}m`,
      suggestion: `Increase court length to at least ${PETANQUE_RULES.MIN_COURT_LENGTH}m`
    })
  }
  
  if (dimensions.length > PETANQUE_RULES.MAX_COURT_LENGTH) {
    violations.push({
      rule: 'MAX_COURT_LENGTH',
      severity: 'warning',
      description: `Court length ${dimensions.length}m exceeds standard ${PETANQUE_RULES.MAX_COURT_LENGTH}m`,
      suggestion: `Consider standard court length of ${PETANQUE_RULES.STANDARD_COURT_LENGTH}m`
    })
  }
  
  // Width validation
  if (dimensions.width < PETANQUE_RULES.MIN_COURT_WIDTH) {
    violations.push({
      rule: 'MIN_COURT_WIDTH',
      severity: 'error',
      description: `Court width ${dimensions.width}m is below minimum ${PETANQUE_RULES.MIN_COURT_WIDTH}m`,
      suggestion: `Increase court width to at least ${PETANQUE_RULES.MIN_COURT_WIDTH}m`
    })
  }
  
  if (dimensions.width > PETANQUE_RULES.MAX_COURT_WIDTH) {
    violations.push({
      rule: 'MAX_COURT_WIDTH',
      severity: 'warning',
      description: `Court width ${dimensions.width}m exceeds standard ${PETANQUE_RULES.MAX_COURT_WIDTH}m`,
      suggestion: `Consider standard court width of ${PETANQUE_RULES.STANDARD_COURT_WIDTH}m`
    })
  }
  
  // Throwing distance validation
  if (dimensions.throwingDistance < PETANQUE_RULES.MIN_THROWING_DISTANCE) {
    violations.push({
      rule: 'MIN_THROWING_DISTANCE',
      severity: 'error',
      description: `Throwing distance ${dimensions.throwingDistance}m is below minimum ${PETANQUE_RULES.MIN_THROWING_DISTANCE}m`,
      suggestion: `Increase throwing distance to at least ${PETANQUE_RULES.MIN_THROWING_DISTANCE}m`
    })
  }
  
  if (dimensions.throwingDistance > PETANQUE_RULES.MAX_THROWING_DISTANCE) {
    violations.push({
      rule: 'MAX_THROWING_DISTANCE',
      severity: 'error',
      description: `Throwing distance ${dimensions.throwingDistance}m exceeds maximum ${PETANQUE_RULES.MAX_THROWING_DISTANCE}m`,
      suggestion: `Reduce throwing distance to maximum ${PETANQUE_RULES.MAX_THROWING_DISTANCE}m`
    })
  }
  
  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Validate score according to Petanque rules
 */
export function validateScore(team1Score: number, team2Score: number): RuleCheck {
  const violations: RuleViolation[] = []
  
  // Negative score check
  if (team1Score < 0 || team2Score < 0) {
    violations.push({
      rule: 'NO_NEGATIVE_SCORES',
      severity: 'error',
      description: 'Scores cannot be negative',
      suggestion: 'Ensure all scores are 0 or positive'
    })
  }
  
  // Maximum score check
  if (team1Score > PETANQUE_RULES.MAX_GAME_POINTS || team2Score > PETANQUE_RULES.MAX_GAME_POINTS) {
    violations.push({
      rule: 'MAX_GAME_POINTS',
      severity: 'error',
      description: `Scores cannot exceed ${PETANQUE_RULES.MAX_GAME_POINTS} points`,
      suggestion: `Maximum score in Petanque is ${PETANQUE_RULES.MAX_GAME_POINTS} points`
    })
  }
  
  // Both teams at maximum score
  if (team1Score === PETANQUE_RULES.MAX_GAME_POINTS && team2Score === PETANQUE_RULES.MAX_GAME_POINTS) {
    violations.push({
      rule: 'SINGLE_WINNER',
      severity: 'error',
      description: 'Both teams cannot have maximum score',
      suggestion: 'Only one team can reach 13 points to win the game'
    })
  }
  
  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Validate end points according to Petanque rules
 */
export function validateEndPoints(points: number, format: GameFormat): RuleCheck {
  const violations: RuleViolation[] = []
  const formatRules = GAME_FORMAT_RULES[format]
  
  // Minimum points check
  if (points < PETANQUE_RULES.MIN_END_POINTS) {
    violations.push({
      rule: 'MIN_END_POINTS',
      severity: 'error',
      description: `Minimum points per end is ${PETANQUE_RULES.MIN_END_POINTS}`,
      suggestion: 'The winning team must score at least 1 point per end'
    })
  }
  
  // Maximum points check based on format
  if (points > formatRules.maxPointsPerEnd) {
    violations.push({
      rule: 'MAX_END_POINTS',
      severity: 'error',
      description: `Maximum points per end for ${format} is ${formatRules.maxPointsPerEnd}`,
      suggestion: `Reduce points to maximum of ${formatRules.maxPointsPerEnd} for ${format} format`
    })
  }
  
  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Validate boule count for game format
 */
export function validateBouleCount(bouleCount: number, teamId: string, format: GameFormat): RuleCheck {
  const violations: RuleViolation[] = []
  const formatRules = GAME_FORMAT_RULES[format]
  const expectedBoules = formatRules.playersPerTeam * formatRules.boulesPerPlayer
  
  if (bouleCount > expectedBoules) {
    violations.push({
      rule: 'MAX_BOULES_PER_TEAM',
      severity: 'error',
      description: `Team has ${bouleCount} boules but maximum for ${format} is ${expectedBoules}`,
      suggestion: `Remove excess boules to match ${format} format (${expectedBoules} boules per team)`
    })
  }
  
  if (bouleCount < expectedBoules) {
    violations.push({
      rule: 'INSUFFICIENT_BOULES',
      severity: 'warning',
      description: `Team has only ${bouleCount} boules but ${format} format expects ${expectedBoules}`,
      suggestion: `Add missing boules to reach expected ${expectedBoules} boules per team`
    })
  }
  
  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Validate game completion rules
 */
export function validateGameCompletion(team1Score: number, team2Score: number, isComplete: boolean): RuleCheck {
  const violations: RuleViolation[] = []
  
  const hasWinner = team1Score === PETANQUE_RULES.MAX_GAME_POINTS || team2Score === PETANQUE_RULES.MAX_GAME_POINTS
  
  if (isComplete && !hasWinner) {
    violations.push({
      rule: 'GAME_COMPLETION',
      severity: 'error',
      description: 'Game marked complete but no team has reached 13 points',
      suggestion: 'Game can only be complete when one team reaches 13 points'
    })
  }
  
  if (!isComplete && hasWinner) {
    violations.push({
      rule: 'GAME_MUST_END',
      severity: 'error',
      description: 'Game must be marked complete when a team reaches 13 points',
      suggestion: 'Mark game as complete when a team reaches 13 points'
    })
  }
  
  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Create default scoring configuration for a game format
 */
export function createDefaultScoringConfiguration(format: GameFormat): ScoringConfiguration {
  const formatRules = GAME_FORMAT_RULES[format]
  
  return {
    gameFormat: format,
    maxPoints: PETANQUE_RULES.MAX_GAME_POINTS,
    maxPointsPerEnd: formatRules.maxPointsPerEnd,
    measurementPrecision: PETANQUE_RULES.MEASUREMENT_PRECISION,
    courtDimensions: {
      length: PETANQUE_RULES.STANDARD_COURT_LENGTH,
      width: formatRules.recommendedCourtWidth,
      throwingDistance: PETANQUE_RULES.MIN_THROWING_DISTANCE
    },
    shortForm: false,
    tiebreakRules: 'sudden_death',
    jackValidZone: {
      minDistance: PETANQUE_RULES.MIN_THROWING_DISTANCE,
      maxDistance: PETANQUE_RULES.MAX_THROWING_DISTANCE
    }
  }
}

/**
 * Get maximum boules per team for a game format
 */
export function getMaxBoulesPerTeam(format: GameFormat): number {
  const formatRules = GAME_FORMAT_RULES[format]
  return formatRules.playersPerTeam * formatRules.boulesPerPlayer
}

/**
 * Check if a score difference indicates a dominant win
 */
export function isDominantWin(winnerScore: number, loserScore: number): boolean {
  return winnerScore === PETANQUE_RULES.MAX_GAME_POINTS && loserScore <= 5
}

/**
 * Check if a score difference indicates a close game
 */
export function isCloseGame(winnerScore: number, loserScore: number): boolean {
  return winnerScore === PETANQUE_RULES.MAX_GAME_POINTS && loserScore >= 10
}

/**
 * Get game type classification based on final score
 */
export function classifyGame(winnerScore: number, loserScore: number): 'dominant' | 'comfortable' | 'competitive' | 'close' {
  if (isDominantWin(winnerScore, loserScore)) return 'dominant'
  if (loserScore <= 8) return 'comfortable'
  if (isCloseGame(winnerScore, loserScore)) return 'close'
  return 'competitive'
}

/**
 * Export all rule validation and configuration functions
 */
export const PetanqueRules = {
  PETANQUE_RULES,
  GAME_FORMAT_RULES,
  validateGameFormat,
  validateCourtDimensions,
  validateScore,
  validateEndPoints,
  validateBouleCount,
  validateGameCompletion,
  createDefaultScoringConfiguration,
  getMaxBoulesPerTeam,
  isDominantWin,
  isCloseGame,
  classifyGame
} as const