import {
  validateBasicInformation,
  validateTournamentSettings,
  validatePlayerRegistration,
  validateBracketConfiguration,
  validateCompleteSetup,
  type BasicInformation,
  type TournamentSettingsForm,
  type PlayerRegistration,
  type BracketConfiguration
} from '../tournament-setup'

describe('Tournament Setup Validation', () => {
  describe('validateBasicInformation', () => {
    const validBasicInfo: BasicInformation = {
      name: 'Summer Championship',
      type: 'single-elimination',
      format: 'doubles',
      startDate: '2025-08-21T09:00:00.000Z',
      organizer: 'John Doe',
      description: 'Annual summer tournament',
      location: 'City Park'
    }

    it('should validate correct basic information', () => {
      const result = validateBasicInformation(validBasicInfo)
      expect(result.success).toBe(true)
    })

    it('should require tournament name', () => {
      const invalid = { ...validBasicInfo, name: '' }
      const result = validateBasicInformation(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('name'))).toBe(true)
      }
    })

    it('should require organizer', () => {
      const invalid = { ...validBasicInfo, organizer: '' }
      const result = validateBasicInformation(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('organizer'))).toBe(true)
      }
    })

    it('should validate tournament type enum', () => {
      const invalid = { ...validBasicInfo, type: 'invalid-type' as any }
      const result = validateBasicInformation(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate game format enum', () => {
      const invalid = { ...validBasicInfo, format: 'invalid-format' as any }
      const result = validateBasicInformation(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validateTournamentSettings', () => {
    const validSettings: TournamentSettingsForm = {
      maxPoints: 13,
      shortForm: false,
      maxPlayers: 32,
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual',
        scoringMode: 'self-report',
        realTimeUpdates: true,
        allowSpectators: true
      }
    }

    it('should validate correct tournament settings', () => {
      const result = validateTournamentSettings(validSettings)
      expect(result.success).toBe(true)
    })

    it('should enforce maxPoints limits', () => {
      const invalid = { ...validSettings, maxPoints: 25 }
      const result = validateTournamentSettings(invalid)
      expect(result.success).toBe(false)
    })

    it('should enforce maxPlayers limits', () => {
      const invalid = { ...validSettings, maxPlayers: 2 }
      const result = validateTournamentSettings(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validatePlayerRegistration', () => {
    const validPlayers: PlayerRegistration = {
      players: [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          club: 'Local Club'
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          ranking: 100
        },
        {
          firstName: 'Bob',
          lastName: 'Wilson',
          email: 'bob@example.com'
        },
        {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com'
        }
      ]
    }

    it('should validate correct player registration', () => {
      const result = validatePlayerRegistration(validPlayers)
      expect(result.success).toBe(true)
    })

    it('should require minimum 4 players', () => {
      const invalid = { ...validPlayers, players: validPlayers.players.slice(0, 3) }
      const result = validatePlayerRegistration(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate player email format', () => {
      const invalid = {
        ...validPlayers,
        players: [
          ...validPlayers.players.slice(0, 3),
          { firstName: 'Test', lastName: 'User', email: 'invalid-email' }
        ]
      }
      const result = validatePlayerRegistration(invalid)
      expect(result.success).toBe(false)
    })

    it('should require first and last names', () => {
      const invalid = {
        ...validPlayers,
        players: [
          ...validPlayers.players.slice(0, 3),
          { firstName: '', lastName: 'User', email: 'test@example.com' }
        ]
      }
      const result = validatePlayerRegistration(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validateBracketConfiguration', () => {
    const validBracket: BracketConfiguration = {
      seedingType: 'random',
      allowByes: true,
      courtAssignments: []
    }

    it('should validate correct bracket configuration', () => {
      const result = validateBracketConfiguration(validBracket)
      expect(result.success).toBe(true)
    })

    it('should validate seeding type enum', () => {
      const invalid = { ...validBracket, seedingType: 'invalid-seeding' as any }
      const result = validateBracketConfiguration(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validateCompleteSetup', () => {
    const completeSetup = {
      // Basic information
      name: 'Complete Tournament',
      type: 'single-elimination' as const,
      format: 'doubles' as const,
      startDate: '2025-08-21T09:00:00.000Z',
      organizer: 'Tournament Organizer',
      location: 'Test Location',
      
      // Settings
      maxPoints: 13,
      shortForm: false,
      maxPlayers: 32,
      settings: {
        allowLateRegistration: false,
        automaticBracketGeneration: true,
        requireCheckin: false,
        courtAssignmentMode: 'manual' as const,
        scoringMode: 'self-report' as const,
        realTimeUpdates: true,
        allowSpectators: true
      },
      
      // Players (8 players for doubles = 4 teams)
      players: [
        { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        { firstName: 'Bob', lastName: 'Wilson', email: 'bob@example.com' },
        { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com' },
        { firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com' },
        { firstName: 'Diana', lastName: 'Davis', email: 'diana@example.com' },
        { firstName: 'Eve', lastName: 'Miller', email: 'eve@example.com' },
        { firstName: 'Frank', lastName: 'Taylor', email: 'frank@example.com' }
      ],
      
      // Bracket
      seedingType: 'random' as const,
      allowByes: true
    }

    it('should validate complete tournament setup', () => {
      const result = validateCompleteSetup(completeSetup)
      expect(result.success).toBe(true)
    })

    it('should enforce format-specific player requirements', () => {
      // Singles format needs at least 4 players (4 teams)
      const singlesSetup = { 
        ...completeSetup, 
        format: 'singles' as const,
        players: completeSetup.players.slice(0, 4) 
      }
      const result = validateCompleteSetup(singlesSetup)
      expect(result.success).toBe(true)

      // Not enough players for format
      const insufficient = { 
        ...completeSetup, 
        format: 'triples' as const,
        players: completeSetup.players.slice(0, 8) // Only 8 players for triples = 2.67 teams, need at least 12
      }
      const result2 = validateCompleteSetup(insufficient)
      expect(result2.success).toBe(false)
    })

    it('should validate team formation requirements', () => {
      const withTeams = {
        ...completeSetup,
        teams: [
          { id: 'team1', name: 'Team 1', players: ['john@example.com', 'jane@example.com'] },
          { id: 'team2', name: 'Team 2', players: ['bob@example.com', 'alice@example.com'] },
          { id: 'team3', name: 'Team 3', players: ['charlie@example.com', 'diana@example.com'] },
          { id: 'team4', name: 'Team 4', players: ['eve@example.com', 'frank@example.com'] }
        ]
      }
      const result = validateCompleteSetup(withTeams)
      expect(result.success).toBe(true)

      // Invalid team size for format
      const invalidTeams = {
        ...completeSetup,
        format: 'triples' as const,
        teams: [
          { id: 'team1', name: 'Team 1', players: ['john@example.com', 'jane@example.com'] } // Only 2 players for triples
        ]
      }
      const result2 = validateCompleteSetup(invalidTeams)
      expect(result2.success).toBe(false)
    })
  })
})