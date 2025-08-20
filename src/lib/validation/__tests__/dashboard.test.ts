import { describe, expect, it } from '@jest/globals'
import {
  DashboardStatsSchema,
  RecentTournamentSchema,
  ActiveMatchSchema,
  ActivityEventSchema,
  validateDashboardStats,
  validateRecentTournament,
  validateActiveMatch,
  validateActivityEvent,
  sanitizeTournamentName,
  sanitizePlayerName,
  sanitizeDescription
} from '../dashboard'

describe('Dashboard Validation Schemas', () => {
  describe('DashboardStatsSchema', () => {
    it('should validate correct dashboard stats', () => {
      const validStats = {
        activeTournaments: 5,
        registeredPlayers: 42,
        liveMatches: 8,
        totalMatches: 120
      }

      expect(() => DashboardStatsSchema.parse(validStats)).not.toThrow()
    })

    it('should reject negative numbers', () => {
      const invalidStats = {
        activeTournaments: -1,
        registeredPlayers: 42,
        liveMatches: 8,
        totalMatches: 120
      }

      expect(() => DashboardStatsSchema.parse(invalidStats)).toThrow()
    })

    it('should reject non-numeric values', () => {
      const invalidStats = {
        activeTournaments: 'five',
        registeredPlayers: 42,
        liveMatches: 8,
        totalMatches: 120
      }

      expect(() => DashboardStatsSchema.parse(invalidStats)).toThrow()
    })

    it('should reject missing required fields', () => {
      const invalidStats = {
        activeTournaments: 5,
        // missing registeredPlayers
        liveMatches: 8,
        totalMatches: 120
      }

      expect(() => DashboardStatsSchema.parse(invalidStats)).toThrow()
    })
  })

  describe('RecentTournamentSchema', () => {
    it('should validate correct tournament data', () => {
      const validTournament = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Summer Championship',
        status: 'active',
        participants: 32,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(validTournament)).not.toThrow()
    })

    it('should reject invalid UUID', () => {
      const invalidTournament = {
        id: 'not-a-uuid',
        name: 'Summer Championship',
        status: 'active',
        participants: 32,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(invalidTournament)).toThrow()
    })

    it('should reject invalid status', () => {
      const invalidTournament = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Summer Championship',
        status: 'invalid_status',
        participants: 32,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(invalidTournament)).toThrow()
    })

    it('should reject empty tournament name', () => {
      const invalidTournament = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: '',
        status: 'active',
        participants: 32,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(invalidTournament)).toThrow()
    })

    it('should reject name that is too long', () => {
      const invalidTournament = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'A'.repeat(201), // 201 characters, max is 200
        status: 'active',
        participants: 32,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(invalidTournament)).toThrow()
    })

    it('should reject negative participants', () => {
      const invalidTournament = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Summer Championship',
        status: 'active',
        participants: -5,
        date: '2024-01-15'
      }

      expect(() => RecentTournamentSchema.parse(invalidTournament)).toThrow()
    })
  })

  describe('ActiveMatchSchema', () => {
    it('should validate correct match data', () => {
      const validMatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tournamentId: '123e4567-e89b-12d3-a456-426614174001',
        tournamentName: 'Summer Championship',
        team1: ['Player 1', 'Player 2'],
        team2: ['Player 3', 'Player 4'],
        currentScore: [5, 3],
        court: 'Court A',
        status: 'active',
        startedAt: '2024-01-15T10:00:00Z',
        duration: 45
      }

      expect(() => ActiveMatchSchema.parse(validMatch)).not.toThrow()
    })

    it('should reject invalid score format', () => {
      const invalidMatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tournamentId: '123e4567-e89b-12d3-a456-426614174001',
        tournamentName: 'Summer Championship',
        team1: ['Player 1', 'Player 2'],
        team2: ['Player 3', 'Player 4'],
        currentScore: [5], // Should be a tuple of 2 numbers
        status: 'active'
      }

      expect(() => ActiveMatchSchema.parse(invalidMatch)).toThrow()
    })

    it('should reject empty team arrays', () => {
      const invalidMatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tournamentId: '123e4567-e89b-12d3-a456-426614174001',
        tournamentName: 'Summer Championship',
        team1: [], // Empty team
        team2: ['Player 3', 'Player 4'],
        currentScore: [5, 3],
        status: 'active'
      }

      expect(() => ActiveMatchSchema.parse(invalidMatch)).toThrow()
    })

    it('should reject negative scores', () => {
      const invalidMatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tournamentId: '123e4567-e89b-12d3-a456-426614174001',
        tournamentName: 'Summer Championship',
        team1: ['Player 1'],
        team2: ['Player 2'],
        currentScore: [-1, 3], // Negative score
        status: 'active'
      }

      expect(() => ActiveMatchSchema.parse(invalidMatch)).toThrow()
    })

    it('should allow optional fields to be undefined', () => {
      const validMatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tournamentId: '123e4567-e89b-12d3-a456-426614174001',
        tournamentName: 'Summer Championship',
        team1: ['Player 1'],
        team2: ['Player 2'],
        currentScore: [5, 3],
        status: 'active'
        // court, startedAt, duration are optional
      }

      expect(() => ActiveMatchSchema.parse(validMatch)).not.toThrow()
    })
  })

  describe('ActivityEventSchema', () => {
    it('should validate correct activity event', () => {
      const validEvent = {
        id: 'tournament-123',
        type: 'tournament_started',
        title: 'Tournament Started',
        description: 'Summer Championship has begun',
        timestamp: '2024-01-15T10:00:00Z',
        relatedId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'tournament'
      }

      expect(() => ActivityEventSchema.parse(validEvent)).not.toThrow()
    })

    it('should reject invalid event type', () => {
      const invalidEvent = {
        id: 'tournament-123',
        type: 'invalid_event_type',
        title: 'Tournament Started',
        description: 'Summer Championship has begun',
        timestamp: '2024-01-15T10:00:00Z',
        relatedId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'tournament'
      }

      expect(() => ActivityEventSchema.parse(invalidEvent)).toThrow()
    })

    it('should reject invalid entity type', () => {
      const invalidEvent = {
        id: 'tournament-123',
        type: 'tournament_started',
        title: 'Tournament Started',
        description: 'Summer Championship has begun',
        timestamp: '2024-01-15T10:00:00Z',
        relatedId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'invalid_entity'
      }

      expect(() => ActivityEventSchema.parse(invalidEvent)).toThrow()
    })

    it('should reject title that is too long', () => {
      const invalidEvent = {
        id: 'tournament-123',
        type: 'tournament_started',
        title: 'A'.repeat(101), // 101 characters, max is 100
        description: 'Summer Championship has begun',
        timestamp: '2024-01-15T10:00:00Z',
        relatedId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'tournament'
      }

      expect(() => ActivityEventSchema.parse(invalidEvent)).toThrow()
    })

    it('should reject description that is too long', () => {
      const invalidEvent = {
        id: 'tournament-123',
        type: 'tournament_started',
        title: 'Tournament Started',
        description: 'A'.repeat(501), // 501 characters, max is 500
        timestamp: '2024-01-15T10:00:00Z',
        relatedId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'tournament'
      }

      expect(() => ActivityEventSchema.parse(invalidEvent)).toThrow()
    })
  })

  describe('Validation Functions', () => {
    describe('validateDashboardStats', () => {
      it('should return validated stats for valid input', () => {
        const input = {
          activeTournaments: 5,
          registeredPlayers: 42,
          liveMatches: 8,
          totalMatches: 120
        }

        const result = validateDashboardStats(input)
        expect(result).toEqual(input)
      })

      it('should throw for invalid input', () => {
        const input = {
          activeTournaments: -1,
          registeredPlayers: 42,
          liveMatches: 8,
          totalMatches: 120
        }

        expect(() => validateDashboardStats(input)).toThrow()
      })
    })

    describe('validateRecentTournament', () => {
      it('should return validated tournament for valid input', () => {
        const input = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Tournament',
          status: 'active',
          participants: 16,
          date: '2024-01-15'
        }

        const result = validateRecentTournament(input)
        expect(result).toEqual(input)
      })

      it('should throw for invalid input', () => {
        const input = {
          id: 'not-a-uuid',
          name: 'Test Tournament',
          status: 'invalid',
          participants: 16,
          date: '2024-01-15'
        }

        expect(() => validateRecentTournament(input)).toThrow()
      })
    })

    describe('validateActiveMatch', () => {
      it('should return validated match for valid input', () => {
        const input = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          tournamentId: '123e4567-e89b-12d3-a456-426614174001',
          tournamentName: 'Test Tournament',
          team1: ['Player 1'],
          team2: ['Player 2'],
          currentScore: [5, 3] as [number, number],
          status: 'active' as const
        }

        const result = validateActiveMatch(input)
        expect(result).toEqual(input)
      })

      it('should throw for invalid input', () => {
        const input = {
          id: 'not-a-uuid',
          tournamentId: '123e4567-e89b-12d3-a456-426614174001',
          tournamentName: 'Test Tournament',
          team1: [],
          team2: ['Player 2'],
          currentScore: [5, 3],
          status: 'active'
        }

        expect(() => validateActiveMatch(input)).toThrow()
      })
    })

    describe('validateActivityEvent', () => {
      it('should return validated event for valid input', () => {
        const input = {
          id: 'event-123',
          type: 'tournament_started' as const,
          title: 'Tournament Started',
          description: 'Test tournament has begun',
          timestamp: '2024-01-15T10:00:00Z',
          relatedId: '123e4567-e89b-12d3-a456-426614174000',
          entityType: 'tournament' as const
        }

        const result = validateActivityEvent(input)
        expect(result).toEqual(input)
      })

      it('should throw for invalid input', () => {
        const input = {
          id: '',
          type: 'invalid_type',
          title: '',
          description: '',
          timestamp: '2024-01-15T10:00:00Z',
          relatedId: 'not-a-uuid',
          entityType: 'invalid'
        }

        expect(() => validateActivityEvent(input)).toThrow()
      })
    })
  })

  describe('Sanitization Functions', () => {
    describe('sanitizeTournamentName', () => {
      it('should remove HTML tags', () => {
        const input = '<script>alert("xss")</script>Malicious Tournament'
        const result = sanitizeTournamentName(input)
        expect(result).toBe('Malicious Tournament')
      })

      it('should trim whitespace', () => {
        const input = '  Tournament Name  '
        const result = sanitizeTournamentName(input)
        expect(result).toBe('Tournament Name')
      })

      it('should limit length to 200 characters', () => {
        const input = 'A'.repeat(250)
        const result = sanitizeTournamentName(input)
        expect(result).toHaveLength(200)
      })

      it('should handle multiple HTML tags', () => {
        const input = '<div><b>Bold</b> Tournament <i>Name</i></div>'
        const result = sanitizeTournamentName(input)
        expect(result).toBe('Bold Tournament Name')
      })
    })

    describe('sanitizePlayerName', () => {
      it('should remove HTML tags', () => {
        const input = '<b>Player</b> <i>Name</i>'
        const result = sanitizePlayerName(input)
        expect(result).toBe('Player Name')
      })

      it('should trim whitespace', () => {
        const input = '  Player Name  '
        const result = sanitizePlayerName(input)
        expect(result).toBe('Player Name')
      })

      it('should limit length to 100 characters', () => {
        const input = 'A'.repeat(150)
        const result = sanitizePlayerName(input)
        expect(result).toHaveLength(100)
      })
    })

    describe('sanitizeDescription', () => {
      it('should remove HTML tags', () => {
        const input = '<p>This is a <strong>description</strong> with HTML.</p>'
        const result = sanitizeDescription(input)
        expect(result).toBe('This is a description with HTML.')
      })

      it('should trim whitespace', () => {
        const input = '  Description with spaces  '
        const result = sanitizeDescription(input)
        expect(result).toBe('Description with spaces')
      })

      it('should limit length to 500 characters', () => {
        const input = 'A'.repeat(600)
        const result = sanitizeDescription(input)
        expect(result).toHaveLength(500)
      })

      it('should handle complex HTML structures', () => {
        const input = '<div class="test"><p>Paragraph 1</p><ul><li>Item 1</li><li>Item 2</li></ul></div>'
        const result = sanitizeDescription(input)
        expect(result).toBe('Paragraph 1Item 1Item 2')
      })
    })
  })
})