import {
  TournamentFormDataSchema,
  TournamentSchema,
  TournamentUpdateSchema,
  TournamentFiltersSchema,
  validateTournamentFormData,
  validateTournament,
  validateTournamentUpdate,
  validateTournamentFilters
} from '@/lib/validation/tournament'

describe('Tournament Validation Schemas', () => {
  describe('TournamentFormDataSchema', () => {
    const validTournamentFormData = {
      name: 'Spring Championship',
      type: 'single-elimination' as const,
      format: 'triples' as const,
      maxPoints: 13,
      shortForm: false,
      startDate: '2024-08-20T10:00:00.000Z',
      description: 'Annual spring championship tournament',
      location: 'Central Park Courts',
      organizer: 'John Smith',
      maxPlayers: 24,
      settings: {
        allowLateRegistration: true,
        automaticBracketGeneration: true,
        requireCheckin: true,
        courtAssignmentMode: 'automatic' as const,
        scoringMode: 'official-only' as const,
        realTimeUpdates: true,
        allowSpectators: true
      }
    }

    it('should validate correct tournament form data', () => {
      const result = TournamentFormDataSchema.safeParse(validTournamentFormData)
      expect(result.success).toBe(true)
    })

    it('should reject tournament with empty name', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        name: ''
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with name too long', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        name: 'A'.repeat(101)
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with invalid type', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        type: 'invalid-type'
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with maxPlayers below minimum', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        maxPlayers: 3
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with maxPlayers above maximum', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        maxPlayers: 201
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with invalid date format', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        startDate: 'invalid-date'
      })
      expect(result.success).toBe(false)
    })

    it('should accept tournament with partial settings', () => {
      const result = TournamentFormDataSchema.safeParse({
        ...validTournamentFormData,
        settings: {
          allowLateRegistration: false
        }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('TournamentSchema', () => {
    const validTournament = {
      id: 'tournament-123',
      name: 'Spring Championship',
      type: 'single-elimination' as const,
      status: 'active' as const,
      format: 'triples' as const,
      maxPoints: 13,
      shortForm: false,
      startDate: '2024-08-20T10:00:00.000Z',
      endDate: '2024-08-20T18:00:00.000Z',
      description: 'Annual spring championship tournament',
      location: 'Central Park Courts',
      organizer: 'John Smith',
      maxPlayers: 24,
      currentPlayers: 16,
      settings: {
        allowLateRegistration: true,
        automaticBracketGeneration: true,
        requireCheckin: true,
        courtAssignmentMode: 'automatic' as const,
        scoringMode: 'official-only' as const,
        realTimeUpdates: true,
        allowSpectators: true
      },
      stats: {
        totalMatches: 12,
        completedMatches: 8,
        averageMatchDuration: 45,
        totalEnds: 96,
        highestScore: 13,
        averageScore: 7.5
      },
      createdAt: '2024-08-19T10:00:00.000Z',
      updatedAt: '2024-08-19T15:00:00.000Z'
    }

    it('should validate correct tournament data', () => {
      const result = TournamentSchema.safeParse(validTournament)
      expect(result.success).toBe(true)
    })

    it('should reject tournament with currentPlayers exceeding maxPlayers', () => {
      const result = TournamentSchema.safeParse({
        ...validTournament,
        currentPlayers: 25
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with endDate before startDate', () => {
      const result = TournamentSchema.safeParse({
        ...validTournament,
        startDate: '2024-08-20T18:00:00.000Z',
        endDate: '2024-08-20T10:00:00.000Z'
      })
      expect(result.success).toBe(false)
    })

    it('should reject tournament with completedMatches exceeding totalMatches', () => {
      const result = TournamentSchema.safeParse({
        ...validTournament,
        stats: {
          ...validTournament.stats,
          totalMatches: 5,
          completedMatches: 8
        }
      })
      expect(result.success).toBe(false)
    })

    it('should accept tournament without endDate', () => {
      const { endDate, ...tournamentWithoutEnd } = validTournament
      const result = TournamentSchema.safeParse(tournamentWithoutEnd)
      expect(result.success).toBe(true)
    })
  })

  describe('TournamentFiltersSchema', () => {
    it('should validate correct filters', () => {
      const validFilters = {
        status: 'active' as const,
        type: 'single-elimination' as const,
        format: 'triples' as const,
        dateRange: {
          start: '2024-08-01T00:00:00.000Z',
          end: '2024-08-31T23:59:59.000Z'
        },
        organizer: 'John Smith',
        location: 'Central Park'
      }

      const result = TournamentFiltersSchema.safeParse(validFilters)
      expect(result.success).toBe(true)
    })

    it('should reject filters with end date before start date', () => {
      const result = TournamentFiltersSchema.safeParse({
        dateRange: {
          start: '2024-08-31T00:00:00.000Z',
          end: '2024-08-01T00:00:00.000Z'
        }
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty filters', () => {
      const result = TournamentFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('Validation utility functions', () => {
    it('validateTournamentFormData should work correctly', () => {
      const validData = {
        name: 'Test Tournament',
        type: 'single-elimination' as const,
        format: 'doubles' as const,
        maxPoints: 13,
        shortForm: false,
        startDate: '2024-08-20T10:00:00.000Z',
        organizer: 'Test Organizer',
        maxPlayers: 16,
        settings: {}
      }

      const result = validateTournamentFormData(validData)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('validateTournament should return error for invalid data', () => {
      const invalidData = {
        name: '', // Invalid: empty name
        type: 'single-elimination'
      }

      const result = validateTournament(invalidData)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('validateTournamentUpdate should work for partial data', () => {
      const updateData = {
        name: 'Updated Tournament Name',
        updatedAt: '2024-08-19T15:00:00.000Z'
      }

      const result = validateTournamentUpdate(updateData)
      expect(result.success).toBe(true)
    })

    it('validateTournamentFilters should work with partial filters', () => {
      const filters = {
        status: 'active' as const
      }

      const result = validateTournamentFilters(filters)
      expect(result.success).toBe(true)
    })
  })
})