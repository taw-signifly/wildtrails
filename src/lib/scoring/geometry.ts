import { Position, CourtDimensions, Boule } from '@/types'
import { RelativePosition, DistanceCalculationResult } from '@/types/scoring'
import { AdvancedCache } from './cache'
import { createGeometryError } from './errors'

/**
 * Geometry and distance calculation utilities for Petanque scoring
 * Handles coordinate system operations, distance measurements, and position validation
 * Includes memoization for performance optimization
 */

// Constants for Petanque court and equipment dimensions
export const COURT_CONSTANTS = {
  STANDARD_LENGTH: 15,      // meters
  STANDARD_WIDTH: 4,        // meters
  MIN_THROWING_DISTANCE: 6, // meters
  MAX_THROWING_DISTANCE: 10, // meters
  JACK_DIAMETER: 3,         // cm
  BOULE_DIAMETER: 7.5,      // cm
  MEASUREMENT_PRECISION: 0.1, // cm
  MEASUREMENT_THRESHOLD: 2,   // cm - when physical measurement needed
} as const

// Memoization cache for distance calculations
const distanceCache = new AdvancedCache<number>({
  maxSize: 10000,
  ttl: 10 * 60 * 1000, // 10 minutes
  maxMemoryMB: 50,
  enableMetrics: true,
  evictionPolicy: 'lru'
})

/**
 * Generate cache key for position pair
 */
function getDistanceCacheKey(pos1: Position, pos2: Position): string {
  // Normalize positions to ensure consistent keys for equivalent positions
  const x1 = Math.round(pos1.x * 1000) / 1000
  const y1 = Math.round(pos1.y * 1000) / 1000
  const x2 = Math.round(pos2.x * 1000) / 1000
  const y2 = Math.round(pos2.y * 1000) / 1000
  
  // Create deterministic key regardless of order
  if (x1 < x2 || (x1 === x2 && y1 <= y2)) {
    return `${x1},${y1}-${x2},${y2}`
  } else {
    return `${x2},${y2}-${x1},${y1}`
  }
}

/**
 * Calculate Euclidean distance between two positions with memoization
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Distance in meters, converted to cm for precision
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  try {
    // Validate input positions
    if (!isValidPosition(pos1) || !isValidPosition(pos2)) {
      throw createGeometryError(
        'Invalid position coordinates provided',
        'calculate_distance',
        { pos1, pos2 }
      )
    }

    const cacheKey = getDistanceCacheKey(pos1, pos2)
    
    // Check cache first
    const cached = distanceCache.get(cacheKey)
    if (cached !== null) {
      return cached
    }

    // Calculate distance
    const deltaX = pos2.x - pos1.x
    const deltaY = pos2.y - pos1.y
    const distanceInMeters = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // Convert to centimeters for scoring precision
    const result = Math.round(distanceInMeters * 100 * 10) / 10  // Round to 0.1cm precision
    
    // Cache the result
    distanceCache.set(cacheKey, result)
    
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'GeometryError') {
      throw error
    }
    throw createGeometryError(
      `Distance calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'calculate_distance',
      { pos1, pos2 }
    )
  }
}

/**
 * Validate position coordinates
 */
function isValidPosition(pos: Position): boolean {
  return (
    typeof pos === 'object' &&
    pos !== null &&
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    !isNaN(pos.x) &&
    !isNaN(pos.y) &&
    isFinite(pos.x) &&
    isFinite(pos.y)
  )
}

/**
 * Calculate distance between boule and jack positions with high precision
 * @param boule Boule position
 * @param jack Jack position
 * @returns Distance calculation result with confidence metrics
 */
export function calculateBouleDistance(
  boule: Position, 
  jack: Position
): DistanceCalculationResult {
  const distance = calculateDistance(boule, jack)
  
  // Calculate confidence based on distance precision
  // Closer measurements are more confident due to less accumulated error
  const confidence = Math.max(0.5, Math.min(1.0, 1 - (distance / 1000)))
  
  return {
    distance,
    confidence,
    method: 'euclidean',
    precision: COURT_CONSTANTS.MEASUREMENT_PRECISION
  }
}

/**
 * Check if a position is within valid court boundaries
 * @param position Position to validate
 * @param courtDimensions Court dimensions
 * @returns True if position is valid
 */
export function isValidCourtPosition(
  position: Position, 
  courtDimensions: CourtDimensions
): boolean {
  return (
    position.x >= 0 && position.x <= courtDimensions.length &&
    position.y >= 0 && position.y <= courtDimensions.width
  )
}

/**
 * Validate jack position according to Petanque rules
 * @param jackPosition Jack position
 * @param throwingCircle Position of throwing circle
 * @param courtDimensions Court dimensions
 * @returns True if jack position is valid
 */
