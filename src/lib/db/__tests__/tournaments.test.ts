/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { TournamentDB, TournamentUtils } from '../tournaments'
import { TournamentFormData, TournamentStatus, Result, DatabaseError } from '@/types'
import { ValidationError } from '../base'
import { ZodError } from 'zod'

// Helper function to unwrap Result objects in tests
function expectSuccess<T>(result: Result<T, DatabaseError>): T {
  if (result.error) {
    throw result.error
  }
  expect(result.data).toBeDefined()
  return result.data!
}

function expectError<T>(result: Result<T, DatabaseError>): DatabaseError {
  expect(result.error).toBeDefined()
  expect(result.data).toBeNull()
  return result.error!
}

// Helper to create database method that returns unwrapped data for easier testing
function createTestDB(testPath: string) {
  const db = new TournamentDB({ dataPath: testPath })
  
  return {
    async create(formData: TournamentFormData) {
      const result = await db.create(formData)
      return expectSuccess(result)
    },
    async findById(id: string) {
      const result = await db.findById(id)
      return expectSuccess(result)
    },
    async findByStatus(status: TournamentStatus) {
      const result = await db.findByStatus(status)
      return expectSuccess(result)
    },
    async findByType(type: any) {
      const result = await db.findByType(type)
      return expectSuccess(result)
    },
    async findByOrganizer(organizer: string) {
      const result = await db.findByOrganizer(organizer)
      return expectSuccess(result)
    },
    async findActive() {
      const result = await db.findActive()
      return expectSuccess(result)
    },
    async findUpcoming() {
      const result = await db.findUpcoming()
      return expectSuccess(result)
    },
    async findAll(filters?: any) {
      const result = await db.findAll(filters)
      return expectSuccess(result)
    },
    async startTournament(id: string) {
      const result = await db.startTournament(id)
      return expectSuccess(result)
    },
    async completeTournament(id: string, stats?: any) {
      const result = await db.completeTournament(id, stats)
      return expectSuccess(result)
    },
    async addPlayer(tournamentId: string, playerId: string) {
      const result = await db.addPlayer(tournamentId, playerId)
      return expectSuccess(result)
    },
    async removePlayer(tournamentId: string, playerId: string) {
      const result = await db.removePlayer(tournamentId, playerId)
      return expectSuccess(result)
    },
    async updateStats(id: string, stats: any) {
      const result = await db.updateStats(id, stats)
      return expectSuccess(result)
    },
    async search(query: string) {
      const result = await db.search(query)
      return expectSuccess(result)
    },
    async findInDateRange(start: Date, end: Date) {
      const result = await db.findInDateRange(start, end)
      return expectSuccess(result)
    },
    async getStatsSummary() {
      const result = await db.getStatsSummary()
      return expectSuccess(result)
    },
    
    // Methods that should return errors for testing
    rawDB: db,
    async expectCreateError(formData: TournamentFormData) {
      const result = await db.create(formData)
      return expectError(result)
    },
    async expectStartError(id: string) {
      const result = await db.startTournament(id)
      return expectError(result)
    },
    async expectCompleteError(id: string, stats?: any) {
      const result = await db.completeTournament(id, stats)
      return expectError(result)
    },
    async expectAddPlayerError(tournamentId: string, playerId: string) {
      const result = await db.addPlayer(tournamentId, playerId)
      return expectError(result)
    },
    async expectRemovePlayerError(tournamentId: string, playerId: string) {
      const result = await db.removePlayer(tournamentId, playerId)
      return expectError(result)
    }
  }
}

