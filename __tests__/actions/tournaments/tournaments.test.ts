/**
 * @jest-environment node
 */

import {
  getTournaments,
  getTournamentById,
  createTournament,
  createTournamentData,
  updateTournament,
  updateTournamentData,
  deleteTournament,
  searchTournaments
} from '@/lib/actions/tournaments'
import { tournamentDB } from '@/lib/db/tournaments'
import { Tournament, TournamentFormData } from '@/types'

// Mock the database
jest.mock('@/lib/db/tournaments')
const mockTournamentDB = tournamentDB as jest.Mocked<typeof tournamentDB>

// Mock Next.js revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Sample tournament data
const sampleTournament: Tournament = {
  id: 'test-tournament-1',
  name: 'Test Tournament',
  type: 'single-elimination',
  status: 'setup',
  format: 'singles',
  maxPoints: 13,
  shortForm: false,
  startDate: '2024-12-01T10:00:00Z',
  description: 'A test tournament',
  location: 'Test Location',
  organizer: 'Test Organizer',
  maxPlayers: 16,
  currentPlayers: 0,
  settings: {
    allowLateRegistration: true,
    automaticBracketGeneration: true,
    requireCheckin: true,
    courtAssignmentMode: 'automatic',
    scoringMode: 'self-report',
    realTimeUpdates: true,
    allowSpectators: true
  },
  stats: {
    totalMatches: 0,
    completedMatches: 0,
    averageMatchDuration: 0,
    totalEnds: 0,
    highestScore: 0,
    averageScore: 0
  },
  createdAt: '2024-11-01T10:00:00Z',
  updatedAt: '2024-11-01T10:00:00Z'
}

const sampleFormData: TournamentFormData = {
  name: 'Test Tournament',
  type: 'single-elimination',
  format: 'singles',
  maxPoints: 13,
  shortForm: false,
  startDate: '2024-12-01T10:00:00Z',
  description: 'A test tournament',
  location: 'Test Location',
  organizer: 'Test Organizer',
  maxPlayers: 16,
  settings: {
    allowLateRegistration: true,
    automaticBracketGeneration: true,
    requireCheckin: true,
    courtAssignmentMode: 'automatic',
    scoringMode: 'self-report',
    realTimeUpdates: true,
    allowSpectators: true
  }
}

