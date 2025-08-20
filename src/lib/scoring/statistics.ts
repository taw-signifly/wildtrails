import { Match, Score } from '@/types'
import { TeamStatistics, PlayerStatistics, TournamentStatistics, MatchAnalysis, EndAnalysis, StatisticsOptions } from '@/types/scoring'
import { PETANQUE_RULES, isDominantWin, isCloseGame, classifyGame } from './rules'

/**
 * Statistical calculations for Petanque tournaments
 * Implements APD (Average Points Differential), Delta system, and comprehensive analytics
 */

/**
 * Calculate points differential for a single match
 * @param score Final match score
 * @returns Points differential (positive for team1 win, negative for team2 win)
 */
export function calculatePointsDifferential(score: Score): number {
  if (!score.isComplete) {
    throw new Error('Cannot calculate points differential for incomplete match')
  }
  
  // Return the absolute difference, with sign indicating winner
  if (score.team1 === PETANQUE_RULES.MAX_GAME_POINTS) {
    return score.team1 - score.team2  // Positive differential for team1 win
  } else if (score.team2 === PETANQUE_RULES.MAX_GAME_POINTS) {
    return score.team2 - score.team1  // Positive differential for team2 win (but we'll make it negative for team1 perspective)
  }
  
  return 0  // Should not happen in complete games
}

/**
 * Calculate Average Points Differential (APD) for a set of matches
 * @param matches Array of completed matches
 * @param teamId Optional team ID to calculate APD for specific team
 * @returns APD value
 */
export function calculateAPD(matches: Match[], teamId?: string): number {
  const completedMatches = matches.filter(m => m.status === 'completed' && m.score.isComplete)
  
  if (completedMatches.length === 0) return 0
  
  let totalDifferential = 0
  let relevantMatches = 0
  
  for (const match of completedMatches) {
    if (teamId) {
      // Calculate APD from specific team's perspective
      if (match.team1.id === teamId) {
        const differential = calculatePointsDifferential(match.score)
        totalDifferential += differential
        relevantMatches++
      } else if (match.team2.id === teamId) {
        const differential = calculatePointsDifferential(match.score)
        totalDifferential -= differential  // Reverse sign for team2 perspective
        relevantMatches++
      }
    } else {
      // Calculate overall tournament APD
      totalDifferential += Math.abs(calculatePointsDifferential(match.score))
      relevantMatches++
    }
  }
  
  if (relevantMatches === 0) return 0
  
  const apd = totalDifferential / relevantMatches
  return Math.round(apd * 100) / 100  // Round to 2 decimal places
}

/**
 * Calculate Delta system value for tie-breaking
 * The Delta system considers both wins and point differentials
 * @param matches Array of matches involving the team
 * @param teamId Team ID to calculate Delta for
 * @returns Delta value
 */
export function calculateDelta(matches: Match[], teamId: string): number {
  const completedMatches = matches.filter(m => 
    m.status === 'completed' && 
    m.score.isComplete &&
    (m.team1.id === teamId || m.team2.id === teamId)
  )
  
  if (completedMatches.length === 0) return 0
  
  let deltaSum = 0
  
  for (const match of completedMatches) {
    const isTeam1 = match.team1.id === teamId
    const teamScore = isTeam1 ? match.score.team1 : match.score.team2
    const opponentScore = isTeam1 ? match.score.team2 : match.score.team1
    
    if (teamScore === PETANQUE_RULES.MAX_GAME_POINTS) {
      // Team won: Delta = 13 + (13 - opponent_score)
      deltaSum += PETANQUE_RULES.MAX_GAME_POINTS + (PETANQUE_RULES.MAX_GAME_POINTS - opponentScore)
    } else {
      // Team lost: Delta = team_score
      deltaSum += teamScore
    }
  }
  
  return Math.round(deltaSum * 100) / 100
}

/**
 * Calculate comprehensive team statistics
 * @param teamId Team ID
 * @param matches Array of matches involving the team
 * @param options Statistics calculation options
 * @returns Comprehensive team statistics
 */
