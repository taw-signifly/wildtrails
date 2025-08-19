import validationModule, {
  schemas,
  validators,
  createValidationResult,
  validateOrThrow,
  createValidationMiddleware,
  validateBatch,
  createPartialSchema,
  composeSchemas
} from '@/lib/validation'
import { z } from 'zod'

describe('Validation Index Module', () => {
  describe('schemas object', () => {
    it('should export all schema categories', () => {
      expect(schemas.tournament).toBeDefined()
      expect(schemas.player).toBeDefined()
      expect(schemas.team).toBeDefined()
      expect(schemas.match).toBeDefined()
      expect(schemas.court).toBeDefined()
      expect(schemas.bracket).toBeDefined()
      expect(schemas.standing).toBeDefined()
      expect(schemas.events).toBeDefined()
      expect(schemas.api).toBeDefined()
    })

    it('should have tournament schemas', () => {
      expect(schemas.tournament.entity).toBeDefined()
      expect(schemas.tournament.formData).toBeDefined()
      expect(schemas.tournament.update).toBeDefined()
      expect(schemas.tournament.filters).toBeDefined()
      expect(schemas.tournament.analytics).toBeDefined()
    })

    it('should have player schemas', () => {
      expect(schemas.player.entity).toBeDefined()
      expect(schemas.player.formData).toBeDefined()
      expect(schemas.player.update).toBeDefined()
      expect(schemas.player.filters).toBeDefined()
    })

    it('should have match schemas', () => {
      expect(schemas.match.entity).toBeDefined()
      expect(schemas.match.formData).toBeDefined()
      expect(schemas.match.update).toBeDefined()
      expect(schemas.match.filters).toBeDefined()
      expect(schemas.match.score).toBeDefined()
      expect(schemas.match.end).toBeDefined()
    })
  })

  describe('validators object', () => {
    it('should export all validator categories', () => {
      expect(validators.tournament).toBeDefined()
      expect(validators.player).toBeDefined()
      expect(validators.team).toBeDefined()
      expect(validators.match).toBeDefined()
      expect(validators.court).toBeDefined()
      expect(validators.bracket).toBeDefined()
      expect(validators.standing).toBeDefined()
      expect(validators.events).toBeDefined()
      expect(validators.api).toBeDefined()
    })

    it('should have working validator functions', () => {
      const validTournamentData = {
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

      const result = validators.tournament.formData(validTournamentData)
      expect(result.success).toBe(true)
    })
  })

  describe('createValidationResult', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0)
    })

    it('should create success result for valid data', () => {
      const data = { name: 'John', age: 30 }
      const zodResult = testSchema.safeParse(data)
      const result = createValidationResult(zodResult)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.error).toBeUndefined()
    })

    it('should create error result for invalid data', () => {
      const data = { name: '', age: -1 }
      const zodResult = testSchema.safeParse(data)
      const result = createValidationResult(zodResult)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Validation failed')
      expect(result.error?.issues).toBeDefined()
    })
  })

  describe('validateOrThrow', () => {
    const testSchema = z.object({
      name: z.string().min(1)
    })

    it('should return validated data for valid input', () => {
      const data = { name: 'John' }
      const result = validateOrThrow(testSchema, data)
      expect(result).toEqual(data)
    })

    it('should throw error for invalid input', () => {
      const data = { name: '' }
      expect(() => validateOrThrow(testSchema, data)).toThrow()
    })

    it('should throw custom error message', () => {
      const data = { name: '' }
      expect(() => validateOrThrow(testSchema, data, 'Custom error')).toThrow('Custom error')
    })
  })

  describe('createValidationMiddleware', () => {
    const testSchema = z.object({
      name: z.string().min(1)
    })

    it('should create middleware that validates successfully', () => {
      const middleware = createValidationMiddleware(testSchema)
      const data = { name: 'John' }
      
      expect(() => middleware(data)).not.toThrow()
      expect(middleware(data)).toEqual(data)
    })

    it('should create middleware that throws on invalid data', () => {
      const middleware = createValidationMiddleware(testSchema)
      const data = { name: '' }
      
      expect(() => middleware(data)).toThrow('Request validation failed')
    })
  })

  describe('validateBatch', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0)
    })

    it('should validate array of valid items successfully', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]

      const result = validateBatch(testSchema, data)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.error).toBeUndefined()
    })

    it('should handle array with invalid items', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: '', age: -1 }, // Invalid
        { name: 'Jane', age: 25 }
      ]

      const result = validateBatch(testSchema, data)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error?.issues).toHaveLength(2) // Two validation errors
      expect(result.error?.issues[0].path).toEqual(['[1]', 'name'])
    })

    it('should handle empty array', () => {
      const result = validateBatch(testSchema, [])
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should include index information in error paths', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: '', age: 25 } // Invalid name at index 1
      ]

      const result = validateBatch(testSchema, data)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].path).toEqual(['[1]', 'name'])
    })
  })

  describe('createPartialSchema', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
      email: z.string().email()
    })

    it('should create partial schema with all fields optional', () => {
      const partialSchema = createPartialSchema(testSchema)
      
      // Should accept empty object
      expect(partialSchema.safeParse({}).success).toBe(true)
      
      // Should accept partial data
      expect(partialSchema.safeParse({ name: 'John' }).success).toBe(true)
      
      // Should still validate provided fields
      expect(partialSchema.safeParse({ email: 'invalid' }).success).toBe(false)
    })

    it('should maintain validation rules for provided fields', () => {
      const partialSchema = createPartialSchema(testSchema)
      
      const validResult = partialSchema.safeParse({
        name: 'John',
        email: 'john@example.com'
      })
      expect(validResult.success).toBe(true)
      
      const invalidResult = partialSchema.safeParse({
        name: '', // Still invalid
        age: 30
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('composeSchemas', () => {
    const baseSchema = z.object({
      name: z.string(),
      age: z.number()
    })

    const extensionSchema = z.object({
      email: z.string().email(),
      phone: z.string().optional()
    })

    it('should merge schemas correctly', () => {
      const composedSchema = composeSchemas(baseSchema, extensionSchema)
      
      const validData = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
        phone: '123-456-7890'
      }

      const result = composedSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should validate all fields from both schemas', () => {
      const composedSchema = composeSchemas(baseSchema, extensionSchema)
      
      // Missing required field from base schema
      const result1 = composedSchema.safeParse({
        email: 'john@example.com'
      })
      expect(result1.success).toBe(false)
      
      // Invalid field from extension schema
      const result2 = composedSchema.safeParse({
        name: 'John',
        age: 30,
        email: 'invalid-email'
      })
      expect(result2.success).toBe(false)
    })

    it('should handle overlapping fields by taking extension schema rules', () => {
      const schema1 = z.object({
        name: z.string().min(1)
      })

      const schema2 = z.object({
        name: z.string().min(5) // More restrictive
      })

      const composedSchema = composeSchemas(schema1, schema2)
      
      // Should use the more restrictive rule from schema2
      expect(composedSchema.safeParse({ name: 'John' }).success).toBe(false)
      expect(composedSchema.safeParse({ name: 'John Doe' }).success).toBe(true)
    })
  })

  describe('default export', () => {
    it('should export all utilities', () => {
      expect(validationModule.schemas).toBeDefined()
      expect(validationModule.validators).toBeDefined()
      expect(validationModule.createValidationResult).toBeDefined()
      expect(validationModule.validateOrThrow).toBeDefined()
      expect(validationModule.createValidationMiddleware).toBeDefined()
      expect(validationModule.validateBatch).toBeDefined()
      expect(validationModule.createPartialSchema).toBeDefined()
      expect(validationModule.composeSchemas).toBeDefined()
    })
  })

  describe('Type exports', () => {
    it('should export validation result types', () => {
      // These are type-only tests, so we just verify they compile
      // by using them in variable declarations
      const tournamentResult: import('@/lib/validation').TournamentValidationResult = {
        success: true,
        data: {
          id: 'tournament-123',
          name: 'Test Tournament',
          type: 'single-elimination',
          status: 'active',
          format: 'triples',
          maxPoints: 13,
          shortForm: false,
          startDate: '2024-08-20T10:00:00.000Z',
          organizer: 'Test Organizer',
          maxPlayers: 24,
          currentPlayers: 16,
          settings: {
            allowLateRegistration: true,
            automaticBracketGeneration: true,
            requireCheckin: true,
            courtAssignmentMode: 'automatic',
            scoringMode: 'official-only',
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
      }

      expect(tournamentResult.success).toBe(true)
    })
  })
})