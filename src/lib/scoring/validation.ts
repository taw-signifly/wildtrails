import { Match, Score, End, GameFormat } from '@/types'
import { ScoreValidationResult, RuleViolation, ScoreIntegrityCheck, ValidationOptions } from '@/types/scoring'
import { 
  PETANQUE_RULES, 
  GAME_FORMAT_RULES,
  validateScore,
  validateEndPoints,
  validateGameCompletion,
  validateBouleCount 
} from './rules'

/**
 * Advanced validation system for Petanque scoring
 * Extends basic validation with comprehensive rule enforcement and integrity checking
 */

/**
 * Comprehensive validation of match score and progression
 * @param match Match to validate
 * @param options Validation options
 * @returns Detailed validation result
 */
export function validateMatchScore(
  match: Match,
  options: ValidationOptions = {}
): ScoreValidationResult {
  const {
    strict = true,
    allowManualOverrides = false,
    validateProgression = true,
    checkIntegrity = true
  } = options

  const violations: RuleViolation[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  // Basic score validation
  const basicScoreValidation = validateScore(match.score.team1, match.score.team2)
  if (!basicScoreValidation.valid) {
    violations.push(...basicScoreValidation.violations)
    errors.push(...basicScoreValidation.violations.filter(v => v.severity === 'error').map(v => v.description))
  }

  // Game completion validation
  const completionValidation = validateGameCompletion(
    match.score.team1, 
    match.score.team2, 
    match.score.isComplete
  )
  if (!completionValidation.valid) {
    violations.push(...completionValidation.violations)
    errors.push(...completionValidation.violations.filter(v => v.severity === 'error').map(v => v.description))
  }

  // End-by-end validation
  const endValidation = validateEndProgression(match.ends, match.score, match.format || 'triples')
  violations.push(...endValidation.violations)
  errors.push(...endValidation.errors)
  warnings.push(...endValidation.warnings)
  suggestions.push(...endValidation.suggestions)

  // Score integrity checks
  let scoreIntegrity: ScoreIntegrityCheck = {
    scoreSumMatches: true,
    progressionLogical: true,
    endCountReasonable: true,
    noImpossibleJumps: true
  }

  if (checkIntegrity) {
    scoreIntegrity = performScoreIntegrityCheck(match)
    
    if (!scoreIntegrity.scoreSumMatches) {
      errors.push('Match score does not equal sum of end points')
      violations.push({
        rule: 'SCORE_SUM_INTEGRITY',
        severity: 'error',
        description: 'Match score must equal the sum of end points',
        suggestion: 'Recalculate match score from end-by-end results'
      })
    }
    
    if (!scoreIntegrity.progressionLogical) {
      warnings.push('Score progression appears illogical')
      violations.push({
        rule: 'LOGICAL_PROGRESSION',
        severity: 'warning',
        description: 'Score progression has unusual patterns',
        suggestion: 'Review end-by-end scoring for accuracy'
      })
    }
    
    if (!scoreIntegrity.endCountReasonable) {
      warnings.push('Unusual number of ends for this score')
      violations.push({
        rule: 'REASONABLE_END_COUNT',
        severity: 'warning',
        description: 'Number of ends is unusual for the final score',
        suggestion: 'Verify all ends were recorded correctly'
      })
    }
    
    if (!scoreIntegrity.noImpossibleJumps) {
      errors.push('Impossible score jumps detected')
      violations.push({
        rule: 'NO_IMPOSSIBLE_JUMPS',
        severity: 'error',
        description: 'Score increases exceed maximum points per end',
        suggestion: 'Review end scoring - maximum 6 points per end in most formats'
      })
    }
  }

  // Match status validation
  const statusValidation = validateMatchStatus(match)
  violations.push(...statusValidation.violations)
  if (statusValidation.violations.some(v => v.severity === 'error')) {
    errors.push(...statusValidation.violations.filter(v => v.severity === 'error').map(v => v.description))
  }

  // Tournament context validation (if applicable)
  if (strict) {
    const contextValidation = validateTournamentContext(match)
    violations.push(...contextValidation.violations)
    warnings.push(...contextValidation.violations.filter(v => v.severity === 'warning').map(v => v.description))
  }

  // Performance validation (unusual scores, durations, etc.)
  const performanceValidation = validatePerformanceMetrics(match)
  violations.push(...performanceValidation.violations)
  warnings.push(...performanceValidation.violations.map(v => v.description))

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    ruleViolations: violations,
    scoreIntegrity
  }
}