describe('TournamentDB', () => {
  let db: ReturnType<typeof createTestDB>
  let testPath: string

  beforeEach(async () => {
    testPath = join(__dirname, 'tournaments-test-' + Date.now())
    db = createTestDB(testPath)
    await (db.rawDB as unknown as { ensureDirectoryExists(): Promise<void> }).ensureDirectoryExists()
  })

  afterEach(async () => {
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  const createSampleTournamentData = (): TournamentFormData => ({
    name: 'Spring Championship',
    type: 'single-elimination',
    format: 'doubles',
    maxPoints: 13,
    shortForm: false,
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Annual spring tournament',
    location: 'Main Field',
    organizer: 'Tournament Committee',
    maxPlayers: 16,
    settings: {
      allowLateRegistration: true,
      automaticBracketGeneration: true
    }
  })

  describe('create', () => {
    it('should create a tournament with default values', async () => {
      const formData = createSampleTournamentData()
      const tournament = await db.create(formData)

      expect(tournament.id).toBeDefined()
      expect(tournament.name).toBe('Spring Championship')
      expect(tournament.status).toBe('setup')
      expect(tournament.currentPlayers).toBe(0)
      expect(tournament.settings.allowLateRegistration).toBe(true)
      expect(tournament.stats.totalMatches).toBe(0)
      expect(tournament.createdAt).toBeDefined()
      expect(tournament.updatedAt).toBeDefined()
    })

    it('should validate form data', async () => {
      const invalidData = {
        ...createSampleTournamentData(),
        maxPlayers: 2 // Below minimum
      }

      const error = await db.expectCreateError(invalidData)
      // The error will be a ZodError wrapped by our tryCatch, not ValidationError
      expect(error).toBeInstanceOf(ZodError)
      expect(error.message || error.toString()).toContain('Minimum 4 players required')
    })

    it('should apply default settings', async () => {
      const formData = createSampleTournamentData()
      delete (formData as any).settings
      
      const tournament = await db.create(formData)
      
      expect(tournament.settings.allowLateRegistration).toBe(true)
      expect(tournament.settings.automaticBracketGeneration).toBe(true)
      expect(tournament.settings.requireCheckin).toBe(true)
      expect(tournament.settings.courtAssignmentMode).toBe('automatic')
      expect(tournament.settings.scoringMode).toBe('self-report')
      expect(tournament.settings.realTimeUpdates).toBe(true)
      expect(tournament.settings.allowSpectators).toBe(true)
    })
  })

  describe('findByStatus', () => {
    it('should return tournaments with specific status', async () => {
      const tournament1 = await db.create(createSampleTournamentData())
      const tournament2 = await db.create({
        ...createSampleTournamentData(),
        name: 'Summer Cup'
      })
      
      // Add players to tournament1 before starting
      await db.addPlayer(tournament1.id, 'player1')
      await db.addPlayer(tournament1.id, 'player2')
      await db.addPlayer(tournament1.id, 'player3')
      await db.addPlayer(tournament1.id, 'player4')
      
      // Start one tournament
      await db.startTournament(tournament1.id)
      
      const activeTournaments = await db.findByStatus('active')
      const setupTournaments = await db.findByStatus('setup')
      
      expect(activeTournaments).toHaveLength(1)
      expect(activeTournaments[0].id).toBe(tournament1.id)
      expect(setupTournaments).toHaveLength(1)
      expect(setupTournaments[0].id).toBe(tournament2.id)
    })
  })

  describe('findByType', () => {
    it('should return tournaments of specific type', async () => {
      await db.create({
        ...createSampleTournamentData(),
        type: 'single-elimination'
      })
      await db.create({
        ...createSampleTournamentData(),
        name: 'Swiss Tournament',
        type: 'swiss'
      })
      
      const singleElim = await db.findByType('single-elimination')
      const swiss = await db.findByType('swiss')
      
      expect(singleElim).toHaveLength(1)
      expect(swiss).toHaveLength(1)
      expect(singleElim[0].type).toBe('single-elimination')
      expect(swiss[0].type).toBe('swiss')
    })
  })

  describe('findByOrganizer', () => {
    it('should return tournaments by organizer', async () => {
      await db.create({
        ...createSampleTournamentData(),
        organizer: 'Club A'
      })
      await db.create({
        ...createSampleTournamentData(),
        name: 'Another Tournament',
        organizer: 'Club B'
      })
      
      const clubATournaments = await db.findByOrganizer('Club A')
      expect(clubATournaments).toHaveLength(1)
      expect(clubATournaments[0].organizer).toBe('Club A')
    })
  })

  describe('findActive', () => {
    it('should return only active tournaments', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      // Add minimum players and start tournament
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      await db.startTournament(tournament.id)
      
      const active = await db.findActive()
      expect(active).toHaveLength(1)
      expect(active[0].status).toBe('active')
    })
  })

  describe('findUpcoming', () => {
    it('should return upcoming tournaments', async () => {
      // Create tournament with future start date
      await db.create({
        ...createSampleTournamentData(),
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      
      // Create tournament with past start date
      await db.create({
        ...createSampleTournamentData(),
        name: 'Past Tournament',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      })
      
      const upcoming = await db.findUpcoming()
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].name).toBe('Spring Championship')
    })
  })

  describe('startTournament', () => {
    it('should start a tournament with minimum players', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      // Add minimum players
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      
      const started = await db.startTournament(tournament.id)
      
      expect(started.status).toBe('active')
      expect(new Date(started.startDate)).toBeInstanceOf(Date)
    })

    it('should fail to start tournament without minimum players', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      const error = await db.expectStartError(tournament.id)
      expect(error.message).toContain('Minimum 4 players required')
    })

    it('should fail to start tournament not in setup status', async () => {
      const tournament = await db.create(createSampleTournamentData())
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      
      await db.startTournament(tournament.id)
      
      const error = await db.expectStartError(tournament.id)
      expect(error.message).toContain('Tournament is not in setup status')
    })
  })

  describe('completeTournament', () => {
    it('should complete an active tournament', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      // Add players and start tournament
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      const started = await db.startTournament(tournament.id)
      
      // Complete tournament
      const completed = await db.completeTournament(started.id, {
        totalMatches: 10,
        completedMatches: 10,
        averageMatchDuration: 45,
        totalEnds: 50,
        highestScore: 13,
        averageScore: 8.5
      })
      
      expect(completed.status).toBe('completed')
      expect(completed.endDate).toBeDefined()
      expect(completed.stats.totalMatches).toBe(10)
    })

    it('should fail to complete non-active tournament', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      const error = await db.expectCompleteError(tournament.id)
      expect(error.message).toContain('Tournament is not active')
    })
  })

  describe('addPlayer', () => {
    it('should add player to tournament', async () => {
      const tournament = await db.create(createSampleTournamentData())
      const updated = await db.addPlayer(tournament.id, 'player1')
      
      expect(updated.currentPlayers).toBe(1)
    })

    it('should fail when tournament is full', async () => {
      const tournament = await db.create({
        ...createSampleTournamentData(),
        maxPlayers: 4 // Use minimum allowed, then fill it
      })
      
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      
      const error = await db.expectAddPlayerError(tournament.id, 'player5')
      expect(error.message).toContain('Tournament is full')
    })

    it('should fail late registration when not allowed', async () => {
      const tournament = await db.create({
        ...createSampleTournamentData(),
        settings: { allowLateRegistration: false }
      })
      
      // Start tournament
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      await db.startTournament(tournament.id)
      
      const error = await db.expectAddPlayerError(tournament.id, 'player5')
      expect(error.message).toContain('Late registration is not allowed')
    })
  })

  describe('removePlayer', () => {
    it('should remove player from tournament', async () => {
      const tournament = await db.create(createSampleTournamentData())
      await db.addPlayer(tournament.id, 'player1')
      
      const updated = await db.removePlayer(tournament.id, 'player1')
      expect(updated.currentPlayers).toBe(0)
    })

    it('should not go below zero players', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      // This should now fail with an error rather than returning a result with 0 players
      const error = await db.expectRemovePlayerError(tournament.id, 'player1')
      expect(error.message).toContain('No players to remove')
    })

    it('should fail to remove from active tournament', async () => {
      const tournament = await db.create(createSampleTournamentData())
      await db.addPlayer(tournament.id, 'player1')
      await db.addPlayer(tournament.id, 'player2')
      await db.addPlayer(tournament.id, 'player3')
      await db.addPlayer(tournament.id, 'player4')
      await db.startTournament(tournament.id)
      
      const error = await db.expectRemovePlayerError(tournament.id, 'player1')
      expect(error.message).toContain('Cannot remove players from active tournament')
    })
  })

  describe('updateStats', () => {
    it('should update tournament statistics', async () => {
      const tournament = await db.create(createSampleTournamentData())
      
      const updated = await db.updateStats(tournament.id, {
        totalMatches: 8,
        completedMatches: 5,
        averageMatchDuration: 45
      })
      
      expect(updated.stats.totalMatches).toBe(8)
      expect(updated.stats.completedMatches).toBe(5)
      expect(updated.stats.averageMatchDuration).toBe(45)
    })
  })

  describe('search', () => {
    it('should search tournaments by name and description', async () => {
      await db.create({
        ...createSampleTournamentData(),
        name: 'Spring Championship',
        description: 'Annual tournament'
      })
      await db.create({
        ...createSampleTournamentData(),
        name: 'Summer Cup',
        description: 'Beach tournament'
      })
      
      const springResults = await db.search('spring')
      const annualResults = await db.search('annual')
      const beachResults = await db.search('beach')
      
      expect(springResults).toHaveLength(1)
      expect(springResults[0].name).toBe('Spring Championship')
      expect(annualResults).toHaveLength(1)
      expect(beachResults).toHaveLength(1)
    })
  })

  describe('findInDateRange', () => {
    it('should find tournaments in date range', async () => {
      const now = new Date()
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      await db.create({
        ...createSampleTournamentData(),
        name: 'Next Week Tournament',
        startDate: nextWeek.toISOString()
      })
      await db.create({
        ...createSampleTournamentData(),
        name: 'Next Month Tournament',
        startDate: nextMonth.toISOString()
      })
      
      const inRange = await db.findInDateRange(
        new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      )
      
      expect(inRange).toHaveLength(1)
      expect(inRange[0].name).toBe('Next Week Tournament')
    })
  })

  describe('getStatsSummary', () => {
    it('should return comprehensive statistics', async () => {
      await db.create({
        ...createSampleTournamentData(),
        type: 'single-elimination',
        format: 'doubles'
      })
      await db.create({
        ...createSampleTournamentData(),
        name: 'Swiss Tournament',
        type: 'swiss',
        format: 'singles'
      })
      
      // Add players to tournaments
      const tournaments = await db.findAll()
      await db.addPlayer(tournaments[0].id, 'player1')
      await db.addPlayer(tournaments[0].id, 'player2')
      await db.addPlayer(tournaments[1].id, 'player3')
      
      const stats = await db.getStatsSummary()
      
      expect(stats.total).toBe(2)
      expect(stats.byStatus.setup).toBe(2)
      expect(stats.byType['single-elimination']).toBe(1)
      expect(stats.byType.swiss).toBe(1)
      expect(stats.byFormat.doubles).toBe(1)
      expect(stats.byFormat.singles).toBe(1)
      expect(stats.totalPlayers).toBe(3)
      expect(stats.averagePlayersPerTournament).toBe(1.5)
    })
  })
})

