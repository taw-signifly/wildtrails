import {
  PlayerFormDataSchema,
  PlayerSchema,
  PlayerUpdateSchema,
  PlayerFiltersSchema,
  TeamSchema,
  validatePlayerFormData,
  validatePlayer,
  validatePlayerUpdate,
  validatePlayerFilters,
  validateTeam,
  createDisplayName,
  calculateWinPercentage
} from '@/lib/validation/player'

describe('Player Validation Schemas', () => {
  describe('PlayerFormDataSchema', () => {
    const validPlayerFormData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      club: 'Central Petanque Club',
      ranking: 150
    }

    it('should validate correct player form data', () => {
      const result = PlayerFormDataSchema.safeParse(validPlayerFormData)
      expect(result.success).toBe(true)
    })

    it('should reject player with empty first name', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        firstName: ''
      })
      expect(result.success).toBe(false)
    })

    it('should reject player with invalid first name characters', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        firstName: 'John123'
      })
      expect(result.success).toBe(false)
    })

    it('should accept names with accented characters', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        firstName: 'José',
        lastName: 'François'
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        email: 'invalid-email'
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid phone number format', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        phone: 'abc123'
      })
      expect(result.success).toBe(false)
    })

    it('should accept valid international phone numbers', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        phone: '+33123456789'
      })
      expect(result.success).toBe(true)
    })

    it('should reject ranking outside valid range', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        ranking: 10001
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional fields as undefined', () => {
      const result = PlayerFormDataSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional fields as empty strings', () => {
      const result = PlayerFormDataSchema.safeParse({
        ...validPlayerFormData,
        phone: '',
        club: ''
      })
      expect(result.success).toBe(true)
    })
  })

  describe('PlayerSchema', () => {
    const validPlayer = {
      id: 'player-123',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      club: 'Central Petanque Club',
      ranking: 150,
      handicap: 2,
      avatar: 'https://example.com/avatar.jpg',
      stats: {
        tournamentsPlayed: 10,
        tournamentsWon: 2,
        matchesPlayed: 45,
        matchesWon: 30,
        winPercentage: 66.67,
        averagePointsFor: 8.5,
        averagePointsAgainst: 6.2,
        pointsDifferential: 103.5,
        bestFinish: '1st',
        recentForm: [1, 1, 0, 1, 1]
      },
      preferences: {
        preferredFormat: 'triples' as const,
        notificationEmail: true,
        notificationPush: true,
        publicProfile: true
      },
      createdAt: '2024-08-19T10:00:00.000Z',
      updatedAt: '2024-08-19T15:00:00.000Z'
    }

    it('should validate correct player data', () => {
      const result = PlayerSchema.safeParse(validPlayer)
      expect(result.success).toBe(true)
    })

    it('should reject player with tournaments won exceeding tournaments played', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        stats: {
          ...validPlayer.stats,
          tournamentsPlayed: 5,
          tournamentsWon: 8
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject player with matches won exceeding matches played', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        stats: {
          ...validPlayer.stats,
          matchesPlayed: 20,
          matchesWon: 25
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject player with incorrect win percentage calculation', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        stats: {
          ...validPlayer.stats,
          matchesPlayed: 100,
          matchesWon: 60,
          winPercentage: 50 // Should be 60
        }
      })
      expect(result.success).toBe(false)
    })

    it('should accept player with zero matches played and zero win percentage', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        stats: {
          ...validPlayer.stats,
          matchesPlayed: 0,
          matchesWon: 0,
          winPercentage: 0
        }
      })
      expect(result.success).toBe(true)
    })

    it('should reject player with recentForm having more than 5 entries', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        stats: {
          ...validPlayer.stats,
          recentForm: [1, 1, 0, 1, 1, 0]
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject player with invalid avatar URL', () => {
      const result = PlayerSchema.safeParse({
        ...validPlayer,
        avatar: 'not-a-url'
      })
      expect(result.success).toBe(false)
    })

    it('should accept player without optional fields', () => {
      const { phone, club, ranking, handicap, avatar, ...playerWithoutOptionals } = validPlayer
      const result = PlayerSchema.safeParse(playerWithoutOptionals)
      expect(result.success).toBe(true)
    })
  })

  describe('TeamSchema', () => {
    const validTeam = {
      id: 'team-123',
      name: 'The Champions',
      players: [
        {
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
        }
      ],
      tournamentId: 'tournament-123',
      seed: 1,
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

    it('should validate correct team data', () => {
      const result = TeamSchema.safeParse(validTeam)
      expect(result.success).toBe(true)
    })

    it('should reject team with no players', () => {
      const result = TeamSchema.safeParse({
        ...validTeam,
        players: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject team with more than 3 players', () => {
      const result = TeamSchema.safeParse({
        ...validTeam,
        players: [
          ...validTeam.players,
          ...Array(3).fill(validTeam.players[0])
        ]
      })
      expect(result.success).toBe(false)
    })

    it('should reject team with matches won exceeding matches played', () => {
      const result = TeamSchema.safeParse({
        ...validTeam,
        stats: {
          ...validTeam.stats,
          matchesPlayed: 3,
          matchesWon: 5
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject team with incorrect points differential', () => {
      const result = TeamSchema.safeParse({
        ...validTeam,
        stats: {
          ...validTeam.stats,
          pointsFor: 60,
          pointsAgainst: 50,
          pointsDifferential: 15 // Should be 10
        }
      })
      expect(result.success).toBe(false)
    })
  })

  describe('PlayerFiltersSchema', () => {
    it('should validate correct filters', () => {
      const validFilters = {
        club: 'Central Petanque Club',
        ranking: {
          min: 1,
          max: 500
        },
        winPercentage: {
          min: 50,
          max: 100
        }
      }

      const result = PlayerFiltersSchema.safeParse(validFilters)
      expect(result.success).toBe(true)
    })

    it('should reject filters with min ranking greater than max', () => {
      const result = PlayerFiltersSchema.safeParse({
        ranking: {
          min: 500,
          max: 100
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject filters with min win percentage greater than max', () => {
      const result = PlayerFiltersSchema.safeParse({
        winPercentage: {
          min: 80,
          max: 60
        }
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty filters', () => {
      const result = PlayerFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('Validation utility functions', () => {
    it('validatePlayerFormData should work correctly', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      }

      const result = validatePlayerFormData(validData)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('validatePlayer should return error for invalid data', () => {
      const invalidData = {
        firstName: '', // Invalid: empty name
        email: 'invalid-email'
      }

      const result = validatePlayer(invalidData)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Helper functions', () => {
    it('createDisplayName should combine first and last names correctly', () => {
      expect(createDisplayName('John', 'Doe')).toBe('John Doe')
      expect(createDisplayName(' John ', ' Doe ')).toBe('John Doe')
      expect(createDisplayName('Jean-Pierre', 'D\'Artagnan')).toBe('Jean-Pierre D\'Artagnan')
    })

    it('calculateWinPercentage should calculate correctly', () => {
      expect(calculateWinPercentage(0, 0)).toBe(0)
      expect(calculateWinPercentage(10, 20)).toBe(50)
      expect(calculateWinPercentage(33, 100)).toBe(33)
      expect(calculateWinPercentage(2, 3)).toBe(66.67)
    })
  })
})