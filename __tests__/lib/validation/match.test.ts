import {
  MatchFormDataSchema,
  MatchSchema,
  ScoreSchema,
  EndSchema,
  CourtSchema,
  validateMatchFormData,
  validateMatch,
  validateScore,
  validateEnd,
  validateCourt,
  isValidPetanqueScore,
  isGameComplete,
  getMatchWinner,
  calculateMatchDuration
} from '@/lib/validation/match'

describe('Match Validation Schemas', () => {
  describe('ScoreSchema', () => {
    it('should validate correct scores', () => {
      const validScores = [
        { team1: 0, team2: 0, isComplete: false },
        { team1: 13, team2: 5, isComplete: true },
        { team1: 7, team2: 13, isComplete: true },
        { team1: 12, team2: 11, isComplete: false }
      ]

      validScores.forEach(score => {
        const result = ScoreSchema.safeParse(score)
        expect(result.success).toBe(true)
      })
    })

    it('should reject scores above maximum', () => {
      const result = ScoreSchema.safeParse({
        team1: 14,
        team2: 10,
        isComplete: true
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative scores', () => {
      const result = ScoreSchema.safeParse({
        team1: -1,
        team2: 5,
        isComplete: false
      })
      expect(result.success).toBe(false)
    })

    it('should reject completed games without a team reaching 13', () => {
      const result = ScoreSchema.safeParse({
        team1: 12,
        team2: 11,
        isComplete: true
      })
      expect(result.success).toBe(false)
    })

    it('should reject both teams having 13 points', () => {
      const result = ScoreSchema.safeParse({
        team1: 13,
        team2: 13,
        isComplete: true
      })
      expect(result.success).toBe(false)
    })

    it('should reject incomplete games with a team having 13 points', () => {
      const result = ScoreSchema.safeParse({
        team1: 13,
        team2: 5,
        isComplete: false
      })
      expect(result.success).toBe(false)
    })
  })

  describe('EndSchema', () => {
    const validEnd = {
      id: 'end-123',
      endNumber: 1,
      jackPosition: { x: 10, y: 2 },
      boules: [
        {
          id: 'boule-1',
          teamId: 'team-1',
          playerId: 'player-1',
          position: { x: 9.8, y: 2.1 },
          distance: 25,
          order: 1
        },
        {
          id: 'boule-2',
          teamId: 'team-2',
          playerId: 'player-2',
          position: { x: 10.2, y: 1.9 },
          distance: 30,
          order: 2
        }
      ],
      winner: 'team-1',
      points: 1,
      duration: 300,
      completed: true,
      createdAt: '2024-08-19T10:00:00.000Z'
    }

    it('should validate correct end data', () => {
      const result = EndSchema.safeParse(validEnd)
      expect(result.success).toBe(true)
    })

    it('should reject end with more than 12 boules', () => {
      const result = EndSchema.safeParse({
        ...validEnd,
        boules: Array(13).fill(validEnd.boules[0])
      })
      expect(result.success).toBe(false)
    })

    it('should reject end with more than 6 boules per team', () => {
      const boules = Array(7).fill({
        ...validEnd.boules[0],
        teamId: 'team-1'
      })

      const result = EndSchema.safeParse({
        ...validEnd,
        boules
      })
      expect(result.success).toBe(false)
    })

    it('should reject end with winner not in participating teams', () => {
      const result = EndSchema.safeParse({
        ...validEnd,
        winner: 'team-3'
      })
      expect(result.success).toBe(false)
    })

    it('should reject end with points above maximum', () => {
      const result = EndSchema.safeParse({
        ...validEnd,
        points: 7
      })
      expect(result.success).toBe(false)
    })

    it('should accept end with no boules (edge case)', () => {
      const result = EndSchema.safeParse({
        ...validEnd,
        boules: []
      })
      expect(result.success).toBe(true)
    })
  })

  describe('MatchFormDataSchema', () => {
    const validMatchFormData = {
      team1Score: 13,
      team2Score: 8,
      endScores: [
        {
          endNumber: 1,
          team1Points: 2,
          team2Points: 0
        },
        {
          endNumber: 2,
          team1Points: 1,
          team2Points: 3,
          jackPosition: { x: 10, y: 2 }
        }
      ]
    }

    it('should validate correct match form data', () => {
      const result = MatchFormDataSchema.safeParse(validMatchFormData)
      expect(result.success).toBe(true)
    })

    it('should reject scores above maximum', () => {
      const result = MatchFormDataSchema.safeParse({
        ...validMatchFormData,
        team1Score: 14
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative scores', () => {
      const result = MatchFormDataSchema.safeParse({
        ...validMatchFormData,
        team2Score: -1
      })
      expect(result.success).toBe(false)
    })

    it('should accept minimal match form data', () => {
      const result = MatchFormDataSchema.safeParse({
        team1Score: 13,
        team2Score: 7
      })
      expect(result.success).toBe(true)
    })
  })

  describe('CourtSchema', () => {
    const validCourt = {
      id: 'court-123',
      name: 'Court A',
      location: 'Central Park Petanque Courts',
      dimensions: {
        length: 15,
        width: 4,
        throwingDistance: 8
      },
      surface: 'gravel' as const,
      lighting: true,
      covered: false,
      status: 'available' as const,
      amenities: ['benches', 'scoreboard', 'water fountain']
    }

    it('should validate correct court data', () => {
      const result = CourtSchema.safeParse(validCourt)
      expect(result.success).toBe(true)
    })

    it('should reject court with dimensions below minimum', () => {
      const result = CourtSchema.safeParse({
        ...validCourt,
        dimensions: {
          ...validCourt.dimensions,
          length: 10 // Below minimum of 12
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject court with dimensions above maximum', () => {
      const result = CourtSchema.safeParse({
        ...validCourt,
        dimensions: {
          ...validCourt.dimensions,
          width: 6 // Above maximum of 5
        }
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid surface type', () => {
      const result = CourtSchema.safeParse({
        ...validCourt,
        surface: 'concrete'
      })
      expect(result.success).toBe(false)
    })

    it('should accept valid surface types', () => {
      const surfaces = ['gravel', 'sand', 'dirt', 'artificial']
      surfaces.forEach(surface => {
        const result = CourtSchema.safeParse({
          ...validCourt,
          surface
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject too many amenities', () => {
      const result = CourtSchema.safeParse({
        ...validCourt,
        amenities: Array(21).fill('amenity')
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Validation utility functions', () => {
    it('validateMatchFormData should work correctly', () => {
      const validData = {
        team1Score: 13,
        team2Score: 8
      }

      const result = validateMatchFormData(validData)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('validateScore should work correctly', () => {
      const validScore = {
        team1: 13,
        team2: 7,
        isComplete: true
      }

      const result = validateScore(validScore)
      expect(result.success).toBe(true)
    })

    it('validateEnd should work correctly', () => {
      const validEnd = {
        id: 'end-1',
        endNumber: 1,
        jackPosition: { x: 10, y: 2 },
        boules: [],
        winner: 'team-1',
        points: 1,
        completed: true,
        createdAt: '2024-08-19T10:00:00.000Z'
      }

      const result = validateEnd(validEnd)
      expect(result.success).toBe(true)
    })
  })

  describe('Helper functions', () => {
    describe('isValidPetanqueScore', () => {
      it('should validate correct Petanque scores', () => {
        expect(isValidPetanqueScore(0, 0)).toBe(true)
        expect(isValidPetanqueScore(13, 5)).toBe(true)
        expect(isValidPetanqueScore(7, 13)).toBe(true)
        expect(isValidPetanqueScore(12, 12)).toBe(true)
      })

      it('should reject invalid Petanque scores', () => {
        expect(isValidPetanqueScore(13, 13)).toBe(false)
        expect(isValidPetanqueScore(14, 5)).toBe(false)
        expect(isValidPetanqueScore(-1, 5)).toBe(false)
        expect(isValidPetanqueScore(5, -1)).toBe(false)
      })
    })

    describe('isGameComplete', () => {
      it('should identify completed games', () => {
        expect(isGameComplete(13, 5)).toBe(true)
        expect(isGameComplete(7, 13)).toBe(true)
      })

      it('should identify incomplete games', () => {
        expect(isGameComplete(12, 11)).toBe(false)
        expect(isGameComplete(0, 0)).toBe(false)
        expect(isGameComplete(10, 8)).toBe(false)
      })
    })

    describe('getMatchWinner', () => {
      it('should return correct winner for completed matches', () => {
        expect(getMatchWinner({ team1: 13, team2: 5, isComplete: true })).toBe('team1')
        expect(getMatchWinner({ team1: 7, team2: 13, isComplete: true })).toBe('team2')
      })

      it('should return null for incomplete matches', () => {
        expect(getMatchWinner({ team1: 12, team2: 11, isComplete: false })).toBe(null)
        expect(getMatchWinner({ team1: 13, team2: 5, isComplete: false })).toBe(null)
      })
    })

    describe('calculateMatchDuration', () => {
      it('should calculate duration correctly', () => {
        const startTime = '2024-08-19T10:00:00.000Z'
        const endTime = '2024-08-19T11:30:00.000Z'
        expect(calculateMatchDuration(startTime, endTime)).toBe(90)
      })

      it('should handle same start and end time', () => {
        const time = '2024-08-19T10:00:00.000Z'
        expect(calculateMatchDuration(time, time)).toBe(0)
      })

      it('should round to nearest minute', () => {
        const startTime = '2024-08-19T10:00:00.000Z'
        const endTime = '2024-08-19T10:01:30.000Z'
        expect(calculateMatchDuration(startTime, endTime)).toBe(2)
      })
    })
  })
})