describe('TournamentUtils', () => {
  const createSampleTournament = () => ({
    id: 'test-tournament',
    name: 'Test Tournament',
    type: 'single-elimination' as const,
    status: 'setup' as TournamentStatus,
    format: 'doubles' as const,
    maxPoints: 13,
    shortForm: false,
    startDate: new Date().toISOString(),
    organizer: 'Test Organizer',
    maxPlayers: 16,
    currentPlayers: 8,
    settings: {
      allowLateRegistration: true,
      automaticBracketGeneration: true,
      requireCheckin: true,
      courtAssignmentMode: 'automatic' as const,
      scoringMode: 'self-report' as const,
      realTimeUpdates: true,
      allowSpectators: true
    },
    stats: {
      totalMatches: 10,
      completedMatches: 7,
      averageMatchDuration: 45,
      totalEnds: 50,
      highestScore: 13,
      averageScore: 8.5
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  describe('canStart', () => {
    it('should return true for tournament that can be started', () => {
      const tournament = {
        ...createSampleTournament(),
        currentPlayers: 4
      }
      
      const result = TournamentUtils.canStart(tournament)
      expect(result.canStart).toBe(true)
    })

    it('should return false for tournament with insufficient players', () => {
      const tournament = {
        ...createSampleTournament(),
        currentPlayers: 2
      }
      
      const result = TournamentUtils.canStart(tournament)
      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('Minimum 4 players required')
    })

    it('should return false for non-setup tournament', () => {
      const tournament = {
        ...createSampleTournament(),
        status: 'active' as TournamentStatus,
        currentPlayers: 8
      }
      
      const result = TournamentUtils.canStart(tournament)
      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('not in setup status')
    })
  })

  describe('canAddPlayer', () => {
    it('should return true when player can be added', () => {
      const tournament = createSampleTournament()
      
      const result = TournamentUtils.canAddPlayer(tournament)
      expect(result.canAdd).toBe(true)
    })

    it('should return false when tournament is full', () => {
      const tournament = {
        ...createSampleTournament(),
        currentPlayers: 16,
        maxPlayers: 16
      }
      
      const result = TournamentUtils.canAddPlayer(tournament)
      expect(result.canAdd).toBe(false)
      expect(result.reason).toBe('Tournament is full')
    })

    it('should return false for active tournament without late registration', () => {
      const tournament = {
        ...createSampleTournament(),
        status: 'active' as TournamentStatus,
        settings: {
          ...createSampleTournament().settings,
          allowLateRegistration: false
        }
      }
      
      const result = TournamentUtils.canAddPlayer(tournament)
      expect(result.canAdd).toBe(false)
      expect(result.reason).toBe('Late registration not allowed')
    })
  })

  describe('getProgress', () => {
    it('should calculate tournament progress percentage', () => {
      const tournament = createSampleTournament()
      const progress = TournamentUtils.getProgress(tournament)
      expect(progress).toBe(70) // 7/10 matches completed
    })

    it('should return 0 for tournament with no matches', () => {
      const tournament = {
        ...createSampleTournament(),
        stats: {
          ...createSampleTournament().stats,
          totalMatches: 0,
          completedMatches: 0
        }
      }
      
      const progress = TournamentUtils.getProgress(tournament)
      expect(progress).toBe(0)
    })
  })

  describe('getDuration', () => {
    it('should calculate tournament duration', () => {
      const startDate = new Date('2025-01-01T10:00:00Z')
      const endDate = new Date('2025-01-01T15:30:00Z')
      
      const tournament = {
        ...createSampleTournament(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
      
      const duration = TournamentUtils.getDuration(tournament)
      expect(duration).toBe(6) // 5.5 hours rounded up
    })

    it('should return null for ongoing tournament', () => {
      const tournament = {
        ...createSampleTournament(),
        endDate: undefined
      }
      
      const duration = TournamentUtils.getDuration(tournament)
      expect(duration).toBeNull()
    })
  })
})