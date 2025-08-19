/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import {
  getMatches,
  getMatchesByTournament,
  getMatchesByPlayer,
  getMatchById,
  createMatchData,
  updateMatchData,
  deleteMatch,
  searchMatches,
  startMatch,
  completeMatch,
  cancelMatch,
  getLiveMatches,
  getTournamentMatchStats,
  generateBracketMatches
} from '../matches'
import { MatchDB } from '@/lib/db/matches'
import { TournamentDB } from '@/lib/db/tournaments'
import { Match, Tournament, Team, Player, Score } from '@/types'

describe('Match Server Actions', () => {
  let testPath: string
  let matchDB: MatchDB
  let tournamentDB: TournamentDB
  let testTournament: Tournament
  let testTeam1: Team
  let testTeam2: Team
  let testMatch: Match

  const createSamplePlayer = (id: string, firstName: string, lastName: string): Player => ({
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.com`,
    phone: '123-456-7890',
    club: 'Test Club',
    ranking: 1200,
    handicap: 0,
    stats: {
      tournamentsPlayed: 5,
      tournamentsWon: 1,
      matchesPlayed: 20,
      matchesWon: 12,
      winPercentage: 60,
      averagePointsFor: 8.5,
      averagePointsAgainst: 6.2,
      pointsDifferential: 46,
      bestFinish: '1st',
      recentForm: [1, 1, 0, 1, 1]
    },
    preferences: {
      preferredFormat: 'doubles',
      notificationEmail: true,
      notificationPush: false,
      publicProfile: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const createSampleTeam = (id: string, name: string, players: Player[], tournamentId: string): Team => ({
    id,
    name,
    players,
    tournamentId,
    seed: 1,
    bracketType: 'winner',
    stats: {
      matchesPlayed: 0,
      matchesWon: 0,
      setsWon: 0,
      setsLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDifferential: 0,
      averagePointsDifferential: 0,
      currentStreak: 0,
      longestStreak: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const createSampleMatch = (overrides?: Partial<Match>): Omit<Match, 'id' | 'createdAt' | 'updatedAt'> => ({
    tournamentId: testTournament.id,
    round: 1,
    roundName: 'Round 1',
    bracketType: 'winner',
    team1: testTeam1,
    team2: testTeam2,
    score: { team1: 0, team2: 0, isComplete: false },
    status: 'scheduled',
    ends: [],
    ...overrides
  })

  beforeEach(async () => {
    testPath = join(__dirname, 'matches-test-' + Date.now())
    matchDB = new MatchDB({ dataPath: testPath })
    tournamentDB = new TournamentDB({ dataPath: testPath })

    // Create test tournament
    const tournamentResult = await tournamentDB.create({
      name: 'Test Tournament',
      type: 'single-elimination',
      format: 'doubles',
      maxPoints: 13,
      shortForm: false,
      startDate: new Date().toISOString(),
      organizer: 'Test Organizer',
      maxPlayers: 16,
      settings: { allowLateRegistration: true, automaticBracketGeneration: true }
    })
    
    if (tournamentResult.error) {
      throw new Error('Failed to create test tournament')
    }
    testTournament = tournamentResult.data!

    // Create test teams and players
    const player1 = createSamplePlayer('player-1', 'John', 'Doe')
    const player2 = createSamplePlayer('player-2', 'Jane', 'Smith')
    const player3 = createSamplePlayer('player-3', 'Bob', 'Wilson')
    const player4 = createSamplePlayer('player-4', 'Alice', 'Brown')

    testTeam1 = createSampleTeam('team-1', 'Team Alpha', [player1, player2], testTournament.id)
    testTeam2 = createSampleTeam('team-2', 'Team Beta', [player3, player4], testTournament.id)
  })

  afterEach(async () => {
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('createMatchData', () => {
    it('should create a match successfully', async () => {
      const matchData = createSampleMatch()
      const result = await createMatchData(matchData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBeDefined()
        expect(result.data.tournamentId).toBe(testTournament.id)
        expect(result.data.status).toBe('scheduled')
        expect(result.data.team1.name).toBe('Team Alpha')
        expect(result.data.team2.name).toBe('Team Beta')
      }
    })

    it('should fail with invalid tournament ID', async () => {
      const matchData = createSampleMatch({ tournamentId: 'invalid-id' })
      const result = await createMatchData(matchData)

      expect(result.success).toBe(false)
    })
  })

  describe('getMatches', () => {
    beforeEach(async () => {
      const matchData1 = createSampleMatch()
      const matchData2 = createSampleMatch({ round: 2, status: 'active' })
      
      await matchDB.create(matchData1)
      await matchDB.create(matchData2)
    })

    it('should return all matches with pagination', async () => {
      const result = await getMatches()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(2)
        expect(result.data.pagination.total).toBe(2)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(20)
      }
    })

    it('should filter matches by status', async () => {
      const result = await getMatches({ status: 'active' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(1)
        expect(result.data.matches[0].status).toBe('active')
      }
    })

    it('should support pagination', async () => {
      const result = await getMatches({ page: 1, limit: 1 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(1)
        expect(result.data.pagination.totalPages).toBe(2)
      }
    })
  })

  describe('getMatchesByTournament', () => {
    beforeEach(async () => {
      await matchDB.create(createSampleMatch())
    })

    it('should return matches for specific tournament', async () => {
      const result = await getMatchesByTournament(testTournament.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].tournamentId).toBe(testTournament.id)
      }
    })

    it('should fail with missing tournament ID', async () => {
      const result = await getMatchesByTournament('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament ID is required')
    })
  })

  describe('getMatchById', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch())
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should return specific match by ID', async () => {
      const result = await getMatchById(matchId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(matchId)
        expect(result.data.team1.name).toBe('Team Alpha')
      }
    })

    it('should fail with invalid match ID', async () => {
      const result = await getMatchById('invalid-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail with missing match ID', async () => {
      const result = await getMatchById('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('updateMatchData', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch())
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should update match data successfully', async () => {
      const updateData = {
        score: { team1: 5, team2: 3, isComplete: false },
        status: 'active' as const
      }

      const result = await updateMatchData(matchId, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.team1).toBe(5)
        expect(result.data.score.team2).toBe(3)
        expect(result.data.status).toBe('active')
      }
    })

    it('should fail with missing match ID', async () => {
      const result = await updateMatchData('', { status: 'active' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('startMatch', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch())
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should start a scheduled match', async () => {
      const result = await startMatch(matchId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active')
        expect(result.data.startTime).toBeDefined()
      }
    })

    it('should fail with missing match ID', async () => {
      const result = await startMatch('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('completeMatch', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch({ status: 'active' }))
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should complete an active match', async () => {
      const finalScore: Score = { team1: 13, team2: 8, isComplete: true }
      const result = await completeMatch(matchId, finalScore, testTeam1.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('completed')
        expect(result.data.winner).toBe(testTeam1.id)
        expect(result.data.score.team1).toBe(13)
        expect(result.data.endTime).toBeDefined()
      }
    })

    it('should fail with missing match ID', async () => {
      const finalScore: Score = { team1: 13, team2: 8, isComplete: true }
      const result = await completeMatch('', finalScore, testTeam1.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })

    it('should fail with missing winner ID', async () => {
      const finalScore: Score = { team1: 13, team2: 8, isComplete: true }
      const result = await completeMatch(matchId, finalScore, '')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Winner ID is required')
    })
  })

  describe('cancelMatch', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch())
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should cancel a match with reason', async () => {
      const result = await cancelMatch(matchId, 'Weather conditions')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('cancelled')
        expect(result.data.notes).toContain('Weather conditions')
      }
    })

    it('should cancel a match without reason', async () => {
      const result = await cancelMatch(matchId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('cancelled')
      }
    })

    it('should fail with missing match ID', async () => {
      const result = await cancelMatch('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('searchMatches', () => {
    beforeEach(async () => {
      await matchDB.create(createSampleMatch())
    })

    it('should search matches by player name', async () => {
      const result = await searchMatches('John Doe')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].team1.players.some(p => p.displayName.includes('John Doe'))).toBe(true)
      }
    })

    it('should search matches by round name', async () => {
      const result = await searchMatches('Round 1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].roundName).toBe('Round 1')
      }
    })

    it('should return empty results for no matches', async () => {
      const result = await searchMatches('nonexistent player')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('should fail with empty search query', async () => {
      const result = await searchMatches('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Search query is required')
    })

    it('should apply status filter to search results', async () => {
      // Create another match with different status
      await matchDB.create(createSampleMatch({ status: 'active' }))

      const result = await searchMatches('John', { status: 'active' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('active')
      }
    })
  })

  describe('getLiveMatches', () => {
    beforeEach(async () => {
      await matchDB.create(createSampleMatch({ status: 'active' }))
      await matchDB.create(createSampleMatch({ status: 'scheduled' }))
    })

    it('should return only active matches', async () => {
      const result = await getLiveMatches()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('active')
      }
    })
  })

  describe('getTournamentMatchStats', () => {
    beforeEach(async () => {
      await matchDB.create(createSampleMatch({ status: 'completed', duration: 45 }))
      await matchDB.create(createSampleMatch({ status: 'active', duration: 30 }))
      await matchDB.create(createSampleMatch({ status: 'scheduled' }))
    })

    it('should return comprehensive match statistics', async () => {
      const result = await getTournamentMatchStats(testTournament.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalMatches).toBe(3)
        expect(result.data.completedMatches).toBe(1)
        expect(result.data.activeMatches).toBe(1)
        expect(result.data.scheduledMatches).toBe(1)
        expect(result.data.cancelledMatches).toBe(0)
        expect(result.data.averageDuration).toBe(37.5) // (45 + 30) / 2
      }
    })

    it('should fail with missing tournament ID', async () => {
      const result = await getTournamentMatchStats('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament ID is required')
    })
  })

  describe('generateBracketMatches', () => {
    it('should create multiple matches in bulk', async () => {
      const matchesData = [
        createSampleMatch(),
        createSampleMatch({ round: 2, roundName: 'Semifinals' })
      ]

      const result = await generateBracketMatches(matchesData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.successful).toHaveLength(2)
        expect(result.data.failed).toHaveLength(0)
        expect(result.data.successful[0].round).toBe(1)
        expect(result.data.successful[1].round).toBe(2)
      }
    })

    it('should fail with empty matches array', async () => {
      const result = await generateBracketMatches([])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match data is required')
    })

    it('should handle partial failures gracefully', async () => {
      const matchesData = [
        createSampleMatch(),
        createSampleMatch({ tournamentId: 'invalid-id' })
      ]

      const result = await generateBracketMatches(matchesData)

      // Should succeed overall but report failures
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.successful).toHaveLength(1)
        expect(result.data.failed).toHaveLength(1)
      }
    })
  })

  describe('deleteMatch', () => {
    let matchId: string

    beforeEach(async () => {
      const createResult = await matchDB.create(createSampleMatch())
      if (createResult.error || !createResult.data) {
        throw new Error('Failed to create test match')
      }
      matchId = createResult.data.id
    })

    it('should archive a match successfully', async () => {
      const result = await deleteMatch(matchId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(matchId)
        expect(result.data.archived).toBe(true)
      }
    })

    it('should fail with missing match ID', async () => {
      const result = await deleteMatch('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })
})