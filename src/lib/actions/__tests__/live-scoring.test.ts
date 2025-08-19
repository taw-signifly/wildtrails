/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import {
  updateMatchScore,
  submitEndScore,
  addEndToMatch,
  updateEndScore,
  validateMatchScore,
  getMatchProgress,
  getMatchHistory,
  getEndByEndDetails,
  undoLastEnd,
  updateScoreForm
} from '../live-scoring'
import { MatchDB } from '@/lib/db/matches'
import { TournamentDB } from '@/lib/db/tournaments'
import { Match, Tournament, Team, Player, End, Score, Position } from '@/types'

describe('Live Scoring Server Actions', () => {
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

  const createSampleEnd = (endNumber: number, winner: string, points: number): End => ({
    id: `end-${endNumber}`,
    endNumber,
    jackPosition: { x: 8, y: 2 },
    boules: [],
    winner,
    points,
    duration: 300,
    completed: true,
    createdAt: new Date().toISOString()
  })

  beforeEach(async () => {
    testPath = join(__dirname, 'live-scoring-test-' + Date.now())
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

    // Create test match
    const matchResult = await matchDB.create({
      tournamentId: testTournament.id,
      round: 1,
      roundName: 'Round 1',
      bracketType: 'winner',
      team1: testTeam1,
      team2: testTeam2,
      score: { team1: 0, team2: 0, isComplete: false },
      status: 'active',
      ends: []
    })
    
    if (matchResult.error) {
      throw new Error('Failed to create test match')
    }
    testMatch = matchResult.data!
  })

  afterEach(async () => {
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('updateMatchScore', () => {
    it('should update match score successfully', async () => {
      const newScore: Score = { team1: 5, team2: 3, isComplete: false }
      const result = await updateMatchScore(testMatch.id, newScore)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.team1).toBe(5)
        expect(result.data.score.team2).toBe(3)
        expect(result.data.score.isComplete).toBe(false)
      }
    })

    it('should mark game as complete when reaching 13 points', async () => {
      const winningScore: Score = { team1: 13, team2: 8, isComplete: true }
      const result = await updateMatchScore(testMatch.id, winningScore)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.isComplete).toBe(true)
        expect(result.data.winner).toBe(testTeam1.id)
        expect(result.data.status).toBe('completed')
      }
    })

    it('should fail with invalid score values', async () => {
      const invalidScore: Score = { team1: -1, team2: 3, isComplete: false }
      const result = await updateMatchScore(testMatch.id, invalidScore)

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })

    it('should fail with scores exceeding maximum', async () => {
      const excessiveScore: Score = { team1: 15, team2: 3, isComplete: false }
      const result = await updateMatchScore(testMatch.id, excessiveScore)

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })

    it('should fail with missing match ID', async () => {
      const score: Score = { team1: 5, team2: 3, isComplete: false }
      const result = await updateMatchScore('', score)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('submitEndScore', () => {
    it('should submit end score with form data', async () => {
      const formData = new FormData()
      formData.append('team1Points', '2')
      formData.append('team2Points', '0')
      formData.append('jackPosition', JSON.stringify({ x: 8, y: 2 }))

      const result = await submitEndScore(testMatch.id, formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(1)
        expect(result.data.ends[0].points).toBe(2)
        expect(result.data.ends[0].winner).toBe(testTeam1.id)
        expect(result.data.score.team1).toBe(2)
      }
    })

    it('should validate end points within range', async () => {
      const formData = new FormData()
      formData.append('team1Points', '7') // Exceeds maximum of 6
      formData.append('team2Points', '0')

      const result = await submitEndScore(testMatch.id, formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })

    it('should fail with missing match ID', async () => {
      const formData = new FormData()
      formData.append('team1Points', '2')
      formData.append('team2Points', '0')

      const result = await submitEndScore('', formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('addEndToMatch', () => {
    it('should add complete end to match', async () => {
      const endData = {
        team1Points: 3,
        team2Points: 0,
        jackPosition: { x: 8, y: 2 } as Position,
        boules: []
      }

      const result = await addEndToMatch(testMatch.id, endData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(1)
        expect(result.data.ends[0].points).toBe(3)
        expect(result.data.score.team1).toBe(3)
        expect(result.data.score.team2).toBe(0)
      }
    })

    it('should complete match when reaching winning score', async () => {
      // Add multiple ends to reach winning score
      await addEndToMatch(testMatch.id, { team1Points: 6, team2Points: 0 })
      await addEndToMatch(testMatch.id, { team1Points: 6, team2Points: 0 })
      const result = await addEndToMatch(testMatch.id, { team1Points: 1, team2Points: 0 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.team1).toBe(13)
        expect(result.data.score.isComplete).toBe(true)
        expect(result.data.status).toBe('completed')
        expect(result.data.winner).toBe(testTeam1.id)
      }
    })

    it('should fail with invalid end points', async () => {
      const result = await addEndToMatch(testMatch.id, { team1Points: -1, team2Points: 0 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })

    it('should fail when both teams have points in same end', async () => {
      const result = await addEndToMatch(testMatch.id, { team1Points: 2, team2Points: 1 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only one team can score points in an end')
    })
  })

  describe('getMatchProgress', () => {
    beforeEach(async () => {
      // Add some ends to create progress
      await addEndToMatch(testMatch.id, { team1Points: 2, team2Points: 0 })
      await addEndToMatch(testMatch.id, { team1Points: 0, team2Points: 3 })
    })

    it('should return match progress with current score', async () => {
      const result = await getMatchProgress(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currentScore.team1).toBe(2)
        expect(result.data.currentScore.team2).toBe(3)
        expect(result.data.endsPlayed).toBe(2)
        expect(result.data.isComplete).toBe(false)
        expect(result.data.progressPercentage).toBe(23) // Max(2,3) / 13 * 100 ≈ 23
      }
    })

    it('should show completed match progress', async () => {
      // Complete the match by adding more ends
      for (let i = 0; i < 10; i++) {
        await addEndToMatch(testMatch.id, { team1Points: 1, team2Points: 0 })
      }

      const result = await getMatchProgress(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isComplete).toBe(true)
        expect(result.data.progressPercentage).toBe(100)
        expect(result.data.winner).toBe(testTeam1.id)
      }
    })

    it('should fail with invalid match ID', async () => {
      const result = await getMatchProgress('invalid-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('getMatchHistory', () => {
    beforeEach(async () => {
      // Add multiple ends with different outcomes
      await addEndToMatch(testMatch.id, { team1Points: 2, team2Points: 0 })
      await addEndToMatch(testMatch.id, { team1Points: 0, team2Points: 1 })
      await addEndToMatch(testMatch.id, { team1Points: 3, team2Points: 0 })
    })

    it('should return chronological match history', async () => {
      const result = await getMatchHistory(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(3)
        expect(result.data.scoreProgression).toHaveLength(4) // Initial + 3 ends
        expect(result.data.scoreProgression[0]).toEqual({ team1: 0, team2: 0 })
        expect(result.data.scoreProgression[1]).toEqual({ team1: 2, team2: 0 })
        expect(result.data.scoreProgression[3]).toEqual({ team1: 5, team2: 1 })
      }
    })

    it('should show match duration and statistics', async () => {
      const result = await getMatchHistory(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalDuration).toBeGreaterThan(0)
        expect(result.data.averageEndDuration).toBeGreaterThan(0)
        expect(result.data.endsWon.team1).toBe(2)
        expect(result.data.endsWon.team2).toBe(1)
      }
    })
  })

  describe('getEndByEndDetails', () => {
    beforeEach(async () => {
      await addEndToMatch(testMatch.id, { 
        team1Points: 2, 
        team2Points: 0,
        jackPosition: { x: 8, y: 2 },
        boules: []
      })
    })

    it('should return detailed end-by-end breakdown', async () => {
      const result = await getEndByEndDetails(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(1)
        expect(result.data.ends[0].endNumber).toBe(1)
        expect(result.data.ends[0].points).toBe(2)
        expect(result.data.ends[0].winner).toBe(testTeam1.id)
        expect(result.data.ends[0].runningScore.team1).toBe(2)
        expect(result.data.ends[0].runningScore.team2).toBe(0)
      }
    })

    it('should show cumulative scoring patterns', async () => {
      // Add more ends
      await addEndToMatch(testMatch.id, { team1Points: 0, team2Points: 1 })
      await addEndToMatch(testMatch.id, { team1Points: 1, team2Points: 0 })

      const result = await getEndByEndDetails(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(3)
        expect(result.data.ends[2].runningScore.team1).toBe(3)
        expect(result.data.ends[2].runningScore.team2).toBe(1)
      }
    })
  })

  describe('undoLastEnd', () => {
    beforeEach(async () => {
      await addEndToMatch(testMatch.id, { team1Points: 2, team2Points: 0 })
      await addEndToMatch(testMatch.id, { team1Points: 0, team2Points: 3 })
    })

    it('should remove the last end and update score', async () => {
      const result = await undoLastEnd(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ends).toHaveLength(1)
        expect(result.data.score.team1).toBe(2)
        expect(result.data.score.team2).toBe(0)
      }
    })

    it('should fail when no ends exist to undo', async () => {
      // Remove all ends first
      await undoLastEnd(testMatch.id)
      await undoLastEnd(testMatch.id)
      
      const result = await undoLastEnd(testMatch.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No ends to undo')
    })

    it('should revert completed match status when undoing winning end', async () => {
      // Complete the match
      for (let i = 0; i < 11; i++) {
        await addEndToMatch(testMatch.id, { team1Points: 1, team2Points: 0 })
      }

      // Verify match is completed
      const progressResult = await getMatchProgress(testMatch.id)
      expect(progressResult.success && progressResult.data.isComplete).toBe(true)

      // Undo last end
      const result = await undoLastEnd(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active')
        expect(result.data.score.isComplete).toBe(false)
        expect(result.data.winner).toBeUndefined()
      }
    })
  })

  describe('validateMatchScore', () => {
    it('should validate correct score values', async () => {
      const validScore: Score = { team1: 8, team2: 5, isComplete: false }
      const result = await validateMatchScore(testMatch.id, validScore)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isValid).toBe(true)
        expect(result.data.errors).toHaveLength(0)
      }
    })

    it('should detect score validation errors', async () => {
      const invalidScore: Score = { team1: -1, team2: 15, isComplete: false }
      const result = await validateMatchScore(testMatch.id, invalidScore)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors.length).toBeGreaterThan(0)
        expect(result.data.errors.some(e => e.includes('negative'))).toBe(true)
        expect(result.data.errors.some(e => e.includes('exceeds maximum'))).toBe(true)
      }
    })

    it('should validate completion logic', async () => {
      const completionScore: Score = { team1: 13, team2: 8, isComplete: true }
      const result = await validateMatchScore(testMatch.id, completionScore)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isValid).toBe(true)
        expect(result.data.canComplete).toBe(true)
        expect(result.data.suggestedWinner).toBe(testTeam1.id)
      }
    })
  })

  describe('updateScoreForm', () => {
    it('should process form data and update score', async () => {
      const formData = new FormData()
      formData.append('team1Score', '7')
      formData.append('team2Score', '4')

      const result = await updateScoreForm(testMatch.id, formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.team1).toBe(7)
        expect(result.data.score.team2).toBe(4)
        expect(result.data.score.isComplete).toBe(false)
      }
    })

    it('should handle winning score in form', async () => {
      const formData = new FormData()
      formData.append('team1Score', '13')
      formData.append('team2Score', '9')

      const result = await updateScoreForm(testMatch.id, formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score.isComplete).toBe(true)
        expect(result.data.status).toBe('completed')
        expect(result.data.winner).toBe(testTeam1.id)
      }
    })

    it('should fail with invalid form data', async () => {
      const formData = new FormData()
      formData.append('team1Score', 'invalid')
      formData.append('team2Score', '4')

      const result = await updateScoreForm(testMatch.id, formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })
  })
})