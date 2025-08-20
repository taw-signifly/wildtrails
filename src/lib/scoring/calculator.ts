import { Boule, Position, GameFormat } from '@/types'
import { EndScoreResult, EndMeasurement, ScoringConfiguration } from '@/types/scoring'
import { 
  calculateDistance, 
  findClosestBoulePerTeam, 
  sortBoulesByDistance, 
  requiresMeasurement,
  COURT_CONSTANTS 
} from './geometry'
import { PETANQUE_RULES, GAME_FORMAT_RULES, validateEndPoints } from './rules'

/**
 * End Scoring Calculator for Petanque
 * Implements official Petanque scoring rules to determine end winners and points
 */

export interface EndCalculationOptions {
  measurementThreshold?: number  // threshold for requiring physical measurement (cm)
  allowTies?: boolean           // whether to allow tied ends (usually false)
  requireAllBoules?: boolean    // whether all boules must be played
  debugMode?: boolean           // enable detailed calculation logging
}

export interface EndValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Calculate the score for an end based on boule positions
 * @param boules Array of all boules played in the end
 * @param jack Jack position
 * @param teamIds Array of team IDs participating
 * @param options Calculation options
 * @returns End score result with winner and points
 */
export function calculateEndScore(
  boules: Boule[],
  jack: Position,
  teamIds: string[],
  options: EndCalculationOptions = {}
): EndScoreResult {
  const {
    measurementThreshold = COURT_CONSTANTS.MEASUREMENT_THRESHOLD,
    allowTies = false,
    debugMode = false
  } = options

  // Validate inputs
  const validation = validateEndConfiguration(boules, jack, teamIds)
  if (!validation.valid) {
    throw new Error(`Invalid end configuration: ${validation.errors.join(', ')}`)
  }

  // Calculate distances for all boules
  const measurements: EndMeasurement[] = boules.map(boule => {
    const distance = calculateDistance(boule.position, jack)
    return {
      bouleId: boule.id,
      distanceFromJack: distance,
      teamId: boule.teamId,
      isClosest: false,  // Will be determined below
      isScoring: false,  // Will be determined below
      measurementType: 'calculated',
      precision: COURT_CONSTANTS.MEASUREMENT_PRECISION
    }
  })

  // Sort measurements by distance (closest first)
  measurements.sort((a, b) => a.distanceFromJack - b.distanceFromJack)

  // Find closest boule for each team
  const teamClosest = findClosestBoulePerTeam(boules, jack)
  const teamDistances = new Map<string, number>()
  
  for (const [teamId, closest] of teamClosest) {
    teamDistances.set(teamId, closest.distance)
    // Mark closest boule for each team
    const measurement = measurements.find(m => m.bouleId === closest.boule.id)
    if (measurement) {
      measurement.isClosest = true
    }
  }

  // Determine which team has the closest boule overall
  const overallClosest = measurements[0]
  const winningTeamId = overallClosest.teamId
  const closestDistance = overallClosest.distanceFromJack

  // Find the closest opposing boule
  const opposingBoules = measurements.filter(m => m.teamId !== winningTeamId)
  const closestOpposingDistance = opposingBoules.length > 0 ? opposingBoules[0].distanceFromJack : Number.MAX_VALUE

  // Check if measurement is required
  const isCloseCall = requiresMeasurement(closestDistance, closestOpposingDistance, measurementThreshold)

  // Count scoring boules (all boules closer than opponent's closest)
  const scoringBoules: Boule[] = []
  let points = 0

  for (const measurement of measurements) {
    if (measurement.teamId === winningTeamId && measurement.distanceFromJack < closestOpposingDistance) {
      points++
      measurement.isScoring = true
      const boule = boules.find(b => b.id === measurement.bouleId)
      if (boule) scoringBoules.push(boule)
    }
  }

  // Validate points according to game format rules
  // For now, assume triples format (max 6 points) - this should be configurable
  if (points > PETANQUE_RULES.MAX_END_POINTS) {
    points = PETANQUE_RULES.MAX_END_POINTS
    // Also limit scoring boules to match the points
    scoringBoules.splice(PETANQUE_RULES.MAX_END_POINTS)
    // Update measurements to reflect the cap
    measurements.forEach((m, index) => {
      if (m.teamId === winningTeamId && m.isScoring && index >= PETANQUE_RULES.MAX_END_POINTS) {
        m.isScoring = false
      }
    })
  }

  // Ensure at least 1 point for the winning team
  if (points === 0) {
    points = PETANQUE_RULES.MIN_END_POINTS
    // Mark the closest boule as scoring
    const closestMeasurement = measurements.find(m => m.bouleId === overallClosest.bouleId)
    if (closestMeasurement) {
      closestMeasurement.isScoring = true
      const boule = boules.find(b => b.id === overallClosest.bouleId)
      if (boule) scoringBoules.push(boule)
    }
  }

  // Calculate confidence based on measurement clarity
  const distanceDifference = Math.abs(closestDistance - closestOpposingDistance)
  const confidence = Math.min(1.0, Math.max(0.1, distanceDifference / measurementThreshold))

  // Generate human-readable summary
  const endSummary = generateEndSummary(winningTeamId, points, scoringBoules.length, isCloseCall)

  if (debugMode) {
    console.log('End Calculation Debug:', {
      jackPosition: jack,
      totalBoules: boules.length,
      measurements: measurements.map(m => ({ 
        bouleId: m.bouleId, 
        team: m.teamId, 
        distance: m.distanceFromJack,
        isScoring: m.isScoring 
      })),
      winner: winningTeamId,
      points,
      isCloseCall,
      confidence
    })
  }

  return {
    winner: winningTeamId,
    points,
    winningBoules: scoringBoules,
    measurements,
    isCloseCall,
    confidence,
    endSummary
  }
}