/**
 * Validate end progression and scoring patterns
 * @param ends Array of ends
 * @param finalScore Final match score
 * @param format Game format
 * @returns Validation result with progression analysis
 */
export function validateEndProgression(
  ends: End[],
  finalScore: Score,
  format: GameFormat
): {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  violations: RuleViolation[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  const violations: RuleViolation[] = []

  if (ends.length === 0) {
    if (finalScore.team1 > 0 || finalScore.team2 > 0) {
      errors.push('No ends recorded but final score is not 0-0')
      violations.push({
        rule: 'ENDS_REQUIRED',
        severity: 'error',
        description: 'Ends must be recorded for non-zero scores',
        suggestion: 'Add end-by-end scoring details'
      })
    }
    return { valid: true, errors, warnings, suggestions, violations }
  }

  // Validate individual ends
  for (let i = 0; i < ends.length; i++) {
    const end = ends[i]
    
    // End number sequence
    if (end.endNumber !== i + 1) {
      warnings.push(`End ${i + 1} has incorrect end number: ${end.endNumber}`)
      violations.push({
        rule: 'SEQUENTIAL_END_NUMBERS',
        severity: 'warning',
        description: `End numbers should be sequential (expected ${i + 1}, got ${end.endNumber})`,
        suggestion: 'Correct end numbering sequence'
      })
    }
    
    // End points validation
    const endPointValidation = validateEndPoints(end.points, format)
    if (!endPointValidation.valid) {
      violations.push(...endPointValidation.violations.map(v => ({
        ...v,
        description: `End ${end.endNumber}: ${v.description}`
      })))
      errors.push(...endPointValidation.violations.filter(v => v.severity === 'error').map(v => v.description))
    }
    
    // Boule count validation for the end
    const maxBoulesPerTeam = GAME_FORMAT_RULES[format].playersPerTeam * GAME_FORMAT_RULES[format].boulesPerPlayer
    const teamBouleCounts = new Map<string, number>()
    
    for (const boule of end.boules) {
      teamBouleCounts.set(boule.teamId, (teamBouleCounts.get(boule.teamId) || 0) + 1)
    }
    
    for (const [teamId, count] of teamBouleCounts) {
      if (count > maxBoulesPerTeam) {
        errors.push(`End ${end.endNumber}: Team ${teamId} has ${count} boules (max ${maxBoulesPerTeam} for ${format})`)
        violations.push({
          rule: 'MAX_BOULES_PER_END',
          severity: 'error',
          description: `Too many boules for team in end ${end.endNumber}`,
          suggestion: `Maximum ${maxBoulesPerTeam} boules per team in ${format} format`
        })
      }
    }
  }

  // Validate score calculation
  const calculatedScore = calculateScoreFromEnds(ends)
  if (calculatedScore.team1 !== finalScore.team1 || calculatedScore.team2 !== finalScore.team2) {
    errors.push('Final score does not match sum of end points')
    violations.push({
      rule: 'SCORE_CALCULATION',
      severity: 'error',
      description: `Calculated score (${calculatedScore.team1}-${calculatedScore.team2}) doesn't match final score (${finalScore.team1}-${finalScore.team2})`,
      suggestion: 'Recalculate final score from end results'
    })
  }

  // Check for logical progression
  const progression = analyzeScoreProgression(ends)
  if (progression.hasImpossibleJumps) {
    errors.push('Score progression contains impossible jumps')
    violations.push({
      rule: 'IMPOSSIBLE_PROGRESSION',
      severity: 'error',
      description: 'Score increases exceed maximum possible points per end',
      suggestion: 'Review end scoring for errors'
    })
  }

  if (progression.hasUnusualPatterns) {
    warnings.push('Unusual scoring patterns detected')
    violations.push({
      rule: 'UNUSUAL_PATTERN',
      severity: 'warning',
      description: 'Scoring pattern is statistically unusual',
      suggestion: 'Verify accuracy of recorded scores'
    })
  }

  // Check game length reasonableness
  const expectedMinEnds = Math.max(Math.ceil(PETANQUE_RULES.MAX_GAME_POINTS / PETANQUE_RULES.MAX_END_POINTS), 3)
  const expectedMaxEnds = PETANQUE_RULES.MAX_GAME_POINTS * 2  // Very conservative upper bound

  if (ends.length < expectedMinEnds) {
    suggestions.push(`Game ended quickly (${ends.length} ends) - verify score accuracy`)
  } else if (ends.length > expectedMaxEnds) {
    warnings.push(`Unusually long game (${ends.length} ends)`)
    violations.push({
      rule: 'REASONABLE_GAME_LENGTH',
      severity: 'warning',
      description: 'Game length is unusually long for Petanque',
      suggestion: 'Verify all ends were necessary and correctly scored'
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    violations
  }
}

/**
 * Perform comprehensive score integrity check
 * @param match Match to check
 * @returns Integrity check results
 */
export function performScoreIntegrityCheck(match: Match): ScoreIntegrityCheck {
  const calculatedScore = calculateScoreFromEnds(match.ends)
  const scoreSumMatches = (
    calculatedScore.team1 === match.score.team1 &&
    calculatedScore.team2 === match.score.team2
  )

  const progression = analyzeScoreProgression(match.ends)
  const progressionLogical = !progression.hasImpossibleJumps && !progression.hasSuspiciousGaps

  // Check if end count is reasonable for the score
  const maxScore = Math.max(match.score.team1, match.score.team2)
  const minExpectedEnds = Math.ceil(maxScore / PETANQUE_RULES.MAX_END_POINTS)
  const maxExpectedEnds = maxScore * 2  // Very liberal upper bound
  const endCountReasonable = (
    match.ends.length >= minExpectedEnds && 
    match.ends.length <= maxExpectedEnds
  )

  const noImpossibleJumps = !progression.hasImpossibleJumps

  return {
    scoreSumMatches,
    progressionLogical,
    endCountReasonable,
    noImpossibleJumps
  }
}

/**
 * Calculate match score from end results
 * @param ends Array of ends
 * @returns Calculated score
 */
function calculateScoreFromEnds(ends: End[]): Score {
  let team1Score = 0
  let team2Score = 0

  // Group ends by winner and sum points
  const scoreMap = new Map<string, number>()

  for (const end of ends) {
    const currentScore = scoreMap.get(end.winner) || 0
    scoreMap.set(end.winner, currentScore + end.points)
  }

  // Assign scores based on team IDs
  // Note: This requires knowing which team ID corresponds to team1/team2
  // In practice, this would be passed as a parameter or determined from match context
  const teamIds = Array.from(scoreMap.keys())
  if (teamIds.length >= 1) {
    team1Score = scoreMap.get(teamIds[0]) || 0
  }
  if (teamIds.length >= 2) {
    team2Score = scoreMap.get(teamIds[1]) || 0
  }

  const isComplete = team1Score === PETANQUE_RULES.MAX_GAME_POINTS || team2Score === PETANQUE_RULES.MAX_GAME_POINTS

  return { team1: team1Score, team2: team2Score, isComplete }
}

/**
 * Analyze score progression for patterns and anomalies
 * @param ends Array of ends
 * @returns Progression analysis
 */
function analyzeScoreProgression(ends: End[]): {
  hasImpossibleJumps: boolean
  hasUnusualPatterns: boolean
  hasSuspiciousGaps: boolean
  avgPointsPerEnd: number
  maxPointsInSingleEnd: number
} {
  if (ends.length === 0) {
    return {
      hasImpossibleJumps: false,
      hasUnusualPatterns: false,
      hasSuspiciousGaps: false,
      avgPointsPerEnd: 0,
      maxPointsInSingleEnd: 0
    }
  }

  let hasImpossibleJumps = false
  let hasUnusualPatterns = false
  let hasSuspiciousGaps = false
  let totalPoints = 0
  let maxPointsInSingleEnd = 0

  // Track cumulative scores
  const team1Progression: number[] = [0]
  const team2Progression: number[] = [0]
  const teamIds = new Set(ends.map(e => e.winner))
  const [team1Id, team2Id] = Array.from(teamIds)

  for (const end of ends) {
    totalPoints += end.points
    maxPointsInSingleEnd = Math.max(maxPointsInSingleEnd, end.points)

    // Check for impossible point values
    if (end.points > PETANQUE_RULES.MAX_END_POINTS || end.points < PETANQUE_RULES.MIN_END_POINTS) {
      hasImpossibleJumps = true
    }

    // Update progression arrays
    const lastTeam1Score = team1Progression[team1Progression.length - 1]
    const lastTeam2Score = team2Progression[team2Progression.length - 1]

    if (end.winner === team1Id) {
      team1Progression.push(lastTeam1Score + end.points)
      team2Progression.push(lastTeam2Score)
    } else {
      team1Progression.push(lastTeam1Score)
      team2Progression.push(lastTeam2Score + end.points)
    }
  }

  // Check for unusual patterns
  const avgPointsPerEnd = totalPoints / ends.length
  if (avgPointsPerEnd > 4) {  // Unusually high average
    hasUnusualPatterns = true
  }

  // Check for suspicious gaps (large score differences developing too quickly)
  for (let i = 1; i < team1Progression.length; i++) {
    const team1Score = team1Progression[i]
    const team2Score = team2Progression[i]
    const scoreDiff = Math.abs(team1Score - team2Score)
    
    // If score difference is more than 6 points early in the game, flag as unusual
    if (i <= 3 && scoreDiff > 6) {
      hasUnusualPatterns = true
    }
    
    // Check for very long periods without scoring
    if (i > 5) {
      const recentEnds = ends.slice(Math.max(0, i - 5), i)
      const winnerCounts = new Map<string, number>()
      recentEnds.forEach(end => {
        winnerCounts.set(end.winner, (winnerCounts.get(end.winner) || 0) + 1)
      })
      
      // If one team won all recent ends, might be suspicious
      if (winnerCounts.size === 1 && recentEnds.length >= 5) {
        hasSuspiciousGaps = true
      }
    }
  }

  return {
    hasImpossibleJumps,
    hasUnusualPatterns,
    hasSuspiciousGaps,
    avgPointsPerEnd,
    maxPointsInSingleEnd
  }
}

/**
 * Validate match status consistency
 * @param match Match to validate
 * @returns Status validation result
 */
function validateMatchStatus(match: Match): { valid: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = []

  // Check status consistency with score
  if (match.status === 'completed') {
    if (!match.score.isComplete) {
      violations.push({
        rule: 'COMPLETED_MATCH_SCORE',
        severity: 'error',
        description: 'Completed match must have complete score',
        suggestion: 'Mark score as complete or change match status'
      })
    }
    
    if (!match.winner) {
      violations.push({
        rule: 'COMPLETED_MATCH_WINNER',
        severity: 'error',
        description: 'Completed match must have a winner',
        suggestion: 'Set match winner or change match status'
      })
    }
    
    if (!match.endTime) {
      violations.push({
        rule: 'COMPLETED_MATCH_END_TIME',
        severity: 'warning',
        description: 'Completed match should have an end time',
        suggestion: 'Record match completion time'
      })
    }
  }

  // Check active match consistency
  if (match.status === 'active') {
    if (match.score.isComplete) {
      violations.push({
        rule: 'ACTIVE_MATCH_INCOMPLETE_SCORE',
        severity: 'error',
        description: 'Active match cannot have complete score',
        suggestion: 'Complete the match or mark score as incomplete'
      })
    }
    
    if (!match.startTime) {
      violations.push({
        rule: 'ACTIVE_MATCH_START_TIME',
        severity: 'warning',
        description: 'Active match should have a start time',
        suggestion: 'Record match start time'
      })
    }
  }

  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations
  }
}

/**
 * Validate tournament context (placeholder for tournament-specific rules)
 * @param match Match to validate
 * @returns Context validation result
 */
function validateTournamentContext(match: Match): { violations: RuleViolation[] } {
  const violations: RuleViolation[] = []

  // Tournament-specific validations would go here
  // For example: bracket progression rules, seeding consistency, etc.

  return { violations }
}

/**
 * Validate performance metrics for unusual values
 * @param match Match to validate
 * @returns Performance validation result
 */
function validatePerformanceMetrics(match: Match): { violations: RuleViolation[] } {
  const violations: RuleViolation[] = []

  // Check match duration
  if (match.duration) {
    if (match.duration < 5) {  // 5 minutes seems too short
      violations.push({
        rule: 'UNUSUALLY_SHORT_MATCH',
        severity: 'warning',
        description: 'Match duration is unusually short',
        suggestion: 'Verify match timing is correct'
      })
    }
    
    if (match.duration > 180) {  // 3 hours seems very long
      violations.push({
        rule: 'UNUSUALLY_LONG_MATCH',
        severity: 'warning',
        description: 'Match duration is unusually long',
        suggestion: 'Verify match timing and check for interruptions'
      })
    }
  }

  // Check score patterns
  const totalScore = match.score.team1 + match.score.team2
  if (totalScore < 13) {
    violations.push({
      rule: 'LOW_TOTAL_SCORE',
      severity: 'warning',
      description: 'Total score is unusually low for a complete game',
      suggestion: 'Verify game completion and scoring accuracy'
    })
  }

  return { violations }
}

/**
 * Export all validation functions
 */
export const AdvancedValidation = {
  validateMatchScore,
  validateEndProgression,
  performScoreIntegrityCheck
} as const