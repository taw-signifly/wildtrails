/**
 * @jest-environment node
 */

import {
  startTournament,
  registerPlayerForTournament,
  removePlayerFromTournament,
  cancelTournament,
  completeTournament,
  updateTournamentStats,
  canStartTournament,
  canAddPlayerToTournament
} from '@/lib/actions/tournament-management'
import { tournamentDB } from '@/lib/db/tournaments'
import { Tournament } from '@/types'

// Mock the database
jest.mock('@/lib/db/tournaments')
const mockTournamentDB = tournamentDB as jest.Mocked<typeof tournamentDB>

// Mock Next.js revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock TournamentUtils
jest.mock('@/lib/db/tournaments', () => ({
  ...jest.requireActual('@/lib/db/tournaments'),
  TournamentUtils: {
    canStart: jest.fn(),
    canAddPlayer: jest.fn(),
  }
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
  currentPlayers: 4,
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

describe('Tournament Management Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('startTournament', () => {
    it('should start tournament successfully', async () => {
      const activeTournament = { ...sampleTournament, status: 'active' as const }
      mockTournamentDB.startTournament.mockResolvedValue({ data: activeTournament, error: null })

      const result = await startTournament('test-tournament-1')

      expect(mockTournamentDB.startTournament).toHaveBeenCalledWith('test-tournament-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active')
        expect(result.message).toBe('Tournament started successfully')
      }
    })

    it('should handle missing tournament ID', async () => {
      const result = await startTournament('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament ID is required')
      }
    })

    it('should handle business rule violations', async () => {
      mockTournamentDB.startTournament.mockResolvedValue({
        data: null,
        error: new Error('Minimum 4 players required to start tournament. Current: 2')
      })

      const result = await startTournament('test-tournament-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Minimum 4 players required to start tournament. Current: 2')
      }
    })

    it('should handle tournament not in setup status', async () => {
      mockTournamentDB.startTournament.mockResolvedValue({
        data: null,
        error: new Error('Tournament is not in setup status. Current status: active')
      })

      const result = await startTournament('test-tournament-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament is not in setup status. Current status: active')
      }
    })
  })

  describe('registerPlayerForTournament', () => {
    it('should register player successfully', async () => {
      const updatedTournament = { ...sampleTournament, currentPlayers: 5 }
      mockTournamentDB.addPlayer.mockResolvedValue({ data: updatedTournament, error: null })

      const result = await registerPlayerForTournament('test-tournament-1', 'player-1')

      expect(mockTournamentDB.addPlayer).toHaveBeenCalledWith('test-tournament-1', 'player-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currentPlayers).toBe(5)
        expect(result.message).toBe('Player registered successfully')
      }
    })

    it('should handle missing tournament ID', async () => {
      const result = await registerPlayerForTournament('', 'player-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament ID is required')
      }
    })

    it('should handle missing player ID', async () => {
      const result = await registerPlayerForTournament('test-tournament-1', '')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Player ID is required')
      }
    })

    it('should handle tournament full error', async () => {
      mockTournamentDB.addPlayer.mockResolvedValue({
        data: null,
        error: new Error('Tournament is full. Maximum players: 16')
      })

      const result = await registerPlayerForTournament('test-tournament-1', 'player-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament is full. Maximum players: 16')
      }
    })

    it('should handle late registration not allowed', async () => {
      mockTournamentDB.addPlayer.mockResolvedValue({
        data: null,
        error: new Error('Late registration is not allowed for this tournament')
      })

      const result = await registerPlayerForTournament('test-tournament-1', 'player-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Late registration is not allowed for this tournament')
      }
    })
  })

  describe('removePlayerFromTournament', () => {
    it('should remove player successfully', async () => {
      const updatedTournament = { ...sampleTournament, currentPlayers: 3 }
      mockTournamentDB.removePlayer.mockResolvedValue({ data: updatedTournament, error: null })

      const result = await removePlayerFromTournament('test-tournament-1', 'player-1')

      expect(mockTournamentDB.removePlayer).toHaveBeenCalledWith('test-tournament-1', 'player-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currentPlayers).toBe(3)
        expect(result.message).toBe('Player removed successfully')
      }
    })

    it('should handle active tournament error', async () => {
      mockTournamentDB.removePlayer.mockResolvedValue({
        data: null,
        error: new Error('Cannot remove players from active tournament')
      })

      const result = await removePlayerFromTournament('test-tournament-1', 'player-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Cannot remove players from active tournament')
      }
    })
  })

  describe('cancelTournament', () => {
    it('should cancel tournament successfully', async () => {
      const cancelledTournament = { 
        ...sampleTournament, 
        status: 'cancelled' as const,
        endDate: '2024-11-15T10:00:00Z'
      }
      mockTournamentDB.cancelTournament.mockResolvedValue({ data: cancelledTournament, error: null })

      const result = await cancelTournament('test-tournament-1')

      expect(mockTournamentDB.cancelTournament).toHaveBeenCalledWith('test-tournament-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('cancelled')
        expect(result.message).toBe('Tournament cancelled successfully')
      }
    })

    it('should handle missing tournament ID', async () => {
      const result = await cancelTournament('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament ID is required')
      }
    })
  })

  describe('completeTournament', () => {
    it('should complete tournament successfully', async () => {
      const completedTournament = { 
        ...sampleTournament, 
        status: 'completed' as const,
        endDate: '2024-12-05T18:00:00Z',
        stats: {
          ...sampleTournament.stats,
          totalMatches: 15,
          completedMatches: 15,
          averageMatchDuration: 45
        }
      }
      mockTournamentDB.completeTournament.mockResolvedValue({ data: completedTournament, error: null })

      const finalStats = {
        totalMatches: 15,
        completedMatches: 15,
        averageMatchDuration: 45
      }

      const result = await completeTournament('test-tournament-1', finalStats)

      expect(mockTournamentDB.completeTournament).toHaveBeenCalledWith('test-tournament-1', finalStats)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('completed')
        expect(result.message).toBe('Tournament completed successfully')
      }
    })

    it('should handle tournament not active error', async () => {
      mockTournamentDB.completeTournament.mockResolvedValue({
        data: null,
        error: new Error('Tournament is not active. Current status: setup')
      })

      const result = await completeTournament('test-tournament-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Tournament is not active. Current status: setup')
      }
    })
  })

  describe('updateTournamentStats', () => {
    it('should update tournament stats successfully', async () => {
      const updatedTournament = { 
        ...sampleTournament,
        stats: {
          ...sampleTournament.stats,
          totalMatches: 8,
          completedMatches: 3,
          highestScore: 13
        }
      }
      mockTournamentDB.updateStats.mockResolvedValue({ data: updatedTournament, error: null })

      const statsUpdate = {
        totalMatches: 8,
        completedMatches: 3,
        highestScore: 13
      }

      const result = await updateTournamentStats('test-tournament-1', statsUpdate)

      expect(mockTournamentDB.updateStats).toHaveBeenCalledWith('test-tournament-1', statsUpdate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.stats.totalMatches).toBe(8)
        expect(result.message).toBe('Tournament statistics updated successfully')
      }
    })
  })

  describe('canStartTournament', () => {
    it('should return true when tournament can start', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: sampleTournament, error: null })
      
      // Mock the dynamic import
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          canStart: () => ({ canStart: true })
        }
      }), { virtual: true })

      const result = await canStartTournament('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canStart).toBe(true)
      }
    })

    it('should return false when tournament cannot start', async () => {
      const tournamentWithFewPlayers = { ...sampleTournament, currentPlayers: 2 }
      mockTournamentDB.findById.mockResolvedValue({ data: tournamentWithFewPlayers, error: null })
      
      // Mock the dynamic import
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          canStart: () => ({ canStart: false, reason: 'Minimum 4 players required (current: 2)' })
        }
      }), { virtual: true })

      const result = await canStartTournament('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canStart).toBe(false)
        expect(result.data.reason).toBe('Minimum 4 players required (current: 2)')
      }
    })

    it('should handle tournament not found', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: null, error: null })

      const result = await canStartTournament('nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Tournament with ID 'nonexistent' not found")
      }
    })
  })

  describe('canAddPlayerToTournament', () => {
    it('should return true when player can be added', async () => {
      mockTournamentDB.findById.mockResolvedValue({ data: sampleTournament, error: null })
      
      // Mock the dynamic import
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          canAddPlayer: () => ({ canAdd: true })
        }
      }), { virtual: true })

      const result = await canAddPlayerToTournament('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canAdd).toBe(true)
      }
    })

    it('should return false when tournament is full', async () => {
      const fullTournament = { ...sampleTournament, currentPlayers: 16 }
      mockTournamentDB.findById.mockResolvedValue({ data: fullTournament, error: null })
      
      // Mock the dynamic import
      jest.doMock('@/lib/db/tournaments', () => ({
        TournamentUtils: {
          canAddPlayer: () => ({ canAdd: false, reason: 'Tournament is full' })
        }
      }), { virtual: true })

      const result = await canAddPlayerToTournament('test-tournament-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canAdd).toBe(false)
        expect(result.data.reason).toBe('Tournament is full')
      }
    })
  })
})