export function isValidJackPosition(
  jackPosition: Position,
  throwingCircle: Position,
  courtDimensions: CourtDimensions
): boolean {
  if (!isValidCourtPosition(jackPosition, courtDimensions)) {
    return false
  }
  
  const distanceFromThrowingCircle = calculateDistance(jackPosition, throwingCircle)
  const distanceInMeters = distanceFromThrowingCircle / 100
  
  return (
    distanceInMeters >= COURT_CONSTANTS.MIN_THROWING_DISTANCE &&
    distanceInMeters <= COURT_CONSTANTS.MAX_THROWING_DISTANCE
  )
}

/**
 * Normalize position coordinates to ensure consistency
 * @param position Position to normalize
 * @returns Normalized position with rounded coordinates
 */
export function normalizePosition(position: Position): Position {
  return {
    x: Math.round(position.x * 100) / 100,  // Round to cm precision
    y: Math.round(position.y * 100) / 100
  }
}

/**
 * Get relative position of one point from another
 * @param target Target position
 * @param reference Reference position
 * @returns Relative position with distance and bearing
 */
export function getRelativePosition(
  target: Position, 
  reference: Position
): RelativePosition {
  const deltaX = target.x - reference.x
  const deltaY = target.y - reference.y
  const distance = calculateDistance(target, reference)
  
  // Calculate bearing in degrees (0 = north, 90 = east)
  let bearing = Math.atan2(deltaX, deltaY) * (180 / Math.PI)
  if (bearing < 0) bearing += 360
  
  // Determine quadrant
  let quadrant: 'NE' | 'NW' | 'SE' | 'SW'
  if (deltaX >= 0 && deltaY >= 0) quadrant = 'NE'
  else if (deltaX < 0 && deltaY >= 0) quadrant = 'NW'
  else if (deltaX >= 0 && deltaY < 0) quadrant = 'SE'
  else quadrant = 'SW'
  
  return {
    distance,
    bearing,
    quadrant
  }
}

/**
 * Find the closest boule to the jack
 * @param boules Array of boules
 * @param jack Jack position
 * @returns Closest boule or null if no boules
 */
export function findClosestBoule(boules: Boule[], jack: Position): Boule | null {
  if (boules.length === 0) return null
  
  let closest = boules[0]
  let closestDistance = calculateDistance(closest.position, jack)
  
  for (let i = 1; i < boules.length; i++) {
    const distance = calculateDistance(boules[i].position, jack)
    if (distance < closestDistance) {
      closest = boules[i]
      closestDistance = distance
    }
  }
  
  return closest
}

/**
 * Find the closest boule for each team
 * @param boules Array of boules
 * @param jack Jack position
 * @returns Map of team ID to closest boule
 */
export function findClosestBoulePerTeam(
  boules: Boule[], 
  jack: Position
): Map<string, { boule: Boule; distance: number }> {
  const teamClosest = new Map<string, { boule: Boule; distance: number }>()
  
  for (const boule of boules) {
    const distance = calculateDistance(boule.position, jack)
    const current = teamClosest.get(boule.teamId)
    
    if (!current || distance < current.distance) {
      teamClosest.set(boule.teamId, { boule, distance })
    }
  }
  
  return teamClosest
}

/**
 * Sort boules by distance from jack (closest first)
 * @param boules Array of boules
 * @param jack Jack position
 * @returns Sorted array of boules with distance calculations
 */
