/**
 * @jest-environment node
 */

import {
  getTournamentStatsSummary,
  getUpcomingTournaments,
  getActiveTournaments,
  getCompletedTournaments,
  getTournamentsInDateRange,
  createTournamentFromTemplate,
  getTournamentProgress,
  getTournamentDuration,
  validateTournamentFormData,
  getTournamentsByOrganizer,
  getTournamentTypesWithCounts
} from '@/lib/actions/tournament-utils'
import { tournamentDB } from '@/lib/db/tournaments'
import { Tournament, TournamentFormData } from '@/types'

// Mock the database
jest.mock('@/lib/db/tournaments')
const mockTournamentDB = tournamentDB as jest.Mocked<typeof tournamentDB>

// Mock validation
jest.mock('@/lib/validation/tournament', () => ({
  validateTournamentFormData: jest.fn()
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
  currentPlayers: 8,
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
    totalMatches: 15,
    completedMatches: 7,
    averageMatchDuration: 45,
    totalEnds: 63,
    highestScore: 13,
    averageScore: 8.5
  },
  createdAt: '2024-11-01T10:00:00Z',
  updatedAt: '2024-11-01T10:00:00Z'
}

const upcomingTournament: Tournament = {
  ...sampleTournament,
  id: 'upcoming-tournament',
  name: 'Upcoming Tournament',
  startDate: '2024-12-15T10:00:00Z'
}

const activeTournament: Tournament = {
  ...sampleTournament,
  id: 'active-tournament',
  name: 'Active Tournament',
  status: 'active',
  startDate: '2024-11-20T10:00:00Z'
}

const completedTournament: Tournament = {
  ...sampleTournament,
  id: 'completed-tournament',
  name: 'Completed Tournament',
  status: 'completed',
  startDate: '2024-10-01T10:00:00Z',
  endDate: '2024-10-03T18:00:00Z'
}

describe('Tournament Utility Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTournamentStatsSummary', () => {
    it('should return tournament statistics successfully', async () => {
      const mockStats = {
        total: 10,
        byStatus: {
          setup: 3,
          active: 2,
          completed: 4,
          cancelled: 1
        },
        byType: {
          'single-elimination': 5,
          'double-elimination': 3,
          'swiss': 2
        },
        byFormat: {
          singles: 6,
          doubles: 3,
          triples: 1
        },
        totalPlayers: 150,
        averagePlayersPerTournament: 15
      }
      mockTournamentDB.getStatsSummary.mockResolvedValue({ data: mockStats, error: null })

      const result = await getTournamentStatsSummary()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.total).toBe(10)
        expect(result.data.totalPlayers).toBe(150)
        expect(result.data.averagePlayersPerTournament).toBe(15)
      }
    })

    it('should handle database errors', async () => {
      mockTournamentDB.getStatsSummary.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      })

      const result = await getTournamentStatsSummary()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database connection failed')
      }
    })
  })

  describe('getUpcomingTournaments', () => {
    it('should return upcoming tournaments successfully', async () => {
      mockTournamentDB.findUpcoming.mockResolvedValue({ 
        data: [upcomingTournament], 
        error: null 
      })

      const result = await getUpcomingTournaments()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('setup')
      }
    })

    it('should return empty array when no upcoming tournaments', async () => {
      mockTournamentDB.findUpcoming.mockResolvedValue({ data: [], error: null })

      const result = await getUpcomingTournaments()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(0)
      }
    })
  })

  describe('getActiveTournaments', () => {
    it('should return active tournaments successfully', async () => {
      mockTournamentDB.findActive.mockResolvedValue({ 
        data: [activeTournament], 
        error: null 
      })

      const result = await getActiveTournaments()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('active')
      }
    })
  })

  describe('getCompletedTournaments', () => {
    it('should return completed tournaments successfully', async () => {
      mockTournamentDB.findCompleted.mockResolvedValue({ 
        data: [completedTournament], 
        error: null 
      })

      const result = await getCompletedTournaments()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('completed')
      }
    })
  })

  describe('getTournamentsInDateRange', () => {
    it('should return tournaments in date range successfully', async () => {
      const tournamentsInRange = [sampleTournament, activeTournament]
      mockTournamentDB.findInDateRange.mockResolvedValue({ 
        data: tournamentsInRange, 
        error: null 
      })

      const result = await getTournamentsInDateRange(
        '2024-11-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(mockTournamentDB.findInDateRange).toHaveBeenCalledWith(
        new Date('2024-11-01T00:00:00Z'),
        new Date('2024-12-31T23:59:59Z')
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })

    it('should handle invalid date range', async () => {
      const result = await getTournamentsInDateRange(
        '2024-12-31T00:00:00Z',
        '2024-11-01T23:59:59Z'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('End date must be after start date')
      }
    })

    it('should handle invalid date format', async () => {
      const result = await getTournamentsInDateRange(
        'invalid-date',
        '2024-12-31T23:59:59Z'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid date format. Use ISO date strings')
      }
    })

    it('should handle missing dates', async () => {
      const result = await getTournamentsInDateRange('', '2024-12-31T23:59:59Z')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Start date and end date are required')
      }
    })
  })

  describe('createTournamentFromTemplate', () => {
    it('should create tournament from template successfully', async () => {
      const templateOverrides: Partial<TournamentFormData> = {
        name: 'New Tournament from Template',
        startDate: '2024-12-20T10:00:00Z',
        maxPlayers: 32
      }
      
      const newTournament = { 
        ...sampleTournament, 
        id: 'new-tournament', 
        name: 'New Tournament from Template',
        maxPlayers: 32
      }
      
      mockTournamentDB.createFromTemplate.mockResolvedValue({ 
        data: newTournament, 
        error: null 
      })

      const result = await createTournamentFromTemplate('template-1', templateOverrides)

      expect(mockTournamentDB.createFromTemplate).toHaveBeenCalledWith('template-1', templateOverrides)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('New Tournament from Template')
        expect(result.data.maxPlayers).toBe(32)
        expect(result.message).toBe('Tournament created from template successfully')
      }
    })

    it('should handle missing template ID', async () => {
      const result = await createTournamentFromTemplate('', {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Template ID is required')
      }
    })

    it('should handle template not found', async () => {
      mockTournamentDB.createFromTemplate.mockResolvedValue({
        data: null,
        error: new Error('Tournament template with ID template-nonexistent not found')
      })

      const result = await createTournamentFromTemplate('template-nonexistent', {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament template with ID template-nonexistent not found')
      }
    })
  })

  describe('getTournamentProgress', () => {
    it('should return tournament progress successfully', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: sampleTournament, error: null })
      
      // Mock the dynamic import
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          getProgress: () => 47 // 7/15 matches completed ≈ 47%
        }
      }), { virtual: true })

      const result = await getTournamentProgress('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.progress).toBe(47)
        expect(result.data.isComplete).toBe(false)
      }
    })

    it('should handle completed tournament', async () => {
      const completedStats = { ...completedTournament, stats: { ...completedTournament.stats, completedMatches: 15, totalMatches: 15 } }
      mockTournamentDB.findById.mockResolvedValue({ data: completedStats, error: null })
      
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          getProgress: () => 100
        }
      }), { virtual: true })

      const result = await getTournamentProgress('completed-tournament')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.progress).toBe(100)
        expect(result.data.isComplete).toBe(true)
      }
    })
  })

  describe('getTournamentDuration', () => {
    it('should return tournament duration for completed tournament', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: completedTournament, error: null })
      
      // Mock the dynamic import - duration between Oct 1 10:00 and Oct 3 18:00 = 56 hours
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          getDuration: () => 56
        }
      }), { virtual: true })

      const result = await getTournamentDuration('completed-tournament')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.duration).toBe(56)
        expect(result.data.isOngoing).toBe(false)
      }
    })

    it('should handle ongoing tournament', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: activeTournament, error: null })
      
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          getDuration: () => null
        }
      }), { virtual: true })

      const result = await getTournamentDuration('active-tournament')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.duration).toBeNull()
        expect(result.data.isOngoing).toBe(true)
      }
    })
  })

  describe('validateTournamentFormData', () => {
    it('should validate form data successfully', async () => {
      const mockValidate = require('@/lib/validation/tournament').validateTournamentFormData
      const validData: TournamentFormData = {
        name: 'Test Tournament',
        type: 'single-elimination',
        format: 'singles',
        maxPoints: 13,
        shortForm: false,
        startDate: '2024-12-01T10:00:00Z',
        organizer: 'Test Organizer',
        maxPlayers: 16,
        settings: {}
      }
      
      mockValidate.mockReturnValue({ success: true, data: validData })

      const result = await validateTournamentFormData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test Tournament')
      }
    })

    it('should handle validation errors', async () => {
      const mockValidate = require('@/lib/validation/tournament').validateTournamentFormData
      const invalidData = { name: '' }
      
      mockValidate.mockReturnValue({
        success: false,
        error: {
          errors: [
            { path: ['name'], message: 'Tournament name is required' },
            { path: ['organizer'], message: 'Organizer name is required' }
          ]
        }
      })

      const result = await validateTournamentFormData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Validation failed')
        expect(result.fieldErrors).toEqual({
          'name': ['Tournament name is required'],
          'organizer': ['Organizer name is required']
        })
      }
    })
  })

  describe('getTournamentsByOrganizer', () => {
    it('should return tournaments by organizer successfully', async () => {
      const organizerTournaments = [sampleTournament, activeTournament]
      mockTournamentDB.findByOrganizer.mockResolvedValue({ 
        data: organizerTournaments, 
        error: null 
      })

      const result = await getTournamentsByOrganizer('Test Organizer')

      expect(mockTournamentDB.findByOrganizer).toHaveBeenCalledWith('Test Organizer')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })

    it('should handle empty organizer name', async () => {
      const result = await getTournamentsByOrganizer('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Organizer name is required')
      }
    })
  })

  describe('getTournamentTypesWithCounts', () => {
    it('should return tournament types with counts successfully', async () => {
      const mockStats = {
        total: 10,
        byStatus: {},
        byType: {
          'single-elimination': 5,
          'double-elimination': 3,
          'swiss': 2
        },
        byFormat: {},
        totalPlayers: 150,
        averagePlayersPerTournament: 15
      }
      mockTournamentDB.getStatsSummary.mockResolvedValue({ data: mockStats, error: null })

      const result = await getTournamentTypesWithCounts()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(3)
        expect(result.data[0]).toEqual({ type: 'single-elimination', count: 5 })
        expect(result.data[1]).toEqual({ type: 'double-elimination', count: 3 })
        expect(result.data[2]).toEqual({ type: 'swiss', count: 2 })
      }
    })
  })
})