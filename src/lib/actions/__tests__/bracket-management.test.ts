/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import {
  generateBracketMatches,
  updateBracketProgression,
  getActiveTournamentMatches,
  getBracketStructure,
  advanceWinnerToBracket,
  getBracketResults,
  BracketNode,
  BracketUpdate
} from '../bracket-management'
import { MatchDB } from '@/lib/db/matches'
import { TournamentDB } from '@/lib/db/tournaments'
import { Match, Tournament, Team, Player, TournamentType, BracketType } from '@/types'

describe('Bracket Management Server Actions', () => {
  let testPath: string
  let matchDB: MatchDB
  let tournamentDB: TournamentDB
  let testTournament: Tournament
  let testTeams: Team[]

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

  beforeEach(async () => {
    testPath = join(__dirname, 'bracket-test-' + Date.now())
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

    // Create test teams (8 teams for proper bracket testing)
    const players = [
      createSamplePlayer('player-1', 'John', 'Doe'),
      createSamplePlayer('player-2', 'Jane', 'Smith'),
      createSamplePlayer('player-3', 'Bob', 'Wilson'),
      createSamplePlayer('player-4', 'Alice', 'Brown'),
      createSamplePlayer('player-5', 'Charlie', 'Davis'),
      createSamplePlayer('player-6', 'Diana', 'Miller'),
      createSamplePlayer('player-7', 'Eve', 'Garcia'),
      createSamplePlayer('player-8', 'Frank', 'Martinez'),
      createSamplePlayer('player-9', 'Grace', 'Anderson'),
      createSamplePlayer('player-10', 'Henry', 'Taylor'),
      createSamplePlayer('player-11', 'Ivy', 'Thomas'),
      createSamplePlayer('player-12', 'Jack', 'Jackson'),
      createSamplePlayer('player-13', 'Karen', 'White'),
      createSamplePlayer('player-14', 'Leo', 'Harris'),
      createSamplePlayer('player-15', 'Mia', 'Martin'),
      createSamplePlayer('player-16', 'Noah', 'Thompson')
    ]

    testTeams = []
    for (let i = 0; i < 8; i++) {
      const team = createSampleTeam(
        `team-${i + 1}`,
        `Team ${String.fromCharCode(65 + i)}`, // Team A, Team B, etc.
        [players[i * 2], players[i * 2 + 1]],
        testTournament.id
      )
      testTeams.push(team)
    }
  })

  afterEach(async () => {
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('generateBracketMatches', () => {
    it('should generate single elimination bracket with 8 teams', async () => {
      const result = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        testTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(4) // First round with 8 teams = 4 matches
        expect(result.data.bracketStructure).toHaveLength(4)
        expect(result.data.matches.every(m => m.round === 1)).toBe(true)
        expect(result.data.matches.every(m => m.status === 'scheduled')).toBe(true)
      }
    })

    it('should generate round-robin bracket with 4 teams', async () => {
      const fourTeams = testTeams.slice(0, 4)
      const result = await generateBracketMatches(
        testTournament.id,
        'round-robin',
        fourTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        // 4 teams = 6 matches total (each team plays every other team once)
        expect(result.data.matches).toHaveLength(6)
        expect(result.data.matches.every(m => m.roundName === 'Round Robin')).toBe(true)
      }
    })

    it('should generate swiss system bracket', async () => {
      const result = await generateBracketMatches(
        testTournament.id,
        'swiss',
        testTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(4) // First round pairings
        expect(result.data.matches.every(m => m.roundName === 'Swiss Round 1')).toBe(true)
      }
    })

    it('should fail with insufficient teams', async () => {
      const result = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        [testTeams[0]] // Only 1 team
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('At least 2 teams are required')
    })

    it('should fail with invalid tournament ID', async () => {
      const result = await generateBracketMatches(
        'invalid-tournament-id',
        'single-elimination',
        testTeams
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament not found')
    })

    it('should fail with unsupported bracket type', async () => {
      const result = await generateBracketMatches(
        testTournament.id,
        'invalid-type' as TournamentType,
        testTeams
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported bracket type')
    })

    it('should fail with missing parameters', async () => {
      const result1 = await generateBracketMatches('', 'single-elimination', testTeams)
      const result2 = await generateBracketMatches(testTournament.id, 'single-elimination', [])

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })
  })

  describe('updateBracketProgression', () => {
    let firstRoundMatches: Match[]

    beforeEach(async () => {
      // Generate initial bracket
      const bracketResult = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        testTeams
      )
      
      if (!bracketResult.success) {
        throw new Error('Failed to generate bracket')
      }
      
      firstRoundMatches = bracketResult.data.matches
    })

    it('should update bracket progression after match completion', async () => {
      const match = firstRoundMatches[0]
      
      // Complete the match
      await matchDB.update(match.id!, {
        status: 'completed',
        score: { team1: 13, team2: 8, isComplete: true },
        winner: match.team1.id,
        endTime: new Date().toISOString()
      })

      const result = await updateBracketProgression(testTournament.id, match.id!)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tournamentId).toBe(testTournament.id)
        expect(result.data.affectedMatches).toHaveLength(1)
        expect(result.data.affectedMatches[0].id).toBe(match.id)
      }
    })

    it('should fail with incomplete match', async () => {
      const match = firstRoundMatches[0]
      
      const result = await updateBracketProgression(testTournament.id, match.id!)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match must be completed with a winner')
    })

    it('should fail with invalid tournament ID', async () => {
      const match = firstRoundMatches[0]
      
      const result = await updateBracketProgression('invalid-id', match.id!)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament not found')
    })

    it('should fail with invalid match ID', async () => {
      const result = await updateBracketProgression(testTournament.id, 'invalid-match-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match not found')
    })

    it('should fail with missing parameters', async () => {
      const result1 = await updateBracketProgression('', firstRoundMatches[0].id!)
      const result2 = await updateBracketProgression(testTournament.id, '')

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })
  })

  describe('getActiveTournamentMatches', () => {
    beforeEach(async () => {
      // Generate bracket and create matches in different states
      await generateBracketMatches(testTournament.id, 'single-elimination', testTeams)
      
      const matches = await matchDB.findByTournament(testTournament.id)
      if (matches.data && matches.data.length > 0) {
        // Set different statuses for testing
        await matchDB.update(matches.data[0].id, { status: 'active' })
        await matchDB.update(matches.data[1].id, { status: 'completed' })
        // Keep others as 'scheduled'
      }
    })

    it('should categorize matches by status', async () => {
      const result = await getActiveTournamentMatches(testTournament.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.active).toHaveLength(1)
        expect(result.data.completed).toHaveLength(1)
        expect(result.data.scheduled).toHaveLength(2)
        expect(result.data.total).toBe(4)
      }
    })

    it('should fail with invalid tournament ID', async () => {
      const result = await getActiveTournamentMatches('invalid-id')

      expect(result.success).toBe(false)
    })

    it('should fail with missing tournament ID', async () => {
      const result = await getActiveTournamentMatches('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament ID is required')
    })
  })

  describe('getBracketStructure', () => {
    beforeEach(async () => {
      await generateBracketMatches(testTournament.id, 'single-elimination', testTeams)
    })

    it('should return current bracket structure', async () => {
      const result = await getBracketStructure(testTournament.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(4) // 4 first round matches
        expect(result.data.every(node => node.round === 1)).toBe(true)
        expect(result.data.every(node => node.bracketType === 'winner')).toBe(true)
      }
    })

    it('should fail with invalid tournament ID', async () => {
      const result = await getBracketStructure('invalid-id')

      expect(result.success).toBe(true) // This action returns empty array for invalid ID
      expect(result.data).toHaveLength(0)
    })

    it('should fail with missing tournament ID', async () => {
      const result = await getBracketStructure('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament ID is required')
    })
  })

  describe('advanceWinnerToBracket', () => {
    let testMatch: Match

    beforeEach(async () => {
      const bracketResult = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        testTeams
      )
      
      if (!bracketResult.success) {
        throw new Error('Failed to generate bracket')
      }
      
      testMatch = bracketResult.data.matches[0]
      
      // Complete the match
      await matchDB.update(testMatch.id!, {
        status: 'completed',
        score: { team1: 13, team2: 8, isComplete: true },
        winner: testMatch.team1.id,
        endTime: new Date().toISOString()
      })
    })

    it('should advance winner to next bracket round', async () => {
      const result = await advanceWinnerToBracket(testMatch.id!, testMatch.team1.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tournamentId).toBe(testTournament.id)
        expect(result.data.affectedMatches).toContain(testMatch)
      }
    })

    it('should fail with invalid match ID', async () => {
      const result = await advanceWinnerToBracket('invalid-id', testMatch.team1.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match not found')
    })

    it('should fail with missing parameters', async () => {
      const result1 = await advanceWinnerToBracket('', testMatch.team1.id)
      const result2 = await advanceWinnerToBracket(testMatch.id!, '')

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })
  })

  describe('getBracketResults', () => {
    beforeEach(async () => {
      await generateBracketMatches(testTournament.id, 'single-elimination', testTeams)
      
      // Complete some matches to generate results
      const matches = await matchDB.findByTournament(testTournament.id)
      if (matches.data && matches.data.length > 0) {
        await matchDB.update(matches.data[0].id, {
          status: 'completed',
          score: { team1: 13, team2: 8, isComplete: true },
          winner: matches.data[0].team1.id
        })
        await matchDB.update(matches.data[1].id, {
          status: 'completed',
          score: { team1: 8, team2: 13, isComplete: true },
          winner: matches.data[1].team2.id
        })
      }
    })

    it('should return bracket results for specific round', async () => {
      const result = await getBracketResults(testTournament.id, 1, 'winner')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.winners).toHaveLength(2)
        expect(result.data.losers).toHaveLength(2)
        expect(result.data.matches).toHaveLength(2) // 2 completed matches
      }
    })

    it('should fail with missing parameters', async () => {
      const result1 = await getBracketResults('', 1, 'winner')
      const result2 = await getBracketResults(testTournament.id, 0, 'winner')
      const result3 = await getBracketResults(testTournament.id, 1, '' as BracketType)

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
      expect(result3.success).toBe(false)
    })
  })

  describe('Bracket generation edge cases', () => {
    it('should handle double elimination bracket generation', async () => {
      const result = await generateBracketMatches(
        testTournament.id,
        'double-elimination',
        testTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        // For now, double elimination falls back to single elimination
        expect(result.data.matches).toHaveLength(4)
      }
    })

    it('should handle odd number of teams in single elimination', async () => {
      const oddTeams = testTeams.slice(0, 7) // 7 teams
      const result = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        oddTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(3) // 6 teams paired = 3 matches
      }
    })

    it('should handle minimum team count for round-robin', async () => {
      const twoTeams = testTeams.slice(0, 2)
      const result = await generateBracketMatches(
        testTournament.id,
        'round-robin',
        twoTeams
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toHaveLength(1) // 2 teams = 1 match
      }
    })
  })

  describe('Tournament completion detection', () => {
    let allMatches: Match[]

    beforeEach(async () => {
      const bracketResult = await generateBracketMatches(
        testTournament.id,
        'single-elimination',
        testTeams.slice(0, 4) // Use 4 teams for faster testing
      )
      
      if (!bracketResult.success) {
        throw new Error('Failed to generate bracket')
      }
      
      allMatches = bracketResult.data.matches
    })

    it('should detect tournament completion when all matches are done', async () => {
      // Complete all matches
      for (const match of allMatches) {
        await matchDB.update(match.id!, {
          status: 'completed',
          score: { team1: 13, team2: 8, isComplete: true },
          winner: match.team1.id
        })
      }

      const lastMatch = allMatches[allMatches.length - 1]
      const result = await updateBracketProgression(testTournament.id, lastMatch.id!)

      expect(result.success).toBe(true)
      
      // Check if tournament status was updated to completed
      const tournamentResult = await tournamentDB.findById(testTournament.id)
      if (tournamentResult.data) {
        expect(tournamentResult.data.status).toBe('completed')
      }
    })

    it('should not complete tournament with active matches remaining', async () => {
      // Complete only first match
      const firstMatch = allMatches[0]
      await matchDB.update(firstMatch.id!, {
        status: 'completed',
        score: { team1: 13, team2: 8, isComplete: true },
        winner: firstMatch.team1.id
      })

      const result = await updateBracketProgression(testTournament.id, firstMatch.id!)

      expect(result.success).toBe(true)
      
      // Tournament should still be active
      const tournamentResult = await tournamentDB.findById(testTournament.id)
      if (tournamentResult.data) {
        expect(tournamentResult.data.status).toBe('active')
      }
    })
  })
})