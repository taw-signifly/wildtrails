import { describe, test, expect } from '@jest/globals'
import {
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
  COURT_CONSTANTS
} from '../geometry'
import type { Position, Boule, CourtDimensions } from '@/types'

describe('Geometry Utilities', () => {
  describe('calculateDistance', () => {
    test('calculates distance between two points correctly', () => {
      const pos1: Position = { x: 0, y: 0 }
      const pos2: Position = { x: 3, y: 4 }
      
      // 3-4-5 triangle: distance should be 5 meters = 500 cm
      expect(calculateDistance(pos1, pos2)).toBe(500)
    })

    test('handles same point', () => {
      const pos1: Position = { x: 5, y: 5 }
      const pos2: Position = { x: 5, y: 5 }
      
      expect(calculateDistance(pos1, pos2)).toBe(0)
    })

    test('handles negative coordinates', () => {
      const pos1: Position = { x: -2, y: -1 }
      const pos2: Position = { x: 1, y: 3 }
      
      // Distance = sqrt((1-(-2))^2 + (3-(-1))^2) = sqrt(9 + 16) = 5 meters = 500 cm
      expect(calculateDistance(pos1, pos2)).toBe(500)
    })

    test('precision is correct to 0.1cm', () => {
      const pos1: Position = { x: 0, y: 0 }
      const pos2: Position = { x: 0.001, y: 0 }
      
      // 0.001 meters = 0.1 cm
      expect(calculateDistance(pos1, pos2)).toBe(0.1)
    })
  })

  describe('calculateBouleDistance', () => {
    test('returns distance calculation result with confidence', () => {
      const boule: Position = { x: 7, y: 2 }
      const jack: Position = { x: 10, y: 6 }
      
      const result = calculateBouleDistance(boule, jack)
      
      expect(result.distance).toBe(500) // 5 meters
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
      expect(result.confidence).toBeLessThanOrEqual(1.0)
      expect(result.method).toBe('euclidean')
      expect(result.precision).toBe(COURT_CONSTANTS.MEASUREMENT_PRECISION)
    })

    test('confidence decreases with distance', () => {
      const jack: Position = { x: 7.5, y: 2.5 }
      const closeBoule: Position = { x: 7.6, y: 2.5 }
      const farBoule: Position = { x: 12, y: 2.5 }
      
      const closeResult = calculateBouleDistance(closeBoule, jack)
      const farResult = calculateBouleDistance(farBoule, jack)
      
      expect(closeResult.confidence).toBeGreaterThan(farResult.confidence)
    })
  })

  describe('isValidCourtPosition', () => {
    const standardCourt: CourtDimensions = {
      length: 15,
      width: 4,
      throwingDistance: 8
    }

    test('accepts valid positions', () => {
      expect(isValidCourtPosition({ x: 7.5, y: 2 }, standardCourt)).toBe(true)
      expect(isValidCourtPosition({ x: 0, y: 0 }, standardCourt)).toBe(true)
      expect(isValidCourtPosition({ x: 15, y: 4 }, standardCourt)).toBe(true)
    })

    test('rejects out-of-bounds positions', () => {
      expect(isValidCourtPosition({ x: -1, y: 2 }, standardCourt)).toBe(false)
      expect(isValidCourtPosition({ x: 16, y: 2 }, standardCourt)).toBe(false)
      expect(isValidCourtPosition({ x: 7, y: -0.5 }, standardCourt)).toBe(false)
      expect(isValidCourtPosition({ x: 7, y: 4.1 }, standardCourt)).toBe(false)
    })
  })

  describe('isValidJackPosition', () => {
    const standardCourt: CourtDimensions = {
      length: 15,
      width: 4,
      throwingDistance: 8
    }
    const throwingCircle: Position = { x: 1, y: 2 }

    test('accepts valid jack positions', () => {
      const validJack: Position = { x: 8, y: 2 } // 7 meters from throwing circle
      expect(isValidJackPosition(validJack, throwingCircle, standardCourt)).toBe(true)
    })

    test('rejects jack too close to throwing circle', () => {
      const tooClose: Position = { x: 4, y: 2 } // 3 meters from throwing circle
      expect(isValidJackPosition(tooClose, throwingCircle, standardCourt)).toBe(false)
    })

    test('rejects jack too far from throwing circle', () => {
      const tooFar: Position = { x: 14, y: 2 } // 13 meters from throwing circle
      expect(isValidJackPosition(tooFar, throwingCircle, standardCourt)).toBe(false)
    })

    test('rejects jack outside court bounds', () => {
      const outsideCourt: Position = { x: 8, y: 5 } // Outside court width
      expect(isValidJackPosition(outsideCourt, throwingCircle, standardCourt)).toBe(false)
    })
  })

  describe('normalizePosition', () => {
    test('rounds coordinates to centimeter precision', () => {
      const position = normalizePosition({ x: 7.1234567, y: 2.9876543 })
      expect(position.x).toBe(7.12)
      expect(position.y).toBe(2.99)
    })

    test('handles already normalized positions', () => {
      const position = normalizePosition({ x: 5.00, y: 3.50 })
      expect(position.x).toBe(5.00)
      expect(position.y).toBe(3.50)
    })
  })

  describe('getRelativePosition', () => {
    test('calculates relative position correctly', () => {
      const target: Position = { x: 10, y: 5 }
      const reference: Position = { x: 7, y: 1 }
      
      const relative = getRelativePosition(target, reference)
      
      expect(relative.distance).toBe(500) // 5 meters
      expect(relative.quadrant).toBe('NE')
      expect(relative.bearing).toBeGreaterThan(0)
      expect(relative.bearing).toBeLessThan(90)
    })

    test('determines quadrants correctly', () => {
      const reference: Position = { x: 5, y: 5 }
      
      expect(getRelativePosition({ x: 6, y: 6 }, reference).quadrant).toBe('NE')
      expect(getRelativePosition({ x: 4, y: 6 }, reference).quadrant).toBe('NW')
      expect(getRelativePosition({ x: 6, y: 4 }, reference).quadrant).toBe('SE')
      expect(getRelativePosition({ x: 4, y: 4 }, reference).quadrant).toBe('SW')
    })
  })

  describe('findClosestBoule', () => {
    const jack: Position = { x: 7.5, y: 2.5 }
    const boules: Boule[] = [
      {
        id: 'b1',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.6, y: 2.5 }, // 10cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b2',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.8, y: 2.5 }, // 30cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b3',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.4, y: 2.5 }, // 10cm away
        distance: 0,
        order: 2
      }
    ]

    test('finds closest boule', () => {
      const closest = findClosestBoule(boules, jack)
      expect(closest).not.toBeNull()
      expect(['b1', 'b3']).toContain(closest!.id) // Both are equally close
    })

    test('returns null for empty array', () => {
      expect(findClosestBoule([], jack)).toBeNull()
    })
  })

  describe('findClosestBoulePerTeam', () => {
    const jack: Position = { x: 7.5, y: 2.5 }
    const boules: Boule[] = [
      {
        id: 'b1',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.6, y: 2.5 }, // 10cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b2',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.8, y: 2.5 }, // 30cm away
        distance: 0,
        order: 2
      },
      {
        id: 'b3',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.7, y: 2.5 }, // 20cm away
        distance: 0,
        order: 1
      }
    ]

    test('finds closest boule for each team', () => {
      const closest = findClosestBoulePerTeam(boules, jack)
      
      expect(closest.has('team1')).toBe(true)
      expect(closest.has('team2')).toBe(true)
      
      const team1Closest = closest.get('team1')!
      const team2Closest = closest.get('team2')!
      
      expect(team1Closest.boule.id).toBe('b1')
      expect(team1Closest.distance).toBe(10)
      expect(team2Closest.boule.id).toBe('b3')
      expect(team2Closest.distance).toBe(20)
    })
  })

  describe('sortBoulesByDistance', () => {
    const jack: Position = { x: 7.5, y: 2.5 }
    const boules: Boule[] = [
      {
        id: 'b1',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.8, y: 2.5 }, // 30cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b2',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.6, y: 2.5 }, // 10cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b3',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.7, y: 2.5 }, // 20cm away
        distance: 0,
        order: 2
      }
    ]

    test('sorts boules by distance from jack', () => {
      const sorted = sortBoulesByDistance(boules, jack)
      
      expect(sorted).toHaveLength(3)
      expect(sorted[0].boule.id).toBe('b2') // closest (10cm)
      expect(sorted[1].boule.id).toBe('b3') // middle (20cm)
      expect(sorted[2].boule.id).toBe('b1') // farthest (30cm)
      
      expect(sorted[0].distance).toBe(10)
      expect(sorted[1].distance).toBe(20)
      expect(sorted[2].distance).toBe(30)
    })
  })

  describe('calculateBoulesInRadius', () => {
    const center: Position = { x: 7.5, y: 2.5 }
    const boules: Boule[] = [
      {
        id: 'b1',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.6, y: 2.5 }, // 10cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b2',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.8, y: 2.5 }, // 30cm away
        distance: 0,
        order: 1
      },
      {
        id: 'b3',
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 8.0, y: 2.5 }, // 50cm away
        distance: 0,
        order: 2
      }
    ]

    test('finds boules within specified radius', () => {
      const within20cm = calculateBoulesInRadius(boules, center, 20)
      expect(within20cm).toHaveLength(1)
      expect(within20cm[0].boule.id).toBe('b1')
      
      const within40cm = calculateBoulesInRadius(boules, center, 40)
      expect(within40cm).toHaveLength(2)
      expect(within40cm.map(b => b.boule.id)).toContain('b1')
      expect(within40cm.map(b => b.boule.id)).toContain('b2')
    })
  })

  describe('requiresMeasurement', () => {
    test('requires measurement when distances are close', () => {
      expect(requiresMeasurement(100, 101, 2)).toBe(true)
      expect(requiresMeasurement(100, 102, 2)).toBe(true)
      expect(requiresMeasurement(100, 100, 2)).toBe(true)
    })

    test('does not require measurement when distances are far apart', () => {
      expect(requiresMeasurement(100, 105, 2)).toBe(false)
      expect(requiresMeasurement(100, 95, 2)).toBe(false)
    })

    test('respects custom threshold', () => {
      expect(requiresMeasurement(100, 104, 5)).toBe(true)
      expect(requiresMeasurement(100, 106, 5)).toBe(false)
    })
  })

  describe('calculateCenterPoint', () => {
    test('calculates center of multiple positions', () => {
      const positions: Position[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ]
      
      const center = calculateCenterPoint(positions)
      expect(center.x).toBe(5)
      expect(center.y).toBeCloseTo(3.33, 2)
    })

    test('handles single position', () => {
      const positions: Position[] = [{ x: 7.5, y: 2.5 }]
      const center = calculateCenterPoint(positions)
      
      expect(center.x).toBe(7.5)
      expect(center.y).toBe(2.5)
    })

    test('throws error for empty array', () => {
      expect(() => calculateCenterPoint([])).toThrow()
    })
  })

  describe('calculateBoundingRectangle', () => {
    test('calculates bounding rectangle correctly', () => {
      const positions: Position[] = [
        { x: 1, y: 2 },
        { x: 5, y: 1 },
        { x: 3, y: 6 },
        { x: 0, y: 4 }
      ]
      
      const bounds = calculateBoundingRectangle(positions)
      
      expect(bounds.minX).toBe(0)
      expect(bounds.maxX).toBe(5)
      expect(bounds.minY).toBe(1)
      expect(bounds.maxY).toBe(6)
      expect(bounds.width).toBe(5)
      expect(bounds.height).toBe(5)
    })

    test('throws error for empty array', () => {
      expect(() => calculateBoundingRectangle([])).toThrow()
    })
  })

  describe('hasBouleConflict', () => {
    test('detects conflict when boules are too close', () => {
      const newBoule: Position = { x: 7.5, y: 2.5 }
      const existingBoules: Position[] = [
        { x: 7.55, y: 2.5 } // 5cm away, too close
      ]
      
      expect(hasBouleConflict(newBoule, existingBoules, 7.5)).toBe(true)
    })

    test('allows placement when boules are far enough', () => {
      const newBoule: Position = { x: 7.5, y: 2.5 }
      const existingBoules: Position[] = [
        { x: 7.6, y: 2.5 } // 10cm away, acceptable
      ]
      
      expect(hasBouleConflict(newBoule, existingBoules, 7.5)).toBe(false)
    })

    test('handles empty existing boules array', () => {
      const newBoule: Position = { x: 7.5, y: 2.5 }
      expect(hasBouleConflict(newBoule, [], 7.5)).toBe(false)
    })
  })
})