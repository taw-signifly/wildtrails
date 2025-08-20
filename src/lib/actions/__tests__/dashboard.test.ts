import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { TournamentDB } from '@/lib/db/tournaments'
import { PlayerDB } from '@/lib/db/players'
import { MatchDB } from '@/lib/db/matches'
import { DatabaseError } from '@/lib/db/base'
import {
  getDashboardStats,
  getDashboardStatsAction,
  getRecentTournaments,
  getRecentTournamentsAction,
  getActiveMatches,
  getActiveMatchesAction,
  getRecentActivity,
  getRecentActivityAction
} from '../dashboard'
import { Tournament, Player, Match } from '@/types'

// Mock the database classes
jest.mock('@/lib/db/tournaments')
jest.mock('@/lib/db/players')
jest.mock('@/lib/db/matches')

// Mock logger to avoid console output during tests
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  PerformanceTimer: jest.fn().mockImplementation((operation: string) => ({
    end: jest.fn(),
    endWithError: jest.fn()
  }))
}))

describe('Dashboard Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getDashboardStats', () => {
    it('should return correct dashboard statistics', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: '1',
          name: 'Test Tournament 1',
          status: 'active',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        } as Tournament,
        {
          id: '2',
          name: 'Test Tournament 2',
          status: 'setup',
          createdAt: '2024-01-02',
          updatedAt: '2024-01-02'
        } as Tournament,
        {
          id: '3',
          name: 'Test Tournament 3',
          status: 'completed',
          createdAt: '2024-01-03',
          updatedAt: '2024-01-03'
        } as Tournament
      ]

      const mockPlayers: Player[] = [
        { id: '1', name: 'Player 1' } as Player,
        { id: '2', name: 'Player 2' } as Player
      ]

      const mockMatches: Match[] = [
        { id: '1', status: 'active' } as Match,
        { id: '2', status: 'completed' } as Match,
        { id: '3', status: 'active' } as Match
      ]

      // Mock successful database responses
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })
      ;(PlayerDB as jest.MockedClass<typeof PlayerDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockPlayers, error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })

      const result = await getDashboardStats()

      expect(result.error).toBeNull()
      expect(result.data).toEqual({
        activeTournaments: 2, // active + setup
        registeredPlayers: 2,
        liveMatches: 2, // active matches
        totalMatches: 3
      })
    })

    it('should handle database error for tournaments', async () => {
      const dbError = new DatabaseError('Tournament database error')
      
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: dbError })
      ;(PlayerDB as jest.MockedClass<typeof PlayerDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })

      const result = await getDashboardStats()

      expect(result.error).toBe(dbError)
      expect(result.data).toBeNull()
    })

    it('should handle database error for players', async () => {
      const dbError = new DatabaseError('Player database error')
      
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })
      ;(PlayerDB as jest.MockedClass<typeof PlayerDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: dbError })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })

      const result = await getDashboardStats()

      expect(result.error).toBe(dbError)
      expect(result.data).toBeNull()
    })

    it('should handle invalid tournament data gracefully', async () => {
      const invalidTournaments = [
        { id: '1', status: 'active' }, // Missing name
        null, // Null tournament
        { id: '2', name: 'Valid Tournament', status: 'setup' }
      ]

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: invalidTournaments, error: null })
      ;(PlayerDB as jest.MockedClass<typeof PlayerDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })

      const result = await getDashboardStats()

      expect(result.error).toBeNull()
      expect(result.data?.activeTournaments).toBe(1) // Only the valid tournament
    })
  })

  describe('getDashboardStatsAction', () => {
    it('should convert Result to ActionResult successfully', async () => {
      const mockStats = {
        activeTournaments: 1,
        registeredPlayers: 2,
        liveMatches: 1,
        totalMatches: 3
      }

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [{ status: 'active', name: 'Test' }], error: null })
      ;(PlayerDB as jest.MockedClass<typeof PlayerDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [{}, {}], error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [{ status: 'active' }, {}, {}], error: null })

      const result = await getDashboardStatsAction()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatchObject({
          activeTournaments: expect.any(Number),
          registeredPlayers: expect.any(Number),
          liveMatches: expect.any(Number),
          totalMatches: expect.any(Number)
        })
        expect(result.message).toBe('Dashboard stats loaded successfully')
      }
    })

    it('should convert database error to ActionResult error', async () => {
      const dbError = new DatabaseError('Database connection failed')
      
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: dbError })

      const result = await getDashboardStatsAction()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database connection failed')
      }
    })
  })

  describe('getRecentTournaments', () => {
    it('should return recent tournaments sorted by creation date', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: '1',
          name: 'Oldest Tournament',
          status: 'completed',
          maxPlayers: 16,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        } as Tournament,
        {
          id: '2',
          name: 'Newest Tournament',
          status: 'active',
          maxPlayers: 32,
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z'
        } as Tournament,
        {
          id: '3',
          name: 'Middle Tournament',
          status: 'setup',
          maxPlayers: 8,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        } as Tournament
      ]

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getRecentTournaments()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(3)
      
      if (result.data) {
        // Should be sorted by creation date (newest first)
        expect(result.data[0].name).toBe('Newest Tournament')
        expect(result.data[1].name).toBe('Middle Tournament')
        expect(result.data[2].name).toBe('Oldest Tournament')
      }
    })

    it('should limit results to top 3 tournaments', async () => {
      const mockTournaments: Tournament[] = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Tournament ${i + 1}`,
        status: 'active',
        maxPlayers: 16,
        createdAt: `2024-01-0${i + 1}T00:00:00Z`,
        updatedAt: `2024-01-0${i + 1}T00:00:00Z`
      } as Tournament))

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getRecentTournaments()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(3)
    })

    it('should sanitize tournament names', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: '1',
          name: '<script>alert("xss")</script>Malicious Tournament',
          status: 'active',
          maxPlayers: 16,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        } as Tournament
      ]

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getRecentTournaments()

      expect(result.error).toBeNull()
      expect(result.data?.[0].name).toBe('Malicious Tournament') // HTML tags removed
    })
  })

  describe('getActiveMatches', () => {
    it('should return active matches with tournament information', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: 'tournament-1',
          name: 'Test Tournament',
          status: 'active',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        } as Tournament
      ]

      const mockMatches: Match[] = [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          status: 'active',
          team1: {
            id: 'team-1',
            players: [{ displayName: 'Player 1' }, { displayName: 'Player 2' }]
          },
          team2: {
            id: 'team-2', 
            players: [{ displayName: 'Player 3' }, { displayName: 'Player 4' }]
          },
          score: { team1: 5, team2: 3 },
          courtId: 'court-1',
          startTime: '2024-01-01T10:00:00Z'
        } as Match
      ]

      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findByStatus = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getActiveMatches()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      
      if (result.data) {
        const match = result.data[0]
        expect(match.tournamentName).toBe('Test Tournament')
        expect(match.team1).toEqual(['Player 1', 'Player 2'])
        expect(match.team2).toEqual(['Player 3', 'Player 4'])
        expect(match.currentScore).toEqual([5, 3])
        expect(match.court).toBe('court-1')
        expect(match.status).toBe('active')
      }
    })

    it('should handle missing tournament gracefully', async () => {
      const mockMatches: Match[] = [
        {
          id: 'match-1',
          tournamentId: 'non-existent-tournament',
          status: 'active',
          team1: {
            id: 'team-1',
            players: [{ displayName: 'Player 1' }]
          },
          team2: {
            id: 'team-2',
            players: [{ displayName: 'Player 2' }]
          }
        } as Match
      ]

      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findByStatus = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })

      const result = await getActiveMatches()

      expect(result.error).toBeNull()
      expect(result.data?.[0].tournamentName).toBe('Unknown Tournament')
    })

    it('should sanitize player names', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: 'tournament-1',
          name: 'Test Tournament',
          status: 'active'
        } as Tournament
      ]

      const mockMatches: Match[] = [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          status: 'active',
          team1: {
            id: 'team-1',
            players: [{ displayName: '<b>Hacker</b> Player' }]
          },
          team2: {
            id: 'team-2',
            players: [{ displayName: 'Normal Player' }]
          }
        } as Match
      ]

      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findByStatus = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })

      const result = await getActiveMatches()

      expect(result.error).toBeNull()
      expect(result.data?.[0].team1[0]).toBe('Hacker Player') // HTML tags removed
    })
  })

  describe('getRecentActivity', () => {
    it('should generate activity from tournaments and matches', async () => {
      const mockTournaments: Tournament[] = [
        {
          id: '1',
          name: 'Test Tournament',
          status: 'active',
          createdAt: '2024-01-01T12:00:00Z',
          updatedAt: '2024-01-01T12:00:00Z'
        } as Tournament
      ]

      const mockMatches: Match[] = [
        {
          id: '1',
          tournamentId: '1',
          status: 'completed',
          team1: {
            id: 'team-1',
            players: [{ displayName: 'Winner Player' }]
          },
          team2: {
            id: 'team-2',
            players: [{ displayName: 'Loser Player' }]
          },
          winner: 'team-1',
          endTime: '2024-01-01T14:00:00Z',
          updatedAt: '2024-01-01T14:00:00Z'
        } as Match
      ]

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })

      const result = await getRecentActivity()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(2) // 1 tournament + 1 match

      if (result.data) {
        const tournamentEvent = result.data.find(e => e.entityType === 'tournament')
        const matchEvent = result.data.find(e => e.entityType === 'match')

        expect(tournamentEvent).toBeDefined()
        expect(tournamentEvent?.type).toBe('tournament_started')
        expect(tournamentEvent?.title).toBe('Tournament Started')

        expect(matchEvent).toBeDefined()
        expect(matchEvent?.type).toBe('match_completed')
        expect(matchEvent?.description).toContain('Winner Player won')
      }
    })

    it('should handle partial database failures gracefully', async () => {
      const dbError = new DatabaseError('Tournament database error')
      
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: dbError })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: [], error: null })

      const result = await getRecentActivity()

      expect(result.error).toBeNull()
      expect(result.data).toEqual([]) // Should return empty array, not fail
    })

    it('should fail only when both database operations fail', async () => {
      const tournamentError = new DatabaseError('Tournament error')
      const matchError = new DatabaseError('Match error')
      
      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: tournamentError })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: null, error: matchError })

      const result = await getRecentActivity()

      expect(result.error).toBeInstanceOf(DatabaseError)
      expect(result.data).toBeNull()
    })

    it('should limit activity events to 15 items', async () => {
      // Create many tournaments and matches
      const mockTournaments: Tournament[] = Array.from({ length: 10 }, (_, i) => ({
        id: `tournament-${i}`,
        name: `Tournament ${i}`,
        status: 'active',
        createdAt: `2024-01-${(i + 1).toString().padStart(2, '0')}T12:00:00Z`,
        updatedAt: `2024-01-${(i + 1).toString().padStart(2, '0')}T12:00:00Z`
      } as Tournament))

      const mockMatches: Match[] = Array.from({ length: 10 }, (_, i) => ({
        id: `match-${i}`,
        tournamentId: `tournament-${i}`,
        status: 'completed',
        team1: {
          id: 'team-1',
          players: [{ displayName: 'Player A' }]
        },
        team2: {
          id: 'team-2', 
          players: [{ displayName: 'Player B' }]
        },
        winner: 'team-1',
        endTime: `2024-01-${(i + 1).toString().padStart(2, '0')}T14:00:00Z`,
        updatedAt: `2024-01-${(i + 1).toString().padStart(2, '0')}T14:00:00Z`
      } as Match))

      ;(TournamentDB as jest.MockedClass<typeof TournamentDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockTournaments, error: null })
      ;(MatchDB as jest.MockedClass<typeof MatchDB>).prototype.findAll = jest.fn()
        .mockResolvedValue({ data: mockMatches, error: null })

      const result = await getRecentActivity()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(15) // Limited to 15 events
    })
  })
})