export function sortBoulesByDistance(
  boules: Boule[], 
  jack: Position
): Array<{ boule: Boule; distance: number }> {
  return boules
    .map(boule => ({
      boule,
      distance: calculateDistance(boule.position, jack)
    }))
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Find all boules within a certain radius of a center point
 * @param boules Array of boules
 * @param center Center position
 * @param radius Radius in cm
 * @returns Boules within the radius
 */
export function calculateBoulesInRadius(
  boules: Boule[], 
  center: Position, 
  radius: number
): Array<{ boule: Boule; distance: number }> {
  return boules
    .map(boule => ({
      boule,
      distance: calculateDistance(boule.position, center)
    }))
    .filter(({ distance }) => distance <= radius)
}

/**
 * Check if two distances are within measurement threshold
 * @param distance1 First distance in cm
 * @param distance2 Second distance in cm
 * @param threshold Threshold in cm (default: 2cm)
 * @returns True if distances require physical measurement
 */
export function requiresMeasurement(
  distance1: number, 
  distance2: number, 
  threshold: number = COURT_CONSTANTS.MEASUREMENT_THRESHOLD
): boolean {
  return Math.abs(distance1 - distance2) <= threshold
}

/**
 * Calculate the center point between multiple positions
 * @param positions Array of positions
 * @returns Center position
 */
export function calculateCenterPoint(positions: Position[]): Position {
  if (positions.length === 0) {
    throw new Error('Cannot calculate center of empty position array')
  }
  
  const sum = positions.reduce(
    (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
    { x: 0, y: 0 }
  )
  
  return normalizePosition({
    x: sum.x / positions.length,
    y: sum.y / positions.length
  })
}

/**
 * Calculate the minimum bounding rectangle for a set of positions
 * @param positions Array of positions
 * @returns Bounding rectangle with min/max coordinates
 */
export function calculateBoundingRectangle(positions: Position[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
} {
  if (positions.length === 0) {
    throw new Error('Cannot calculate bounding rectangle of empty position array')
  }
  
  const minX = Math.min(...positions.map(p => p.x))
  const maxX = Math.max(...positions.map(p => p.x))
  const minY = Math.min(...positions.map(p => p.y))
  const maxY = Math.max(...positions.map(p => p.y))
  
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Check if a boule position conflicts with another boule (too close)
 * @param newBoule New boule position
 * @param existingBoules Existing boule positions
 * @param minDistance Minimum distance between boules in cm
 * @returns True if position conflicts
 */
export function hasBouleConflict(
  newBoule: Position,
  existingBoules: Position[],
  minDistance = COURT_CONSTANTS.BOULE_DIAMETER
): boolean {
  return existingBoules.some(existing => 
    calculateDistance(newBoule, existing) < minDistance
  )
}

/**
 * Generate a grid of measurement points around the jack for close calls
 * @param jack Jack position
 * @param radius Radius around jack to measure
 * @param precision Grid precision in cm
 * @returns Array of measurement positions
 */
export function generateMeasurementGrid(
  jack: Position,
  radius: number,
  precision = COURT_CONSTANTS.MEASUREMENT_PRECISION
): Position[] {
  const grid: Position[] = []
  const radiusInMeters = radius / 100
  const precisionInMeters = precision / 100
  
  for (let x = jack.x - radiusInMeters; x <= jack.x + radiusInMeters; x += precisionInMeters) {
    for (let y = jack.y - radiusInMeters; y <= jack.y + radiusInMeters; y += precisionInMeters) {
      const distance = calculateDistance({ x, y }, jack)
      if (distance <= radius) {
        grid.push(normalizePosition({ x, y }))
      }
    }
  }
  
  return grid
}

/**
 * Calculate the area covered by a set of boules (useful for analyzing play patterns)
 * @param boules Array of boule positions
 * @returns Area in square meters
 */
export function calculatePlayArea(boules: Position[]): number {
  if (boules.length < 3) return 0
  
  const bounds = calculateBoundingRectangle(boules)
  return bounds.width * bounds.height
}

/**
 * Find the optimal jack position for a given set of boules (for analysis)
 * @param boules Array of boule positions
 * @returns Optimal jack position that maximizes scoring opportunities
 */
export function findOptimalJackPosition(boules: Position[]): Position {
  if (boules.length === 0) {
    throw new Error('Cannot find optimal jack position with no boules')
  }
  
  // For simplicity, return the center point of all boules
  // In practice, this could be more sophisticated
  return calculateCenterPoint(boules)
}

/**
 * Clear geometry calculation cache
 */
export function clearGeometryCache(): void {
  distanceCache.clear()
}

/**
 * Get geometry cache metrics
 */
export function getGeometryMetrics() {
  return distanceCache.getMetrics()
}

/**
 * Warm up cache with common calculations
 */
export function warmupGeometryCache(positions: Position[]): void {
  const start = Date.now()
  let calculations = 0
  
  // Pre-calculate distances between all position pairs
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      calculateDistance(positions[i], positions[j])
      calculations++
    }
  }
  
  const duration = Date.now() - start
  console.log(`Geometry cache warmed up: ${calculations} calculations in ${duration}ms`)
}

/**
 * Export all geometry utility functions
 */
export const GeometryUtils = {
  calculateDistance,
  calculateBouleDistance,
  isValidCourtPosition,
  isValidJackPosition,
  normalizePosition,
  getRelativePosition,
  findClosestBoule,
  findClosestBoulePerTeam,
  sortBoulesByDistance,
  calculateBoulesInRadius,
  requiresMeasurement,
  calculateCenterPoint,
  calculateBoundingRectangle,
  hasBouleConflict,
  generateMeasurementGrid,
  calculatePlayArea,
  findOptimalJackPosition,
  clearGeometryCache,
  getGeometryMetrics,
  warmupGeometryCache,
  COURT_CONSTANTS
} as const