describe('Tournament Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTournaments', () => {
    it('should return paginated tournaments successfully', async () => {
      const mockTournaments = [sampleTournament]
      mockTournamentDB.findAll.mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getTournaments({ page: 1, limit: 20 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tournaments).toHaveLength(1)
        expect(result.data.pagination.total).toBe(1)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(20)
      }
    })

    it('should filter tournaments by status', async () => {
      const activeTournament = { ...sampleTournament, status: 'active' as const }
      mockTournamentDB.findByStatus.mockResolvedValue({ data: [activeTournament], error: null })

      const result = await getTournaments({ status: 'active' })

      expect(mockTournamentDB.findByStatus).toHaveBeenCalledWith('active')
      expect(result.success).toBe(true)
    })

    it('should handle database errors', async () => {
      mockTournamentDB.findAll.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      })

      const result = await getTournaments()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database error')
      }
    })

    it('should apply location filtering', async () => {
      const tournaments = [
        { ...sampleTournament, location: 'New York' },
        { ...sampleTournament, id: 'test-2', location: 'Los Angeles' }
      ]
      mockTournamentDB.findAll.mockResolvedValue({ data: tournaments, error: null })

      const result = await getTournaments({ location: 'new' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tournaments).toHaveLength(1)
        expect(result.data.tournaments[0].location).toBe('New York')
      }
    })
  })

  describe('getTournamentById', () => {
    it('should return tournament by ID successfully', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: sampleTournament, error: null })

      const result = await getTournamentById('test-tournament-1')

      expect(mockTournamentDB.findById).toHaveBeenCalledWith('test-tournament-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('test-tournament-1')
      }
    })

    it('should handle tournament not found', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: null, error: null })

      const result = await getTournamentById('nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Tournament with ID 'nonexistent' not found")
      }
    })

    it('should handle missing ID', async () => {
      const result = await getTournamentById('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament ID is required')
      }
    })
  })

  describe('createTournament', () => {
    it('should create tournament from FormData successfully', async () => {
      mockTournamentDB.create.mockResolvedValue({ data: sampleTournament, error: null })

      // Create FormData
      const formData = new FormData()
      formData.set('name', 'Test Tournament')
      formData.set('type', 'single-elimination')
      formData.set('format', 'singles')
      formData.set('maxPoints', '13')
      formData.set('shortForm', 'false')
      formData.set('startDate', '2024-12-01T10:00:00Z')
      formData.set('organizer', 'Test Organizer')
      formData.set('maxPlayers', '16')

      const result = await createTournament(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test Tournament')
        expect(result.message).toBe('Tournament created successfully')
      }
    })

    it('should handle validation errors', async () => {
      const formData = new FormData()
      formData.set('name', '') // Invalid - required field

      const result = await createTournament(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Validation failed')
        expect(result.fieldErrors).toBeDefined()
      }
    })

    it('should handle database creation errors', async () => {
      mockTournamentDB.create.mockResolvedValue({ 
        data: null, 
        error: new Error('Creation failed') 
      })

      const formData = new FormData()
      formData.set('name', 'Test Tournament')
      formData.set('type', 'single-elimination')
      formData.set('format', 'singles')
      formData.set('organizer', 'Test Organizer')
      formData.set('maxPlayers', '16')
      formData.set('startDate', '2024-12-01T10:00:00Z')

      const result = await createTournament(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Creation failed')
      }
    })
  })

  describe('createTournamentData', () => {
    it('should create tournament with typed data successfully', async () => {
      mockTournamentDB.create.mockResolvedValue({ data: sampleTournament, error: null })

      const result = await createTournamentData(sampleFormData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test Tournament')
      }
    })

    it('should handle validation errors with typed data', async () => {
      const invalidData = { ...sampleFormData, name: '' }

      const result = await createTournamentData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Validation failed')
      }
    })
  })

  describe('updateTournament', () => {
    it('should update tournament successfully', async () => {
      const updatedTournament = { ...sampleTournament, name: 'Updated Tournament' }
      mockTournamentDB.update.mockResolvedValue({ data: updatedTournament, error: null })

      const formData = new FormData()
      formData.set('name', 'Updated Tournament')

      const result = await updateTournament('test-tournament-1', formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Updated Tournament')
        expect(result.message).toBe('Tournament updated successfully')
      }
    })

    it('should handle missing tournament ID', async () => {
      const formData = new FormData()
      
      const result = await updateTournament('', formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament ID is required')
      }
    })
  })

  describe('updateTournamentData', () => {
    it('should update tournament with typed data successfully', async () => {
      const updatedTournament = { ...sampleTournament, name: 'Updated Tournament' }
      mockTournamentDB.update.mockResolvedValue({ data: updatedTournament, error: null })

      const result = await updateTournamentData('test-tournament-1', { name: 'Updated Tournament' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Updated Tournament')
      }
    })
  })

  describe('deleteTournament', () => {
    it('should delete tournament successfully', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: sampleTournament, error: null })
      mockTournamentDB.delete.mockResolvedValue({ data: sampleTournament, error: null })

      const result = await deleteTournament('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('test-tournament-1')
        expect(result.data.archived).toBe(true)
        expect(result.message).toBe('Tournament archived successfully')
      }
    })

    it('should prevent deletion of active tournament', async () => {
      const activeTournament = { ...sampleTournament, status: 'active' as const }
      mockTournamentDB.findById.mockResolvedValue({ data: activeTournament, error: null })

      const result = await deleteTournament('test-tournament-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Cannot delete an active tournament. Cancel it first.')
      }
    })

    it('should handle tournament not found', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: null, error: null })

      const result = await deleteTournament('nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Tournament with ID 'nonexistent' not found")
      }
    })
  })

  describe('searchTournaments', () => {
    it('should search tournaments successfully', async () => {
      const searchResults = [sampleTournament]
      mockTournamentDB.search.mockResolvedValue({ data: searchResults, error: null })

      const result = await searchTournaments('Test', { status: 'setup' })

      expect(mockTournamentDB.search).toHaveBeenCalledWith('Test')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
      }
    })

    it('should handle empty search query', async () => {
      const result = await searchTournaments('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Search query is required')
      }
    })

    it('should apply filters to search results', async () => {
      const tournaments = [
        { ...sampleTournament, status: 'setup' as const },
        { ...sampleTournament, id: 'test-2', status: 'active' as const }
      ]
      mockTournamentDB.search.mockResolvedValue({ data: tournaments, error: null })

      const result = await searchTournaments('Test', { status: 'active' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('active')
      }
    })

    it('should filter by date range', async () => {
      const tournaments = [
        { ...sampleTournament, startDate: '2024-12-01T10:00:00Z' },
        { ...sampleTournament, id: 'test-2', startDate: '2025-01-01T10:00:00Z' }
      ]
      mockTournamentDB.search.mockResolvedValue({ data: tournaments, error: null })

      const result = await searchTournaments('Test', {
        dateRange: {
          start: '2024-11-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z'
        }
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].startDate).toBe('2024-12-01T10:00:00Z')
      }
    })
  })
})