import { Boule, Position, Score, End, Match, CourtDimensions, GameFormat } from './index'

export interface EndScoreResult {
  winner: string           // team ID
  points: number          // points awarded (1-6)
  winningBoules: Boule[]  // boules that scored
  measurements: EndMeasurement[]
  isCloseCall: boolean    // requires physical measurement
  confidence: number      // calculation confidence (0-1)
  endSummary: string      // human-readable description
}

export interface EndMeasurement {
  bouleId: string
  distanceFromJack: number  // distance in cm
  teamId: string
  isClosest: boolean       // is this the closest boule for the team
  isScoring: boolean       // does this boule score points
  measurementType: 'calculated' | 'measured' | 'estimated'
  precision: number        // measurement precision in cm
}

export interface RelativePosition {
  distance: number         // distance from reference point
  bearing: number          // angle in degrees (0 = north)
  quadrant: 'NE' | 'NW' | 'SE' | 'SW'
}

export interface ScoreValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  ruleViolations: RuleViolation[]
  scoreIntegrity: ScoreIntegrityCheck
}

export interface ScoreIntegrityCheck {
  scoreSumMatches: boolean    // score matches sum of ends
  progressionLogical: boolean // score progression makes sense
  endCountReasonable: boolean // number of ends is reasonable
  noImpossibleJumps: boolean  // no impossible score jumps
}

export interface RuleViolation {
  rule: string              // rule identifier
  severity: 'error' | 'warning' | 'info'
  description: string       // human-readable description
  suggestion?: string       // suggested fix
  affectedField?: string    // field that violates rule
}

export interface TeamStatistics {
  // Basic stats
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winPercentage: number
  
  // Scoring stats
  totalPointsFor: number
  totalPointsAgainst: number
  averagePointsFor: number
  averagePointsAgainst: number
  pointsDifferential: number
  averagePointsDifferential: number
  
  // Performance categories
  dominantWins: number      // wins by 8+ points (13-5 or better)
  comfortableWins: number   // wins by 4-7 points
  closeWins: number         // wins by 1-3 points
  closeLosses: number       // losses by 1-3 points
  comfortableLosses: number // losses by 4-7 points
  dominantLosses: number    // losses by 8+ points
  
  // Streaks and form
  currentStreak: number     // current win/loss streak (positive = wins)
  longestWinStreak: number
  longestLossStreak: number
  recentForm: number[]      // last 10 match results (1 = win, 0 = loss)
  formIndex: number         // weighted recent form score (0-100)
  
  // Match characteristics
  largestWin: number        // biggest winning margin
  largestLoss: number       // biggest losing margin
  averageMatchDuration: number // average match time in minutes
  fastestWin: number        // quickest win duration
  longestMatch: number      // longest match duration
}

export interface PlayerStatistics extends TeamStatistics {
  // Player-specific stats
  playerId: string
  gamesAsPlayer1: number    // games where player was first boule thrower
  gamesAsPlayer2: number    // games where player was second boule thrower
  gamesAsPointer: number    // games where player was primary pointer
  gamesAsShooter: number    // games where player was primary shooter
  
  // End-level performance
  endsWon: number
  endsLost: number
  endWinPercentage: number
  averagePointsPerEnd: number
  bigEnds: number           // ends where player's team scored 4+ points
  
  // Pressure performance
  clutchEnds: number        // ends at 12 points
  clutchEndWins: number     // successful clutch ends
  clutchPercentage: number  // clutch end success rate
  
  // Partner compatibility (for team formats)
  bestPartner?: {
    partnerId: string
    matchesTogether: number
    winPercentage: number
  }
}

export interface EndAnalysis {
  endNumber: number
  duration?: number         // end duration in seconds
  jackPosition: Position
  totalBoules: number
  boulesPerTeam: { [teamId: string]: number }
  
  // Scoring analysis
  winnerTeamId: string
  pointsAwarded: number
  winningMargin: number     // distance margin to next closest boule
  isCloseEnd: boolean       // decided by less than 2cm
  isBigEnd: boolean         // 4+ points scored
  
  // End characteristics
  endType: 'dominant' | 'competitive' | 'close' | 'measuring'
  difficultyRating: number  // 1-10 based on boule clustering
  
