import {
  BracketSchema,
  StandingSchema,
  APIResponseSchema,
  PaginatedResponseSchema,
  TournamentUpdateEventSchema,
  MatchUpdateEventSchema,
  SearchQuerySchema,
  validateBracket,
  validateStanding,
  validateTournamentUpdateEvent,
  validateMatchUpdateEvent,
  validateSearchQuery,
  createAPIResponseValidator,
  createPaginatedResponseValidator
} from '@/lib/validation/common'
import { z } from 'zod'

describe('Common Validation Schemas', () => {
  describe('BracketSchema', () => {
    const validBracket = {
      id: 'bracket-123',
      tournamentId: 'tournament-123',
      type: 'winner' as const,
      rounds: [
        {
          round: 1,
          name: 'Round 1',
          matches: ['match-1', 'match-2', 'match-3'],
          isComplete: true
        },
        {
          round: 2,
          name: 'Quarterfinals',
          matches: ['match-4', 'match-5'],
          isComplete: false
        }
      ],
      format: 'single-elimination' as const,
      isComplete: false
    }

    it('should validate correct bracket data', () => {
      const result = BracketSchema.safeParse(validBracket)
      expect(result.success).toBe(true)
    })

    it('should reject bracket with non-sequential rounds', () => {
      const result = BracketSchema.safeParse({
        ...validBracket,
        rounds: [
          { round: 1, name: 'Round 1', matches: ['match-1'], isComplete: true },
          { round: 3, name: 'Round 3', matches: ['match-2'], isComplete: false } // Missing round 2
        ]
      })
      expect(result.success).toBe(false)
    })

    it('should reject bracket with rounds not starting from 1', () => {
      const result = BracketSchema.safeParse({
        ...validBracket,
        rounds: [
          { round: 2, name: 'Round 2', matches: ['match-1'], isComplete: true }
        ]
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty rounds', () => {
      const result = BracketSchema.safeParse({
        ...validBracket,
        rounds: []
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid bracket types', () => {
      const types = ['winner', 'loser', 'consolation']
      types.forEach(type => {
        const result = BracketSchema.safeParse({
          ...validBracket,
          type
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('StandingSchema', () => {
    const mockTeam = {
      id: 'team-123',
      name: 'The Champions',
      players: [{
        id: 'player-1',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        email: 'john@example.com',
        stats: {
          tournamentsPlayed: 5,
          tournamentsWon: 1,
          matchesPlayed: 20,
          matchesWon: 12,
          winPercentage: 60,
          averagePointsFor: 8,
          averagePointsAgainst: 6,
          pointsDifferential: 40,
          bestFinish: '2nd',
          recentForm: [1, 0, 1, 1, 0]
        },
        preferences: {
          preferredFormat: 'triples' as const,
          notificationEmail: true,
          notificationPush: true,
          publicProfile: true
        },
        createdAt: '2024-08-19T10:00:00.000Z',
        updatedAt: '2024-08-19T15:00:00.000Z'
      }],
      tournamentId: 'tournament-123',
      bracketType: 'winner' as const,
      stats: {
        matchesPlayed: 5,
        matchesWon: 3,
        setsWon: 15,
        setsLost: 12,
        pointsFor: 65,
        pointsAgainst: 58,
        pointsDifferential: 7,
        averagePointsDifferential: 1.4,
        currentStreak: 2,
        longestStreak: 3
      },
      createdAt: '2024-08-19T10:00:00.000Z'
    }

    const validStanding = {
      teamId: 'team-123',
      team: mockTeam,
      position: 1,
      matchesPlayed: 5,
      wins: 3,
      losses: 2,
      pointsFor: 65,
      pointsAgainst: 58,
      pointsDifferential: 7,
      averagePointsDifferential: 1.4,
      lastFive: ['W', 'L', 'W', 'W', 'L'] as const,
      status: 'active' as const
    }

    it('should validate correct standing data', () => {
      const result = StandingSchema.safeParse(validStanding)
      expect(result.success).toBe(true)
    })

    it('should reject standing where wins + losses != matches played', () => {
      const result = StandingSchema.safeParse({
        ...validStanding,
        matchesPlayed: 5,
        wins: 2,
        losses: 2 // Should be 3 to equal 5 matches played
      })
      expect(result.success).toBe(false)
    })

    it('should reject standing with incorrect points differential', () => {
      const result = StandingSchema.safeParse({
        ...validStanding,
        pointsFor: 60,
        pointsAgainst: 50,
        pointsDifferential: 15 // Should be 10
      })
      expect(result.success).toBe(false)
    })

    it('should reject standing with incorrect average points differential', () => {
      const result = StandingSchema.safeParse({
        ...validStanding,
        matchesPlayed: 4,
        pointsDifferential: 12,
        averagePointsDifferential: 2 // Should be 3
      })
      expect(result.success).toBe(false)
    })

    it('should accept standing with zero matches played', () => {
      const result = StandingSchema.safeParse({
        ...validStanding,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDifferential: 0,
        averagePointsDifferential: 0
      })
      expect(result.success).toBe(true)
    })

    it('should reject lastFive with more than 5 entries', () => {
      const result = StandingSchema.safeParse({
        ...validStanding,
        lastFive: ['W', 'L', 'W', 'W', 'L', 'W']
      })
      expect(result.success).toBe(false)
    })

    it('should accept valid status values', () => {
      const statuses = ['active', 'eliminated', 'champion']
      statuses.forEach(status => {
        const result = StandingSchema.safeParse({
          ...validStanding,
          status
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('APIResponseSchema', () => {
    const stringSchema = z.string()

    it('should validate successful API response', () => {
      const response = {
        success: true,
        data: 'test data',
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const validator = APIResponseSchema(stringSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate error API response', () => {
      const response = {
        success: false,
        error: 'Something went wrong',
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const validator = APIResponseSchema(stringSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should reject successful response without data', () => {
      const response = {
        success: true,
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const validator = APIResponseSchema(stringSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should reject error response without error message', () => {
      const response = {
        success: false,
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const validator = APIResponseSchema(stringSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should accept optional message field', () => {
      const response = {
        success: true,
        data: 'test data',
        message: 'Operation completed successfully',
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const validator = APIResponseSchema(stringSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('PaginatedResponseSchema', () => {
    const itemSchema = z.object({ id: z.string(), name: z.string() })

    it('should validate correct paginated response', () => {
      const response = {
        data: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      }

      const validator = PaginatedResponseSchema(itemSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should reject response with incorrect totalPages calculation', () => {
      const response = {
        data: [{ id: '1', name: 'Item 1' }],
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 2 // Should be 3 (25 / 10 = 2.5 => 3)
        }
      }

      const validator = PaginatedResponseSchema(itemSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should accept response with zero total', () => {
      const response = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      }

      const validator = PaginatedResponseSchema(itemSchema)
      const result = validator.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('SearchQuerySchema', () => {
    it('should validate correct search query', () => {
      const query = {
        query: 'tournament name',
        sortBy: 'name',
        sortOrder: 'asc' as const,
        page: 1,
        limit: 20
      }

      const result = SearchQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should apply default values', () => {
      const query = {}

      const result = SearchQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      expect(result.data?.page).toBe(1)
      expect(result.data?.limit).toBe(20)
    })

    it('should reject page below 1', () => {
      const result = SearchQuerySchema.safeParse({ page: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject limit above 100', () => {
      const result = SearchQuerySchema.safeParse({ limit: 101 })
      expect(result.success).toBe(false)
    })

    it('should reject query too long', () => {
      const result = SearchQuerySchema.safeParse({
        query: 'A'.repeat(201)
      })
      expect(result.success).toBe(false)
    })

    it('should accept valid sort orders', () => {
      const orders = ['asc', 'desc']
      orders.forEach(sortOrder => {
        const result = SearchQuerySchema.safeParse({ sortOrder })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Event Schemas', () => {
    describe('TournamentUpdateEventSchema', () => {
      it('should validate correct tournament update event', () => {
        const event = {
          type: 'tournament_updated' as const,
          tournamentId: 'tournament-123',
          data: {
            id: 'tournament-123',
            name: 'Spring Championship',
            status: 'active'
          },
          timestamp: '2024-08-19T10:00:00.000Z'
        }

        const result = TournamentUpdateEventSchema.safeParse(event)
        expect(result.success).toBe(true)
      })

      it('should accept different event types', () => {
        const types = ['tournament_updated', 'match_started', 'match_completed', 'score_updated']
        types.forEach(type => {
          const event = {
            type,
            tournamentId: 'tournament-123',
            data: { someData: 'value' },
            timestamp: '2024-08-19T10:00:00.000Z'
          }

          const result = TournamentUpdateEventSchema.safeParse(event)
          expect(result.success).toBe(true)
        })
      })
    })

    describe('MatchUpdateEventSchema', () => {
      it('should validate correct match update event', () => {
        const event = {
          type: 'score_updated' as const,
          matchId: 'match-123',
          data: {
            team1: 10,
            team2: 8,
            isComplete: false
          },
          timestamp: '2024-08-19T10:00:00.000Z'
        }

        const result = MatchUpdateEventSchema.safeParse(event)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Validation utility functions', () => {
    it('validateBracket should work correctly', () => {
      const validBracket = {
        id: 'bracket-1',
        tournamentId: 'tournament-1',
        type: 'winner' as const,
        rounds: [],
        format: 'single-elimination' as const,
        isComplete: false
      }

      const result = validateBracket(validBracket)
      expect(result.success).toBe(true)
    })

    it('validateSearchQuery should work correctly', () => {
      const query = { query: 'test' }
      const result = validateSearchQuery(query)
      expect(result.success).toBe(true)
    })

    it('createAPIResponseValidator should create working validator', () => {
      const stringSchema = z.string()
      const validator = createAPIResponseValidator(stringSchema)

      const validResponse = {
        success: true,
        data: 'test',
        timestamp: '2024-08-19T10:00:00.000Z'
      }

      const result = validator(validResponse)
      expect(result.success).toBe(true)
    })

    it('createPaginatedResponseValidator should create working validator', () => {
      const itemSchema = z.object({ id: z.string() })
      const validator = createPaginatedResponseValidator(itemSchema)

      const validResponse = {
        data: [{ id: '1' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      }

      const result = validator(validResponse)
      expect(result.success).toBe(true)
    })
  })
})