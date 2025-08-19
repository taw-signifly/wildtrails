/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import {
  getCourts,
  getCourtById,
  createCourt,
  updateCourtData,
  updateCourtStatus,
  assignMatchToCourt,
  releaseCourtAssignment,
  findAvailableCourt,
  getCourtAvailability,
  getCourtSchedule,
  reserveCourtForMatch,
  setCourtMaintenance,
  removeCourtMaintenance,
  getCourtUtilization,
  searchCourts
} from '../courts'
import { CourtDB, CourtStatus, CourtSurface } from '@/lib/db/courts'
import { MatchDB } from '@/lib/db/matches'
import { TournamentDB } from '@/lib/db/tournaments'
import { Court, Match, Tournament, Team, Player } from '@/types'

describe('Court Management Server Actions', () => {
  let testPath: string
  let courtDB: CourtDB
  let matchDB: MatchDB
  let tournamentDB: TournamentDB
  let testTournament: Tournament
  let testCourt: Court
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

  const createSampleCourtData = (overrides = {}) => ({
    name: 'Court 1',
    location: 'Main Field',
    surface: 'gravel' as CourtSurface,
    dimensions: {
      length: 15,
      width: 4,
      throwingDistance: 12
    },
    lighting: true,
    covered: false,
    amenities: ['scoreboard', 'seating'],
    ...overrides
  })

  beforeEach(async () => {
    testPath = join(__dirname, 'courts-test-' + Date.now())
    courtDB = new CourtDB({ dataPath: testPath })
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

    // Create test court
    const courtResult = await courtDB.create(createSampleCourtData())
    if (courtResult.error) {
      throw new Error('Failed to create test court')
    }
    testCourt = courtResult.data!

    // Create test teams and match
    const player1 = createSamplePlayer('player-1', 'John', 'Doe')
    const player2 = createSamplePlayer('player-2', 'Jane', 'Smith')
    const player3 = createSamplePlayer('player-3', 'Bob', 'Wilson')
    const player4 = createSamplePlayer('player-4', 'Alice', 'Brown')

    const testTeam1 = createSampleTeam('team-1', 'Team Alpha', [player1, player2], testTournament.id)
    const testTeam2 = createSampleTeam('team-2', 'Team Beta', [player3, player4], testTournament.id)

    const matchResult = await matchDB.create({
      tournamentId: testTournament.id,
      round: 1,
      roundName: 'Round 1',
      bracketType: 'winner',
      team1: testTeam1,
      team2: testTeam2,
      score: { team1: 0, team2: 0, isComplete: false },
      status: 'scheduled',
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

  describe('createCourt', () => {
    it('should create a court with valid data', async () => {
      const formData = new FormData()
      formData.append('name', 'Court 2')
      formData.append('location', 'North Field')
      formData.append('surface', 'sand')
      formData.append('length', '15')
      formData.append('width', '4')
      formData.append('throwingDistance', '12')
      formData.append('lighting', 'true')
      formData.append('covered', 'false')
      formData.append('amenities', 'scoreboard')
      formData.append('amenities', 'seating')

      const result = await createCourt(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Court 2')
        expect(result.data.location).toBe('North Field')
        expect(result.data.surface).toBe('sand')
        expect(result.data.lighting).toBe(true)
        expect(result.data.covered).toBe(false)
        expect(result.data.amenities).toContain('scoreboard')
      }
    })

    it('should fail with missing required fields', async () => {
      const formData = new FormData()
      formData.append('name', 'Incomplete Court')
      // Missing location, surface, dimensions

      const result = await createCourt(formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should fail with invalid surface type', async () => {
      const formData = new FormData()
      formData.append('name', 'Court 2')
      formData.append('location', 'North Field')
      formData.append('surface', 'invalid-surface')
      formData.append('length', '15')
      formData.append('width', '4')
      formData.append('throwingDistance', '12')

      const result = await createCourt(formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid surface type')
    })
  })

  describe('getCourts', () => {
    beforeEach(async () => {
      await courtDB.create(createSampleCourtData({ 
        name: 'Court 2', 
        surface: 'sand',
        location: 'East Field'
      }))
      await courtDB.create(createSampleCourtData({ 
        name: 'Court 3', 
        surface: 'dirt' 
      }))
    })

    it('should return all courts without filters', async () => {
      const result = await getCourts()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBe(3) // Original + 2 new courts
      }
    })

    it('should filter courts by surface', async () => {
      const result = await getCourts({ surface: 'sand' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].surface).toBe('sand')
      }
    })

    it('should filter courts by status', async () => {
      // Set one court to maintenance
      await courtDB.updateStatus(testCourt.id, 'maintenance')

      const result = await getCourts({ status: 'maintenance' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].status).toBe('maintenance')
      }
    })

    it('should filter courts by location', async () => {
      const result = await getCourts({ location: 'East Field' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].location).toBe('East Field')
      }
    })

    it('should filter available courts only', async () => {
      const result = await getCourts({ available: true })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.every(court => court.status === 'available')).toBe(true)
      }
    })
  })

  describe('getCourtById', () => {
    it('should return specific court by ID', async () => {
      const result = await getCourtById(testCourt.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(testCourt.id)
        expect(result.data.name).toBe('Court 1')
      }
    })

    it('should fail with invalid court ID', async () => {
      const result = await getCourtById('invalid-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail with missing court ID', async () => {
      const result = await getCourtById('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Court ID is required')
    })
  })

  describe('updateCourtData', () => {
    it('should update court properties', async () => {
      const updateData = {
        name: 'Updated Court Name',
        lighting: false,
        amenities: ['updated-amenity']
      }

      const result = await updateCourtData(testCourt.id, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Updated Court Name')
        expect(result.data.lighting).toBe(false)
        expect(result.data.amenities).toContain('updated-amenity')
      }
    })

    it('should fail with missing court ID', async () => {
      const result = await updateCourtData('', { name: 'Updated' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Court ID is required')
    })
  })

  describe('updateCourtStatus', () => {
    it('should update court status to maintenance', async () => {
      const result = await updateCourtStatus(testCourt.id, 'maintenance')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('maintenance')
      }
    })

    it('should fail with invalid status', async () => {
      const result = await updateCourtStatus(testCourt.id, 'invalid-status' as CourtStatus)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid court status')
    })

    it('should fail with missing court ID', async () => {
      const result = await updateCourtStatus('', 'maintenance')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Court ID is required')
    })
  })

  describe('assignMatchToCourt', () => {
    it('should assign scheduled match to available court', async () => {
      const result = await assignMatchToCourt(testMatch.id, testCourt.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.match.courtId).toBe(testCourt.id)
        expect(result.data.court.status).toBe('in-use')
        expect(result.data.court.currentMatch).toBe(testMatch.id)
      }
    })

    it('should fail with completed match', async () => {
      // Complete the match first
      await matchDB.update(testMatch.id, { status: 'completed' })

      const result = await assignMatchToCourt(testMatch.id, testCourt.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot assign court to completed match')
    })

    it('should fail with unavailable court', async () => {
      // Set court to maintenance
      await courtDB.updateStatus(testCourt.id, 'maintenance')

      const result = await assignMatchToCourt(testMatch.id, testCourt.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Court is not available')
    })

    it('should fail with missing IDs', async () => {
      const result1 = await assignMatchToCourt('', testCourt.id)
      const result2 = await assignMatchToCourt(testMatch.id, '')

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
      expect(result1.error).toContain('required')
      expect(result2.error).toContain('required')
    })
  })

  describe('releaseCourtAssignment', () => {
    beforeEach(async () => {
      // Assign court to match first
      await assignMatchToCourt(testMatch.id, testCourt.id)
    })

    it('should release court assignment successfully', async () => {
      const result = await releaseCourtAssignment(testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.match.courtId).toBeUndefined()
        expect(result.data.court?.status).toBe('available')
      }
    })

    it('should fail with unassigned match', async () => {
      // Release first time
      await releaseCourtAssignment(testMatch.id)
      
      // Try to release again
      const result = await releaseCourtAssignment(testMatch.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not assigned to any court')
    })

    it('should fail with missing match ID', async () => {
      const result = await releaseCourtAssignment('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Match ID is required')
    })
  })

  describe('findAvailableCourt', () => {
    beforeEach(async () => {
      // Create additional courts with different properties
      await courtDB.create(createSampleCourtData({
        name: 'Covered Court',
        covered: true,
        lighting: true
      }))
      await courtDB.create(createSampleCourtData({
        name: 'Sand Court',
        surface: 'sand'
      }))
    })

    it('should find available court without requirements', async () => {
      const result = await findAvailableCourt(testTournament.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toBeNull()
        expect(result.data!.status).toBe('available')
      }
    })

    it('should find court matching surface requirement', async () => {
      const result = await findAvailableCourt(testTournament.id, {
        preferredSurface: 'sand'
      })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.surface).toBe('sand')
      }
    })

    it('should find court with lighting requirement', async () => {
      const result = await findAvailableCourt(testTournament.id, {
        requireLighting: true
      })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.lighting).toBe(true)
      }
    })

    it('should return null when no courts match requirements', async () => {
      // Set all courts to maintenance
      const courts = await courtDB.findAll()
      if (courts.data) {
        for (const court of courts.data) {
          await courtDB.updateStatus(court.id, 'maintenance')
        }
      }

      const result = await findAvailableCourt(testTournament.id)

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should fail with missing tournament ID', async () => {
      const result = await findAvailableCourt('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tournament ID is required')
    })
  })

  describe('getCourtAvailability', () => {
    beforeEach(async () => {
      // Assign match to court to create schedule
      await assignMatchToCourt(testMatch.id, testCourt.id)
    })

    it('should return court availability information', async () => {
      const result = await getCourtAvailability(testCourt.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.court.id).toBe(testCourt.id)
        expect(result.data.availability.status).toBe('in-use')
        expect(result.data.availability.currentMatch).toBe(testMatch.id)
        expect(result.data.upcomingMatches).toBeDefined()
      }
    })

    it('should filter matches by date range', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dayAfter = new Date()
      dayAfter.setDate(dayAfter.getDate() + 2)

      const result = await getCourtAvailability(testCourt.id, {
        start: tomorrow.toISOString(),
        end: dayAfter.toISOString()
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.upcomingMatches).toBeDefined()
      }
    })

    it('should fail with invalid court ID', async () => {
      const result = await getCourtAvailability('invalid-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('getCourtSchedule', () => {
    beforeEach(async () => {
      await assignMatchToCourt(testMatch.id, testCourt.id)
      await matchDB.update(testMatch.id, { 
        status: 'active',
        startTime: new Date().toISOString()
      })
    })

    it('should return court schedule with utilization', async () => {
      const result = await getCourtSchedule(testCourt.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.court.id).toBe(testCourt.id)
        expect(result.data.matches).toHaveLength(1)
        expect(result.data.utilization.totalHours).toBe(24)
        expect(result.data.utilization.utilizationRate).toBeGreaterThanOrEqual(0)
      }
    })

    it('should filter schedule by date range', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const result = await getCourtSchedule(testCourt.id, {
        start: yesterday.toISOString(),
        end: tomorrow.toISOString()
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matches).toBeDefined()
        expect(result.data.utilization).toBeDefined()
      }
    })

    it('should fail with missing court ID', async () => {
      const result = await getCourtSchedule('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Court ID is required')
    })
  })

  describe('reserveCourtForMatch', () => {
    it('should reserve available court for match', async () => {
      const result = await reserveCourtForMatch(testCourt.id, testMatch.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.court.status).toBe('reserved')
        expect(result.data.match.id).toBe(testMatch.id)
      }
    })

    it('should fail with missing IDs', async () => {
      const result1 = await reserveCourtForMatch('', testMatch.id)
      const result2 = await reserveCourtForMatch(testCourt.id, '')

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })
  })

  describe('setCourtMaintenance and removeCourtMaintenance', () => {
    it('should set court to maintenance mode with reason', async () => {
      const result = await setCourtMaintenance(testCourt.id, 'Resurfacing needed')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('maintenance')
      }
    })

    it('should remove court from maintenance mode', async () => {
      await setCourtMaintenance(testCourt.id, 'Cleaning')
      
      const result = await removeCourtMaintenance(testCourt.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('available')
      }
    })

    it('should fail maintenance operations with missing court ID', async () => {
      const result1 = await setCourtMaintenance('')
      const result2 = await removeCourtMaintenance('')

      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })
  })

  describe('getCourtUtilization', () => {
    beforeEach(async () => {
      // Create additional courts with different statuses
      await courtDB.create(createSampleCourtData({ 
        name: 'Court 2',
        location: 'North Field'
      }))
      await courtDB.updateStatus(testCourt.id, 'in-use')
    })

    it('should return comprehensive utilization statistics', async () => {
      const result = await getCourtUtilization()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.total).toBe(2)
        expect(result.data.available).toBe(1)
        expect(result.data.inUse).toBe(1)
        expect(result.data.maintenance).toBe(0)
        expect(result.data.reserved).toBe(0)
        expect(result.data.utilizationRate).toBeGreaterThanOrEqual(0)
        expect(result.data.byLocation).toBeDefined()
        expect(result.data.bySurface).toBeDefined()
      }
    })
  })

  describe('searchCourts', () => {
    beforeEach(async () => {
      await courtDB.create(createSampleCourtData({
        name: 'Championship Court',
        location: 'Center Field',
        amenities: ['VIP seating', 'broadcast booth']
      }))
    })

    it('should search courts by name', async () => {
      const result = await searchCourts('Championship')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].name).toContain('Championship')
      }
    })

    it('should search courts by location', async () => {
      const result = await searchCourts('Center')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].location).toContain('Center')
      }
    })

    it('should search courts by amenities', async () => {
      const result = await searchCourts('VIP')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].amenities.some(a => a.includes('VIP'))).toBe(true)
      }
    })

    it('should return empty results for non-matching query', async () => {
      const result = await searchCourts('nonexistent')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('should fail with empty search query', async () => {
      const result = await searchCourts('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Search query is required')
    })
  })
})