/**
 * Handle special case where distances are equal (rare but possible)
 * @param boules Array of boules
 * @param jack Jack position
 * @param teamIds Team IDs
 * @returns End score result handling the tie
 */
export function handleEqualDistances(
  boules: Boule[],
  jack: Position,
  teamIds: string[]
): EndScoreResult {
  // In official Petanque, if closest boules are exactly equal distance,
  // the end is replayed. For digital scoring, we'll require physical measurement.
  
  const measurements: EndMeasurement[] = boules.map(boule => ({
    bouleId: boule.id,
    distanceFromJack: calculateDistance(boule.position, jack),
    teamId: boule.teamId,
    isClosest: false,
    isScoring: false,
    measurementType: 'measured', // Require physical measurement
    precision: 0.1
  }))

  // Sort by distance
  measurements.sort((a, b) => a.distanceFromJack - b.distanceFromJack)

  // If top two are equal, this is a measurement scenario
  if (measurements.length >= 2 && 
      measurements[0].distanceFromJack === measurements[1].distanceFromJack) {
    
    return {
      winner: '', // No winner until measurement
      points: 0,
      winningBoules: [],
      measurements,
      isCloseCall: true,
      confidence: 0, // Zero confidence until physical measurement
      endSummary: 'End requires physical measurement due to equal distances'
    }
  }

  // Otherwise, calculate normally
  return calculateEndScore(boules, jack, teamIds)
}

/**
 * Handle jack displacement during the end
 * @param originalJack Original jack position
 * @param newJack New jack position after displacement
 * @param boules All boules in the end
 * @param teamIds Team IDs
 * @returns End score result with updated jack position
 */
export function handleJackDisplacement(
  originalJack: Position,
  newJack: Position,
  boules: Boule[],
  teamIds: string[]
): EndScoreResult {
  // Recalculate all distances from the new jack position
  const result = calculateEndScore(boules, newJack, teamIds)
  
  // Add note about jack displacement
  result.endSummary += ` (Jack displaced from original position)`
  
  // Reduce confidence slightly due to jack movement
  result.confidence = Math.max(0.5, result.confidence * 0.9)
  
  return result
}

/**
 * Validate end configuration before scoring
 * @param boules Array of boules
 * @param jack Jack position
 * @param teamIds Team IDs
 * @returns Validation result
 */
