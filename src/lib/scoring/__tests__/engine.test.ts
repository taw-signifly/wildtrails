import { describe, test, expect, beforeEach } from '@jest/globals'
import { ScoringEngine, createScoringEngine } from '../engine'
import type { Match, Score, Boule, Position } from '@/types'
import type { EndInput, ScoringConfiguration } from '@/types/scoring'

describe('ScoringEngine', () => {
  let engine: ScoringEngine
  
  beforeEach(() => {
    engine = new ScoringEngine()
  })

  describe('constructor', () => {
    test('creates engine with default configuration', () => {
      const config = engine.getConfiguration()
      expect(config.gameFormat).toBe('triples')
      expect(config.maxPoints).toBe(13)
      expect(config.maxPointsPerEnd).toBe(6)
    })

    test('creates engine with custom configuration', () => {
      const customConfig: Partial<ScoringConfiguration> = {
        gameFormat: 'singles',
        maxPointsPerEnd: 3
      }
      
      const customEngine = new ScoringEngine(customConfig)
      const config = customEngine.getConfiguration()
      
      expect(config.gameFormat).toBe('singles')
      expect(config.maxPointsPerEnd).toBe(3)
    })

    test('creates engine with custom options', () => {
      const customEngine = new ScoringEngine(undefined, {
        precision: 0.05,
        debugMode: true
      })
      
      const options = customEngine.getOptions()
      expect(options.precision).toBe(0.05)
      expect(options.debugMode).toBe(true)
    })
  })

  describe('calculateEndScore', () => {
    const jack: Position = { x: 7.5, y: 2.5 }
    const teamIds = ['team1', 'team2']

    test('calculates end score correctly', () => {
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
          position: { x: 7.8, y: 2.5 },
          distance: 30,
          order: 1
        }
      ]

      const result = engine.calculateEndScore(boules, jack, teamIds)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(1)
      expect(result.winningBoules).toHaveLength(1)
    })

    test('uses custom calculation options', () => {
      const boules: Boule[] = [
        {
          id: 'b1',
          teamId: 'team1',
          playerId: 'p1',
          position: { x: 7.51, y: 2.5 },
          distance: 1,
          order: 1
        },
        {
          id: 'b2',
          teamId: 'team2',
          playerId: 'p2',
          position: { x: 7.52, y: 2.5 },
          distance: 2,
          order: 1
        }
      ]

      const result = engine.calculateEndScore(boules, jack, teamIds, {
        measurementThreshold: 2 // Default threshold (1cm difference < 2cm threshold)
      })

      expect(result.isCloseCall).toBe(true)
    })

    test('throws error for invalid configuration', () => {
      const invalidBoules: Boule[] = []
      
      expect(() => {
        engine.calculateEndScore(invalidBoules, jack, teamIds)
      }).toThrow('Invalid end configuration')
    })
  })

  describe('validateMatchScore', () => {
    test('validates complete match successfully', () => {
      const match: Match = {
        id: 'match1',
        tournamentId: 'tournament1',
        round: 1,
        roundName: 'Round 1',
        bracketType: 'winner',
        team1: {
          id: 'team1',
          name: 'Team 1',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        team2: {
          id: 'team2',
          name: 'Team 2',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        score: { team1: 13, team2: 8, isComplete: true },
        status: 'completed',
        winner: 'team1',
        ends: [
          {
            id: 'end1',
            endNumber: 1,
            jackPosition: { x: 7.5, y: 2.5 },
            boules: [],
            winner: 'team1',
            points: 3,
            completed: true,
            createdAt: '2023-01-01T00:00:00Z'
          },
          {
            id: 'end2', 
            endNumber: 2,
            jackPosition: { x: 7.5, y: 2.5 },
            boules: [],
            winner: 'team2',
            points: 2,
            completed: true,
            createdAt: '2023-01-01T00:00:00Z'
          },
          {
            id: 'end3',
            endNumber: 3,
            jackPosition: { x: 7.5, y: 2.5 },
            boules: [],
            winner: 'team1',
            points: 4,
            completed: true,
            createdAt: '2023-01-01T00:00:00Z'
          },
          {
            id: 'end4',
            endNumber: 4,
            jackPosition: { x: 7.5, y: 2.5 },
            boules: [],
            winner: 'team2',
            points: 6,
            completed: true,
            createdAt: '2023-01-01T00:00:00Z'
          },
          {
            id: 'end5',
            endNumber: 5,
            jackPosition: { x: 7.5, y: 2.5 },
            boules: [],
            winner: 'team1',
            points: 6,
            completed: true,
            createdAt: '2023-01-01T00:00:00Z'
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      const result = engine.validateMatchScore(match)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('detects invalid match score', () => {
      const match: Match = {
        id: 'match1',
        tournamentId: 'tournament1',
        round: 1,
        roundName: 'Round 1',
        bracketType: 'winner',
        team1: {
          id: 'team1',
          name: 'Team 1',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        team2: {
          id: 'team2',
          name: 'Team 2',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        score: { team1: 15, team2: 8, isComplete: true }, // Invalid: > 13 points
        status: 'completed',
        winner: 'team1',
        ends: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      const result = engine.validateMatchScore(match)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('caches validation results', () => {
      const match: Match = {
        id: 'match1',
        tournamentId: 'tournament1',
        round: 1,
        roundName: 'Round 1',
        bracketType: 'winner',
        team1: {
          id: 'team1',
          name: 'Team 1',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        team2: {
          id: 'team2',
          name: 'Team 2',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        score: { team1: 13, team2: 8, isComplete: true },
        status: 'completed',
        winner: 'team1',
        ends: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      // First call
      const result1 = engine.validateMatchScore(match)
      // Second call should use cache
      const result2 = engine.validateMatchScore(match)

      expect(result1).toEqual(result2)
      
      const metrics = engine.getPerformanceMetrics()
      expect(metrics.validationCacheSize).toBe(1)
    })
  })

  describe('isGameComplete', () => {
    test('returns true when team1 reaches 13 points', () => {
      const score: Score = { team1: 13, team2: 8, isComplete: true }
      expect(engine.isGameComplete(score)).toBe(true)
    })

    test('returns true when team2 reaches 13 points', () => {
      const score: Score = { team1: 7, team2: 13, isComplete: true }
      expect(engine.isGameComplete(score)).toBe(true)
    })

    test('returns false when neither team reaches 13 points', () => {
      const score: Score = { team1: 12, team2: 11, isComplete: false }
      expect(engine.isGameComplete(score)).toBe(false)
    })
  })

  describe('getGameWinner', () => {
    test('returns team1 when team1 wins', () => {
      const score: Score = { team1: 13, team2: 8, isComplete: true }
      expect(engine.getGameWinner(score)).toBe('team1')
    })

    test('returns team2 when team2 wins', () => {
      const score: Score = { team1: 7, team2: 13, isComplete: true }
      expect(engine.getGameWinner(score)).toBe('team2')
    })

    test('returns null for incomplete game', () => {
      const score: Score = { team1: 12, team2: 11, isComplete: false }
      expect(engine.getGameWinner(score)).toBe(null)
    })

    test('returns null when no team has 13 points', () => {
      const score: Score = { team1: 12, team2: 11, isComplete: true }
      expect(engine.getGameWinner(score)).toBe(null)
    })
  })

  describe('calculatePointsDifferential', () => {
    test('calculates points differential correctly', () => {
      const score: Score = { team1: 13, team2: 5, isComplete: true }
      expect(engine.calculatePointsDifferential(score)).toBe(8)
    })

    test('throws error for incomplete game', () => {
      const score: Score = { team1: 12, team2: 8, isComplete: false }
      expect(() => engine.calculatePointsDifferential(score)).toThrow()
    })
  })

  describe('processEndScoring', () => {
    test('processes end scoring successfully', async () => {
      const endData: EndInput = {
        endNumber: 1,
        jackPosition: { x: 7.5, y: 2.5 },
        boules: [
          {
            id: 'b1',
            teamId: 'team1',
            playerId: 'p1',
            position: { x: 7.6, y: 2.5 },
            order: 1
          },
          {
            id: 'b2',
            teamId: 'team2',
            playerId: 'p2',
            position: { x: 7.8, y: 2.5 },
            order: 1
          }
        ]
      }

      const result = await engine.processEndScoring('match1', endData)

      expect(result.winner).toBe('team1')
      expect(result.points).toBe(1)
      
      const state = engine.getState()
      expect(state.activeScoringSession).toBeTruthy()
      expect(state.activeScoringSession!.matchId).toBe('match1')
    })

    test('throws error for invalid end data', async () => {
      const invalidEndData: EndInput = {
        endNumber: 1,
        jackPosition: { x: 7.5, y: 2.5 },
        boules: [] // No boules
      }

      await expect(
        engine.processEndScoring('match1', invalidEndData)
      ).rejects.toThrow('Invalid end configuration')
    })
  })

  describe('validateScoreProgression', () => {
    test('validates valid score progression', () => {
      const current: Score = { team1: 8, team2: 5, isComplete: false }
      const newScore: Score = { team1: 10, team2: 5, isComplete: false }
      
      expect(engine.validateScoreProgression(current, newScore)).toBe(true)
    })

    test('rejects score decrease', () => {
      const current: Score = { team1: 8, team2: 5, isComplete: false }
      const newScore: Score = { team1: 7, team2: 5, isComplete: false }
      
      expect(engine.validateScoreProgression(current, newScore)).toBe(false)
    })

    test('rejects both teams scoring in same end', () => {
      const current: Score = { team1: 8, team2: 5, isComplete: false }
      const newScore: Score = { team1: 10, team2: 7, isComplete: false }
      
      expect(engine.validateScoreProgression(current, newScore)).toBe(false)
    })

    test('rejects excessive points per end', () => {
      const current: Score = { team1: 8, team2: 5, isComplete: false }
      const newScore: Score = { team1: 15, team2: 5, isComplete: false } // 7 points in one end
      
      expect(engine.validateScoreProgression(current, newScore)).toBe(false)
    })

    test('rejects zero points in an end with score change', () => {
      const current: Score = { team1: 8, team2: 5, isComplete: false }
      const newScore: Score = { team1: 8, team2: 5, isComplete: false } // No change
      
      // This should be valid (no scoring in this call)
      expect(engine.validateScoreProgression(current, newScore)).toBe(true)
    })
  })

  describe('calculateTeamStatistics', () => {
    test('calculates team statistics with caching', () => {
      const matches: Match[] = [
        {
          id: 'match1',
          tournamentId: 'tournament1',
          round: 1,
          roundName: 'Round 1',
          bracketType: 'winner',
          team1: {
            id: 'team1',
            name: 'Team 1',
            players: [],
            tournamentId: 'tournament1',
            bracketType: 'winner',
            stats: {} as any,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          },
          team2: {
            id: 'team2',
            name: 'Team 2',
            players: [],
            tournamentId: 'tournament1',
            bracketType: 'winner',
            stats: {} as any,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          },
          score: { team1: 13, team2: 8, isComplete: true },
          status: 'completed',
          winner: 'team1',
          ends: [],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ]

      const stats = engine.calculateTeamStatistics('team1', matches)

      expect(stats.matchesPlayed).toBe(1)
      expect(stats.matchesWon).toBe(1)
      expect(stats.winPercentage).toBe(100)
      
      const metrics = engine.getPerformanceMetrics()
      expect(metrics.statisticsCacheSize).toBe(1)
    })
  })

  describe('configuration management', () => {
    test('updates configuration', () => {
      const newConfig = { maxPointsPerEnd: 3 }
      engine.updateConfiguration(newConfig)
      
      const config = engine.getConfiguration()
      expect(config.maxPointsPerEnd).toBe(3)
    })

    test('updates options', () => {
      const newOptions = { debugMode: true }
      engine.updateOptions(newOptions)
      
      const options = engine.getOptions()
      expect(options.debugMode).toBe(true)
    })

    test('clears caches', () => {
      // Add something to cache
      const match: Match = {
        id: 'match1',
        tournamentId: 'tournament1',
        round: 1,
        roundName: 'Round 1',
        bracketType: 'winner',
        team1: {
          id: 'team1',
          name: 'Team 1',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        team2: {
          id: 'team2',
          name: 'Team 2',
          players: [],
          tournamentId: 'tournament1',
          bracketType: 'winner',
          stats: {} as any,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        score: { team1: 13, team2: 8, isComplete: true },
        status: 'completed',
        winner: 'team1',
        ends: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
      
      engine.validateMatchScore(match)
      
      let metrics = engine.getPerformanceMetrics()
      expect(metrics.validationCacheSize).toBe(1)
      
      engine.clearCaches()
      
      metrics = engine.getPerformanceMetrics()
      expect(metrics.validationCacheSize).toBe(0)
    })
  })

  describe('static methods', () => {
    test('createForFormat creates engine with correct format', () => {
      const singlesEngine = ScoringEngine.createForFormat('singles')
      const config = singlesEngine.getConfiguration()
      
      expect(config.gameFormat).toBe('singles')
      expect(config.maxPointsPerEnd).toBe(3)
    })
  })

  describe('validateSetup', () => {
    test('validates standard setup', () => {
      const result = engine.validateSetup()
      
      expect(result.valid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    test('detects non-standard configuration', () => {
      engine.updateConfiguration({ maxPoints: 15 })
      const result = engine.validateSetup()
      
      expect(result.valid).toBe(false)
      expect(result.issues).toContain('Non-standard maximum points configuration')
    })

    test('provides recommendations for extreme settings', () => {
      engine.updateOptions({ 
        confidenceThreshold: 0.3,
        measurementThreshold: 0.5
      })
      
      const result = engine.validateSetup()
      expect(result.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('performance metrics', () => {
    test('tracks performance metrics', () => {
      const metrics = engine.getPerformanceMetrics()
      
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics).toHaveProperty('validationCacheSize')
      expect(metrics).toHaveProperty('statisticsCacheSize')
      expect(metrics).toHaveProperty('activeSessions')
      
      expect(metrics.validationCacheSize).toBe(0)
      expect(metrics.statisticsCacheSize).toBe(0)
      expect(metrics.activeSessions).toBe(0)
    })
  })
})

describe('createScoringEngine', () => {
  test('creates engine with default format', () => {
    const engine = createScoringEngine()
    const config = engine.getConfiguration()
    
    expect(config.gameFormat).toBe('triples')
  })

  test('creates engine with specified format', () => {
    const engine = createScoringEngine('doubles')
    const config = engine.getConfiguration()
    
    expect(config.gameFormat).toBe('doubles')
    expect(config.maxPointsPerEnd).toBe(6)
  })

  test('creates engine with options', () => {
    const engine = createScoringEngine('singles', { debugMode: true })
    const options = engine.getOptions()
    
    expect(options.debugMode).toBe(true)
  })
})