export function calculateTeamStatistics(
  teamId: string, 
  matches: Match[], 
  options: Partial<StatisticsOptions> = {}
): TeamStatistics {
  const {
    includeIncompleteMatches = false,
    weightRecentMatches = true,
    minimumMatchesRequired = 1,
    calculationPrecision = 2
  } = options
  
  // Filter matches involving this team
  const teamMatches = matches.filter(m => 
    m.team1.id === teamId || m.team2.id === teamId
  )
  
  const relevantMatches = includeIncompleteMatches 
    ? teamMatches 
    : teamMatches.filter(m => m.status === 'completed' && m.score.isComplete)
    
  if (relevantMatches.length < minimumMatchesRequired) {
    return createEmptyTeamStatistics()
  }
  
  // Basic counting statistics
  let matchesWon = 0
  let matchesLost = 0
  let totalPointsFor = 0
  let totalPointsAgainst = 0
  let dominantWins = 0
  let comfortableWins = 0
  let closeWins = 0
  let closeLosses = 0
  let comfortableLosses = 0
  let dominantLosses = 0
  
  const matchResults: number[] = []  // 1 for win, 0 for loss
  let currentStreak = 0
  let longestWinStreak = 0
  let longestLossStreak = 0
  let currentStreakType: 'win' | 'loss' | null = null
  let currentStreakLength = 0
  
  let largestWin = 0
  let largestLoss = 0
  let totalDuration = 0
  let fastestWin = Number.MAX_VALUE
  let longestMatch = 0
  
  // Process each match
  for (const match of relevantMatches) {
    const isTeam1 = match.team1.id === teamId
    const teamScore = isTeam1 ? match.score.team1 : match.score.team2
    const opponentScore = isTeam1 ? match.score.team2 : match.score.team1
    
    totalPointsFor += teamScore
    totalPointsAgainst += opponentScore
    
    // Track match duration
    if (match.duration) {
      totalDuration += match.duration
      longestMatch = Math.max(longestMatch, match.duration)
    }
    
    if (match.status === 'completed' && match.score.isComplete) {
      const won = teamScore === PETANQUE_RULES.MAX_GAME_POINTS
      const differential = Math.abs(teamScore - opponentScore)
      
      if (won) {
        matchesWon++
        matchResults.push(1)
        largestWin = Math.max(largestWin, differential)
        
        // Categorize win type
        if (isDominantWin(teamScore, opponentScore)) {
          dominantWins++
        } else if (differential >= 4) {
          comfortableWins++
        } else {
          closeWins++
        }
        
        // Track fastest win
        if (match.duration && match.duration < fastestWin) {
          fastestWin = match.duration
        }
        
        // Update streak tracking
        if (currentStreakType === 'win') {
          currentStreakLength++
        } else {
          if (currentStreakType === 'loss') {
            longestLossStreak = Math.max(longestLossStreak, currentStreakLength)
          }
          currentStreakType = 'win'
          currentStreakLength = 1
        }
      } else {
        matchesLost++
        matchResults.push(0)
        largestLoss = Math.max(largestLoss, differential)
        
        // Categorize loss type
        if (isCloseGame(opponentScore, teamScore)) {
          closeLosses++
        } else if (differential >= 4) {
          comfortableLosses++
        } else {
          dominantLosses++
        }
        
        // Update streak tracking
        if (currentStreakType === 'loss') {
          currentStreakLength++
        } else {
          if (currentStreakType === 'win') {
            longestWinStreak = Math.max(longestWinStreak, currentStreakLength)
          }
          currentStreakType = 'loss'
          currentStreakLength = 1
        }
      }
    }
  }
  
  // Finalize streak tracking
  if (currentStreakType === 'win') {
    longestWinStreak = Math.max(longestWinStreak, currentStreakLength)
    currentStreak = currentStreakLength
  } else if (currentStreakType === 'loss') {
    longestLossStreak = Math.max(longestLossStreak, currentStreakLength)
    currentStreak = -currentStreakLength
  }
  
  // Calculate percentages and averages
  const totalCompletedMatches = matchesWon + matchesLost
  const winPercentage = totalCompletedMatches > 0 
    ? Math.round((matchesWon / totalCompletedMatches) * 10000) / 100 
    : 0
    
  const averagePointsFor = relevantMatches.length > 0 
    ? Math.round((totalPointsFor / relevantMatches.length) * 100) / 100 
    : 0
    
  const averagePointsAgainst = relevantMatches.length > 0 
    ? Math.round((totalPointsAgainst / relevantMatches.length) * 100) / 100 
    : 0
    
  const pointsDifferential = totalPointsFor - totalPointsAgainst
  const averagePointsDifferential = calculateAPD(relevantMatches, teamId)
  
  const averageMatchDuration = totalDuration > 0 && totalCompletedMatches > 0
    ? Math.round(totalDuration / totalCompletedMatches)
    : 0
  
  // Calculate form index (weighted recent performance)
  const recentForm = matchResults.slice(-10)  // Last 10 matches
  let formIndex = 0
  if (weightRecentMatches && recentForm.length > 0) {
    // Weight recent matches more heavily
    let weightedSum = 0
    let totalWeight = 0
    for (let i = 0; i < recentForm.length; i++) {
      const weight = i + 1  // More recent matches have higher weight
      weightedSum += recentForm[i] * weight
      totalWeight += weight
    }
    formIndex = Math.round((weightedSum / totalWeight) * 100)
  } else if (recentForm.length > 0) {
    formIndex = Math.round((recentForm.reduce((sum, result) => sum + result, 0) / recentForm.length) * 100)
  }
  
  return {
    matchesPlayed: relevantMatches.length,
    matchesWon,
    matchesLost,
    winPercentage,
    totalPointsFor,
    totalPointsAgainst,
    averagePointsFor,
    averagePointsAgainst,
    pointsDifferential,
    averagePointsDifferential,
    dominantWins,
    comfortableWins,
    closeWins,
    closeLosses,
    comfortableLosses,
    dominantLosses,
    currentStreak,
    longestWinStreak,
    longestLossStreak,
    recentForm,
    formIndex,
    largestWin,
    largestLoss,
    averageMatchDuration,
    fastestWin: fastestWin === Number.MAX_VALUE ? 0 : fastestWin,
    longestMatch
  }
}