export function validateEndConfiguration(
  boules: Boule[],
  jack: Position,
  teamIds: string[]
): EndValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check minimum requirements
  if (boules.length === 0) {
    errors.push('At least one boule must be played to score an end')
  }

  if (teamIds.length < 2) {
    errors.push('At least two teams must participate in an end')
  }

  // Validate jack position
  if (!jack || typeof jack.x !== 'number' || typeof jack.y !== 'number') {
    errors.push('Valid jack position is required')
  }

  // Check boule distribution
  const teamBouleCounts = new Map<string, number>()
  for (const boule of boules) {
    if (!boule.teamId || !teamIds.includes(boule.teamId)) {
      errors.push(`Boule ${boule.id} belongs to team not in game`)
    }
    teamBouleCounts.set(boule.teamId, (teamBouleCounts.get(boule.teamId) || 0) + 1)
  }

  // Warn if teams have very unequal boule counts
  const bouleCounts = Array.from(teamBouleCounts.values())
  if (bouleCounts.length > 1) {
    const maxBoules = Math.max(...bouleCounts)
    const minBoules = Math.min(...bouleCounts)
    if (maxBoules - minBoules > 2) {
      warnings.push('Teams have significantly different numbers of boules played')
    }
  }

  // Check for duplicate boule IDs
  const bouleIds = boules.map(b => b.id)
  const uniqueIds = new Set(bouleIds)
  if (uniqueIds.size !== bouleIds.length) {
    errors.push('Duplicate boule IDs detected')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Determine end winner without full calculation (quick check)
 * @param boules Array of boules
 * @param jack Jack position
 * @returns Team ID of the winner
 */
export function determineEndWinner(boules: Boule[], jack: Position): string {
  if (boules.length === 0) return ''
  
  const sortedByDistance = sortBoulesByDistance(boules, jack)
  return sortedByDistance[0].boule.teamId
}

/**
 * Count scoring boules for a specific team
 * @param teamBoules Boules from the specific team
 * @param opponentBoules Boules from opponent teams
 * @param jack Jack position
 * @returns Number of scoring boules
 */
export function countScoringBoules(
  teamBoules: Boule[],
  opponentBoules: Boule[],
  jack: Position
): number {
  if (teamBoules.length === 0) return 0
  if (opponentBoules.length === 0) return Math.min(teamBoules.length, PETANQUE_RULES.MAX_END_POINTS)

  // Find closest opponent boule
  const opponentDistances = opponentBoules.map(boule => calculateDistance(boule.position, jack))
  const closestOpponentDistance = Math.min(...opponentDistances)

  // Count team boules closer than closest opponent
  let scoringCount = 0
  for (const boule of teamBoules) {
    const distance = calculateDistance(boule.position, jack)
    if (distance < closestOpponentDistance) {
      scoringCount++
    }
  }

  return Math.min(scoringCount, PETANQUE_RULES.MAX_END_POINTS)
}

/**
 * Generate human-readable end summary
 * @param winnerTeamId Winning team ID
 * @param points Points scored
 * @param boulesCount Number of scoring boules
 * @param isCloseCall Whether measurement was close
 * @returns Summary string
 */
function generateEndSummary(
  winnerTeamId: string,
  points: number,
  boulesCount: number,
  isCloseCall: boolean
): string {
  let summary = `Team ${winnerTeamId} wins ${points} point${points !== 1 ? 's' : ''}`
  
  if (boulesCount > 1) {
    summary += ` with ${boulesCount} boules`
  }
  
  if (isCloseCall) {
    summary += ' (close measurement)'
  }
  
  return summary
}

/**
 * Calculate end statistics for analysis
 * @param boules Array of boules
 * @param jack Jack position
 * @returns End statistics
 */
export function calculateEndStatistics(boules: Boule[], jack: Position): {
  averageDistance: number
  closestDistance: number
  farthestDistance: number
  distanceSpread: number
  boulesWithin1m: number
  boulesWithin50cm: number
} {
  if (boules.length === 0) {
    return {
      averageDistance: 0,
      closestDistance: 0,
      farthestDistance: 0,
      distanceSpread: 0,
      boulesWithin1m: 0,
      boulesWithin50cm: 0
    }
  }

  const distances = boules.map(boule => calculateDistance(boule.position, jack))
  
  const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
  const closestDistance = Math.min(...distances)
  const farthestDistance = Math.max(...distances)
  const distanceSpread = farthestDistance - closestDistance
  
  const boulesWithin1m = distances.filter(d => d <= 100).length // 100cm = 1m
  const boulesWithin50cm = distances.filter(d => d <= 50).length

  return {
    averageDistance: Math.round(averageDistance * 10) / 10,
    closestDistance: Math.round(closestDistance * 10) / 10,
    farthestDistance: Math.round(farthestDistance * 10) / 10,
    distanceSpread: Math.round(distanceSpread * 10) / 10,
    boulesWithin1m,
    boulesWithin50cm
  }
}

/**
 * Export all calculator functions
 */
export const EndCalculator = {
  calculateEndScore,
  handleEqualDistances,
  handleJackDisplacement,
  validateEndConfiguration,
  determineEndWinner,
  countScoringBoules,
  calculateEndStatistics
} as const