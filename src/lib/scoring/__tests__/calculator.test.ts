import { describe, test, expect } from '@jest/globals'
import {
  calculateEndScore,
  handleEqualDistances,
  handleJackDisplacement,
  validateEndConfiguration,
  determineEndWinner,
  countScoringBoules,
  calculateEndStatistics
} from '../calculator'
import type { Boule, Position } from '@/types'

describe('End Calculator', () => {
  const jack: Position = { x: 7.5, y: 2.5 }
  const teamIds = ['team1', 'team2']

  describe('calculateEndScore', () => {
    test('calculates simple end with clear winner', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 }, // 10cm from jack
          distance: 10,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.8, y: 2.5 }, // 30cm from jack
          distance: 30,
          order: 1
        }
      ]

      const result = calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(1)
      expect(result.winningBoules).toHaveLength(1)
      expect(result.winningBoules[0].id).toBe('b1')
      expect(result.isCloseCall).toBe(false)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.endSummary).toContain('Team team1 wins 1 point')
    })

    test('calculates end with multiple scoring boules', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.55, y: 2.5 }, // 5cm from jack
          distance: 5,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 }, // 10cm from jack
          distance: 10,
          order: 2
        },
        {
          id: 'b3',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.65, y: 2.5 }, // 15cm from jack
          distance: 15,
          order: 3
        },
        {
          id: 'b4',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.7, y: 2.5 }, // 20cm from jack
          distance: 20,
          order: 1
        }
      ]

      const result = calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(3)
      expect(result.winningBoules).toHaveLength(3)
      expect(result.winningBoules.map(b => b.id)).toEqual(['b1', 'b2', 'b3'])
      expect(result.endSummary).toContain('Team team1 wins 3 points with 3 boules')
    })

    test('handles maximum points per end', () => {
      const boules: Boule[] = []
      
      // Create 7 boules for team1, all closer than team2's closest
      for (let i = 0; i < 7; i++) {
        boules.push({
          id: `b1_${i}`,
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.5 + (i + 1) * 0.01, y: 2.5 }, // 1-7cm from jack
          distance: (i + 1),
          order: i + 1
        })
      }
      
      // Add one boule for team2 at 10cm
      boules.push({
        id: 'b2_1',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.6, y: 2.5 }, // 10cm from jack
        distance: 10,
        order: 1
      })

      const result = calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(6) // Maximum 6 points, not 7
      expect(result.winningBoules.length).toBeLessThanOrEqual(6)
    })

    test('detects close calls requiring measurement', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.51, y: 2.5 }, // 1cm from jack
          distance: 1,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.52, y: 2.5 }, // 2cm from jack
          distance: 2,
          order: 1
        }
      ]

      const result = calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(1)
      expect(result.isCloseCall).toBe(true)
      expect(result.confidence).toBeLessThan(0.8)
      expect(result.endSummary).toContain('close measurement')
    })

    test('ensures minimum 1 point for winning team', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.8, y: 2.5 }, // 30cm from jack
          distance: 30,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.6, y: 2.5 }, // 10cm from jack (closest)
          distance: 10,
          order: 1
        }
      ]

      const result = calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team2')
      expect(result.points).toBe(1) // Minimum 1 point
      expect(result.winningBoules).toHaveLength(1)
    })

    test('handles debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        }
      ]

      calculateEndScore(boules, jack, teamIds, { debugMode: true })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('validateEndConfiguration', () => {
    test('validates correct end configuration', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        }
      ]

      const result = validateEndConfiguration(boules, jack, teamIds)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('detects missing boules', () => {
      const result = validateEndConfiguration([], jack, teamIds)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one boule must be played to score an end')
    })

    test('detects insufficient teams', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        }
      ]

      const result = validateEndConfiguration(boules, jack, ['team1'])

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least two teams must participate in an end')
    })

    test('detects invalid jack position', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        }
      ]

      const invalidJack = null as any

      const result = validateEndConfiguration(boules, invalidJack, teamIds)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Valid jack position is required')
    })

    test('detects boule from non-participating team', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team3', // Not in teamIds
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        }
      ]

      const result = validateEndConfiguration(boules, jack, teamIds)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Boule b1 belongs to team not in game')
    })

    test('warns about unequal boule counts', () => {
      const boules: Boule[] = [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `b1_${i}`,
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6 + i * 0.01, y: 2.5 },
          distance: 10 + i,
          order: i + 1
        })),
        {
          id: 'b2_1',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.8, y: 2.5 },
          distance: 30,
          order: 1
        }
      ]

      const result = validateEndConfiguration(boules, jack, teamIds)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('Teams have significantly different numbers of boules played')
    })

    test('detects duplicate boule IDs', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        },
        {
          id: 'b1', // Duplicate ID
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.8, y: 2.5 },
          distance: 30,
          order: 1
        }
      ]

      const result = validateEndConfiguration(boules, jack, teamIds)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate boule IDs detected')
    })
  })

  describe('determineEndWinner', () => {
    test('returns closest boule team', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.8, y: 2.5 }, // 30cm from jack
          distance: 30,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.6, y: 2.5 }, // 10cm from jack
          distance: 10,
          order: 1
        }
      ]

      const winner = determineEndWinner(boules, jack)
      expect(winner).toBe('team2')
    })

    test('returns empty string for no boules', () => {
      const winner = determineEndWinner([], jack)
      expect(winner).toBe('')
    })
  })

  describe('countScoringBoules', () => {
    test('counts boules closer than opponent closest', () => {
      const team1Boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.55, y: 2.5 }, // 5cm
          distance: 5,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 }, // 10cm
          distance: 10,
          order: 2
        },
        {
          id: 'b3',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.7, y: 2.5 }, // 20cm
          distance: 20,
          order: 3
        }
      ]

      const team2Boules: Boule[] = [
        {
          id: 'b4',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.65, y: 2.5 }, // 15cm
          distance: 15,
          order: 1
        }
      ]

      const count = countScoringBoules(team1Boules, team2Boules, jack)
      expect(count).toBe(2) // b1 and b2 are closer than b4
    })

    test('returns 0 when no team boules', () => {
      const team2Boules: Boule[] = [
        {
          id: 'b4',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.65, y: 2.5 },
          distance: 15,
          order: 1
        }
      ]

      const count = countScoringBoules([], team2Boules, jack)
      expect(count).toBe(0)
    })

    test('returns all boules when no opponent boules', () => {
      const team1Boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.55, y: 2.5 },
          distance: 5,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 2
        }
      ]

      const count = countScoringBoules(team1Boules, [], jack)
      expect(count).toBe(2)
    })

    test('respects maximum points per end', () => {
      const team1Boules: Boule[] = Array.from({ length: 8 }, (_, i) => ({
        id: `b${i}`,
        teamId: 'team1',
        playerId: 'p1',
        position: { x: 7.5 + (i + 1) * 0.01, y: 2.5 },
        distance: i + 1,
        order: i + 1
      }))

      const team2Boules: Boule[] = [{
        id: 'b_opp',
        teamId: 'team2',
        playerId: 'p2',
        position: { x: 7.6, y: 2.5 },
        distance: 10,
        order: 1
      }]

      const count = countScoringBoules(team1Boules, team2Boules, jack)
      expect(count).toBe(6) // Maximum 6 points
    })
  })

  describe('handleEqualDistances', () => {
    test('handles measurement scenario for equal distances', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 },
          distance: 10,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.6, y: 2.5 }, // Same distance
          distance: 10,
          order: 1
        }
      ]

      const result = handleEqualDistances(boules, jack, teamIds)

      expect(result.winner).toBe('')
      expect(result.points).toBe(0)
      expect(result.confidence).toBe(0)
      expect(result.isCloseCall).toBe(true)
      expect(result.endSummary).toContain('requires physical measurement')
    })
  })

  describe('handleJackDisplacement', () => {
    test('recalculates with new jack position', () => {
      const originalJack: Position = { x: 7.5, y: 2.5 }
      const newJack: Position = { x: 8.0, y: 2.5 }
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.9, y: 2.5 }, // Closer to new jack
          distance: 0,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.6, y: 2.5 }, // Farther from new jack
          distance: 0,
          order: 1
        }
      ]

      const result = handleJackDisplacement(originalJack, newJack, boules, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.confidence).toBeLessThanOrEqual(0.9) // Reduced due to displacement
      expect(result.endSummary).toContain('Jack displaced')
    })
  })

  describe('calculateEndStatistics', () => {
    test('calculates comprehensive end statistics', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.6, y: 2.5 }, // 10cm
          distance: 10,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.8, y: 2.5 }, // 30cm
          distance: 30,
          order: 1
        },
        {
          id: 'b3',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 8.5, y: 2.5 }, // 100cm
          distance: 100,
          order: 2
        }
      ]

      const stats = calculateEndStatistics(boules, jack)

      expect(stats.averageDistance).toBeCloseTo(46.7, 1)
      expect(stats.closestDistance).toBe(10)
      expect(stats.farthestDistance).toBe(100)
      expect(stats.distanceSpread).toBe(90)
      expect(stats.boulesWithin1m).toBe(3) // All boules are within 1m (100cm)
      expect(stats.boulesWithin50cm).toBe(2)
    })

    test('handles empty boules array', () => {
      const stats = calculateEndStatistics([], jack)

      expect(stats.averageDistance).toBe(0)
      expect(stats.closestDistance).toBe(0)
      expect(stats.farthestDistance).toBe(0)
      expect(stats.distanceSpread).toBe(0)
      expect(stats.boulesWithin1m).toBe(0)
      expect(stats.boulesWithin50cm).toBe(0)
    })
  })
})