/**
 * Calculate tournament-wide statistics
 * @param tournamentId Tournament ID
 * @param matches Array of tournament matches
 * @param options Statistics options
 * @returns Tournament statistics
 */
export function calculateTournamentStatistics(
  tournamentId: string,
  matches: Match[],
  options: Partial<StatisticsOptions> = {}
): TournamentStatistics {
  const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId)
  const completedMatches = tournamentMatches.filter(m => m.status === 'completed' && m.score.isComplete)
  
  if (tournamentMatches.length === 0) {
    throw new Error(`No matches found for tournament ${tournamentId}`)
  }
  
  // Get unique teams
  const teamIds = new Set<string>()
  tournamentMatches.forEach(match => {
    teamIds.add(match.team1.id)
    teamIds.add(match.team2.id)
  })
  
  // Calculate basic statistics
  const totalPoints = completedMatches.reduce((sum, match) => 
    sum + match.score.team1 + match.score.team2, 0)
  const averageMatchScore = completedMatches.length > 0 
    ? Math.round(totalPoints / completedMatches.length * 100) / 100 
    : 0
  
  // Find score patterns
  const scoreFrequency = new Map<string, number>()
  let highestScoringMatch = { matchId: '', totalPoints: 0 }
  let lowestScoringMatch = { matchId: '', totalPoints: Number.MAX_VALUE }
  
  for (const match of completedMatches) {
    const scoreKey = `${match.score.team1}-${match.score.team2}`
    scoreFrequency.set(scoreKey, (scoreFrequency.get(scoreKey) || 0) + 1)
    
    const totalMatchPoints = match.score.team1 + match.score.team2
    if (totalMatchPoints > highestScoringMatch.totalPoints) {
      highestScoringMatch = { matchId: match.id, totalPoints: totalMatchPoints }
    }
    if (totalMatchPoints < lowestScoringMatch.totalPoints) {
      lowestScoringMatch = { matchId: match.id, totalPoints: totalMatchPoints }
    }
  }
  
  // Find most common final score
  let mostCommonFinalScore = '13-0'
  let maxFrequency = 0
  for (const [score, frequency] of scoreFrequency) {
    if (frequency > maxFrequency) {
      maxFrequency = frequency
      mostCommonFinalScore = score
    }
  }
  
  // Calculate match durations
  const matchesWithDuration = completedMatches.filter(m => m.duration)
  const averageMatchDuration = matchesWithDuration.length > 0
    ? Math.round(matchesWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0) / matchesWithDuration.length)
    : 0
  
  let shortestMatch = { matchId: '', duration: Number.MAX_VALUE }
  let longestMatch = { matchId: '', duration: 0 }
  
  for (const match of matchesWithDuration) {
    if (match.duration! < shortestMatch.duration) {
      shortestMatch = { matchId: match.id, duration: match.duration! }
    }
    if (match.duration! > longestMatch.duration) {
      longestMatch = { matchId: match.id, duration: match.duration! }
    }
  }
  
  // Calculate competitive balance
  let blowoutCount = 0
  let closeMatchCount = 0
  
  for (const match of completedMatches) {
    const winnerScore = Math.max(match.score.team1, match.score.team2)
    const loserScore = Math.min(match.score.team1, match.score.team2)
    
    if (isDominantWin(winnerScore, loserScore)) {
      blowoutCount++
    } else if (isCloseGame(winnerScore, loserScore)) {
      closeMatchCount++
    }
  }
  
  const blowoutPercentage = completedMatches.length > 0 
    ? Math.round((blowoutCount / completedMatches.length) * 10000) / 100 
    : 0
  const closeMatchPercentage = completedMatches.length > 0 
    ? Math.round((closeMatchCount / completedMatches.length) * 10000) / 100 
    : 0
  
  // Competitive index (higher = more competitive)
  const competitiveIndex = Math.round((closeMatchPercentage + (50 - blowoutPercentage)) * 100) / 100
  
  // Calculate APD for all teams
  const teamAPDs = new Map<string, number>()
  const deltaValues = new Map<string, number>()
  
  for (const teamId of teamIds) {
    teamAPDs.set(teamId, calculateAPD(tournamentMatches, teamId))
    deltaValues.set(teamId, calculateDelta(tournamentMatches, teamId))
  }
  
  const overallAPD = calculateAPD(tournamentMatches)
  
  return {
    tournamentId,
    totalTeams: teamIds.size,
    totalMatches: tournamentMatches.length,
    completedMatches: completedMatches.length,
    averageTeamRating: 0, // Would need rating system implementation
    averageMatchScore,
    mostCommonFinalScore,
    highestScoringMatch,
    lowestScoringMatch: lowestScoringMatch.totalPoints === Number.MAX_VALUE 
      ? { matchId: '', totalPoints: 0 } 
      : lowestScoringMatch,
    averageMatchDuration,
    shortestMatch: shortestMatch.duration === Number.MAX_VALUE 
      ? { matchId: '', duration: 0 } 
      : shortestMatch,
    longestMatch,
    blowoutPercentage,
    closeMatchPercentage,
    competitiveIndex,
    overallAPD,
    teamAPDs: Object.fromEntries(teamAPDs),
    deltaValues: Object.fromEntries(deltaValues)
  }
}

/**
 * Create empty team statistics structure
 */
function createEmptyTeamStatistics(): TeamStatistics {
  return {
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winPercentage: 0,
    totalPointsFor: 0,
    totalPointsAgainst: 0,
    averagePointsFor: 0,
    averagePointsAgainst: 0,
    pointsDifferential: 0,
    averagePointsDifferential: 0,
    dominantWins: 0,
    comfortableWins: 0,
    closeWins: 0,
    closeLosses: 0,
    comfortableLosses: 0,
    dominantLosses: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
    recentForm: [],
    formIndex: 0,
    largestWin: 0,
    largestLoss: 0,
    averageMatchDuration: 0,
    fastestWin: 0,
    longestMatch: 0
  }
}

/**
 * Export all statistics functions
 */
export const StatisticsEngine = {
  calculatePointsDifferential,
  calculateAPD,
  calculateDelta,
  calculateTeamStatistics,
  calculateTournamentStatistics
} as const