  // Momentum impact
  gameState: 'early' | 'middle' | 'late' | 'critical'
  momentumShift: number     // -3 to +3, momentum change impact
  pressureLevel: number     // 1-10, pressure on players
}

export interface MatchAnalysis {
  match: Match
  endAnalyses: EndAnalysis[]
  
  // Overall match characteristics
  matchType: 'blowout' | 'competitive' | 'comeback' | 'close'
  totalDuration: number
  averageEndDuration: number
  
  // Momentum analysis
  momentumSwings: number    // number of significant momentum changes
  leadChanges: number       // number of times lead changed
  largestLead: number       // biggest lead during match
  
  // Performance metrics
  dominanceScore: number    // how dominant was the winner (0-100)
  competitiveness: number   // how competitive was the match (0-100)
  entertainmentValue: number // subjective entertainment score (0-100)
  
  // Critical moments
  turningPoints: number[]   // end numbers that were turning points
  clutchEnds: number[]      // high-pressure end numbers
  bigEnds: number[]         // ends with 4+ points
}

export interface TournamentStatistics {
  tournamentId: string
  
  // Participation
  totalTeams: number
  totalMatches: number
  completedMatches: number
  averageTeamRating: number
  
  // Scoring patterns
  averageMatchScore: number
  mostCommonFinalScore: string
  highestScoringMatch: { matchId: string; totalPoints: number }
  lowestScoringMatch: { matchId: string; totalPoints: number }
  
  // Match characteristics
  averageMatchDuration: number
  shortestMatch: { matchId: string; duration: number }
  longestMatch: { matchId: string; duration: number }
  
  // Competitive balance
  blowoutPercentage: number     // matches decided by 8+ points
  closeMatchPercentage: number  // matches decided by 1-3 points
  competitiveIndex: number      // overall competitiveness (0-100)
  
  // APD (Average Points Differential) calculations
  overallAPD: number
  teamAPDs: { [teamId: string]: number }
  
  // Delta system for tie-breaking
  deltaValues: { [teamId: string]: number }
}

export interface EndInput {
  endNumber: number
  jackPosition: Position
  boules: Omit<Boule, 'distance'>[]  // distances will be calculated
  duration?: number
  notes?: string
}

export interface ScoringConfiguration {
  gameFormat: GameFormat
  maxPoints: number         // typically 13
  maxPointsPerEnd: number   // typically 6 for triples
  measurementPrecision: number // measurement precision in cm
  courtDimensions: CourtDimensions
  
  // Rule variations
  shortForm: boolean        // 6-end games vs full games
  tiebreakRules: 'sudden_death' | 'extra_ends' | 'measurement'
  jackValidZone: {
    minDistance: number     // minimum distance from throwing circle
    maxDistance: number     // maximum distance from throwing circle
  }
}

export interface DistanceCalculationResult {
  distance: number          // distance in cm
  confidence: number        // confidence in calculation (0-1)
  method: 'euclidean' | 'manhattan' | 'measured'
  precision: number         // precision of measurement in cm
}

export interface ScoringEngineOptions {
  precision: number         // calculation precision in cm
  measurementThreshold: number // threshold for requiring physical measurement
  confidenceThreshold: number  // minimum confidence for automatic scoring
  debugMode: boolean        // enable detailed calculation logging
}

export interface ValidationOptions {
  strict: boolean           // enforce strict rule validation
  allowManualOverrides: boolean // allow manual score corrections
  validateProgression: boolean  // validate logical score progression
  checkIntegrity: boolean   // perform integrity checks
}

export interface StatisticsOptions {
  includeIncompleteMatches: boolean
  weightRecentMatches: boolean
  minimumMatchesRequired: number
  calculationPrecision: number // decimal places for percentages
}

export type ScoringEvent = 
  | { type: 'end_calculated'; data: EndScoreResult }
  | { type: 'score_validated'; data: ScoreValidationResult }
  | { type: 'statistics_updated'; data: TeamStatistics }
  | { type: 'match_analyzed'; data: MatchAnalysis }

export interface ScoringEngineState {
  currentMatch?: string
  activeScoringSession?: {
    matchId: string
    startTime: string
    endCount: number
    configuration: ScoringConfiguration
  }
  validationCache: Map<string, ScoreValidationResult>
  statisticsCache: Map<string, TeamStatistics>
}