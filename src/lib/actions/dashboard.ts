'use server'

import { TournamentDB } from '@/lib/db/tournaments'
import { PlayerDB } from '@/lib/db/players'
import { MatchDB } from '@/lib/db/matches'
import { Tournament, Result, tryCatch } from '@/types'
import { ActionResult } from '@/types/actions'
import { DatabaseError } from '@/lib/db/base'
import { resultToActionResult } from '@/lib/api/action-utils'
import { formatRelativeDate } from '@/lib/utils/date'
import { logger, PerformanceTimer } from '@/lib/utils/logger'
import { 
  DashboardStats, 
  RecentTournament, 
  ActiveMatch, 
  ActivityEvent,
  validateDashboardStats,
  validateRecentTournament,
  validateActiveMatch,
  validateActivityEvent,
  sanitizeTournamentName,
  sanitizePlayerName,
  sanitizeDescription
} from '@/lib/validation/dashboard'

/**
 * Get dashboard statistics with proper error handling and validation
 */
export async function getDashboardStats(): Promise<Result<DashboardStats, DatabaseError>> {
  const timer = new PerformanceTimer('getDashboardStats')
  
  return tryCatch(async () => {
    const [tournamentResult, playerResult, matchResult] = await Promise.all([
      new TournamentDB().findAll(),
      new PlayerDB().findAll(),
      new MatchDB().findAll()
    ])

    // Properly handle Result<T,E> pattern - no silent failures
    if (tournamentResult.error) {
      logger.error('Failed to fetch tournaments for dashboard stats', {
        operation: 'getDashboardStats',
        error: tournamentResult.error.message
      })
      throw tournamentResult.error
    }
    
    if (playerResult.error) {
      logger.error('Failed to fetch players for dashboard stats', {
        operation: 'getDashboardStats',
        error: playerResult.error.message
      })
      throw playerResult.error
    }
    
    if (matchResult.error) {
      logger.error('Failed to fetch matches for dashboard stats', {
        operation: 'getDashboardStats',
        error: matchResult.error.message
      })
      throw matchResult.error
    }

    const tournaments = tournamentResult.data
    const players = playerResult.data
    const matches = matchResult.data

    // Validate and sanitize data before processing
    const validTournaments = tournaments.filter(t => 
      t && typeof t.status === 'string' && typeof t.name === 'string'
    )
    
    const validMatches = matches.filter(m =>
      m && typeof m.status === 'string'
    )

    const stats: DashboardStats = {
      activeTournaments: validTournaments.filter(t => 
        t.status === 'active' || t.status === 'setup'
      ).length,
      registeredPlayers: players.length,
      liveMatches: validMatches.filter(m => m.status === 'active').length,
      totalMatches: validMatches.length
    }

    // Validate the result before returning
    const validatedStats = validateDashboardStats(stats)
    
    timer.end({ 
      activeTournaments: validatedStats.activeTournaments,
      totalPlayers: validatedStats.registeredPlayers
    })
    
    return validatedStats
  })
}

/**
 * Action wrapper for getDashboardStats
 */
export async function getDashboardStatsAction(): Promise<ActionResult<DashboardStats>> {
  const result = await getDashboardStats()
  return resultToActionResult(result, 'Dashboard stats loaded successfully')
}

/**
 * Get recent tournaments with proper error handling and sanitization
 */
export async function getRecentTournaments(): Promise<Result<RecentTournament[], DatabaseError>> {
  const timer = new PerformanceTimer('getRecentTournaments')
  
  return tryCatch(async () => {
    const tournamentResult = await new TournamentDB().findAll()
    
    if (tournamentResult.error) {
      logger.error('Failed to fetch recent tournaments', {
        operation: 'getRecentTournaments',
        error: tournamentResult.error.message
      })
      throw tournamentResult.error
    }
    
    const tournaments = tournamentResult.data
    
    // Sort by creation date (most recent first) and take top 3
    const recentTournaments: RecentTournament[] = tournaments
      .filter(tournament => tournament && typeof tournament.name === 'string')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map(tournament => {
        const sanitizedTournament: RecentTournament = {
          id: tournament.id,
          name: sanitizeTournamentName(tournament.name),
          status: tournament.status,
          participants: tournament.maxPlayers || 0,
          date: formatRelativeDate(tournament.createdAt)
        }
        
        // Validate each tournament before including
        return validateRecentTournament(sanitizedTournament)
      })

    timer.end({ tournamentCount: recentTournaments.length })
    return recentTournaments
  })
}

/**
 * Action wrapper for getRecentTournaments
 */
export async function getRecentTournamentsAction(): Promise<ActionResult<RecentTournament[]>> {
  const result = await getRecentTournaments()
  return resultToActionResult(result, 'Recent tournaments loaded successfully')
}

/**
 * Get active matches with optimized queries and proper error handling
 */
export async function getActiveMatches(): Promise<Result<ActiveMatch[], DatabaseError>> {
  const timer = new PerformanceTimer('getActiveMatches')
  
  return tryCatch(async () => {
    // Optimized: Get only active matches and all tournaments in parallel
    const [matchResult, tournamentResult] = await Promise.all([
      new MatchDB().findByStatus('active'),
      new TournamentDB().findAll()
    ])

    if (matchResult.error) {
      logger.error('Failed to fetch active matches', {
        operation: 'getActiveMatches',
        error: matchResult.error.message
      })
      throw matchResult.error
    }
    
    if (tournamentResult.error) {
      logger.error('Failed to fetch tournaments for active matches', {
        operation: 'getActiveMatches',
        error: tournamentResult.error.message
      })
      throw tournamentResult.error
    }
    
    const matches = matchResult.data
    const tournaments = tournamentResult.data
    
    // Create O(1) lookup map for tournament access
    const tournamentMap = new Map(
      tournaments.map(t => [t.id, t])
    )

    const activeMatches: ActiveMatch[] = matches
      .filter(match => match && match.team1 && match.team2)
      .map(match => {
        const tournament = tournamentMap.get(match.tournamentId)
        
        const activeMatch: ActiveMatch = {
          id: match.id,
          tournamentId: match.tournamentId,
          tournamentName: tournament ? 
            sanitizeTournamentName(tournament.name) : 
            'Unknown Tournament',
          team1: match.team1.players.map(p => sanitizePlayerName(p.displayName)),
          team2: match.team2.players.map(p => sanitizePlayerName(p.displayName)),
          currentScore: [match.score?.team1 || 0, match.score?.team2 || 0] as [number, number],
          court: match.courtId,
          status: match.status === 'active' ? 'active' : 'paused',
          startedAt: match.startTime,
          duration: match.startTime ? 
            Math.floor((new Date().getTime() - new Date(match.startTime).getTime()) / (1000 * 60)) : 
            undefined
        }
        
        // Validate each match before including
        return validateActiveMatch(activeMatch)
      })

    timer.end({ matchCount: activeMatches.length })
    return activeMatches
  })
}

/**
 * Action wrapper for getActiveMatches
 */
export async function getActiveMatchesAction(): Promise<ActionResult<ActiveMatch[]>> {
  const result = await getActiveMatches()
  return resultToActionResult(result, 'Active matches loaded successfully')
}

/**
 * Get recent activity with optimized queries and proper validation
 */
export async function getRecentActivity(): Promise<Result<ActivityEvent[], DatabaseError>> {
  const timer = new PerformanceTimer('getRecentActivity')
  
  return tryCatch(async () => {
    // Use Promise.allSettled to handle partial failures gracefully
    const results = await Promise.allSettled([
      new TournamentDB().findAll(),
      new MatchDB().findAll()
    ])
    
    const tournamentResult = results[0].status === 'fulfilled' 
      ? results[0].value 
      : { data: [], error: new DatabaseError('Failed to fetch tournaments') }
    
    const matchResult = results[1].status === 'fulfilled'
      ? results[1].value
      : { data: [], error: new DatabaseError('Failed to fetch matches') }
    
    // Check for critical errors but allow partial data
    if (tournamentResult.error && matchResult.error) {
      logger.error('Failed to fetch all data for recent activity', {
        operation: 'getRecentActivity',
        tournamentError: tournamentResult.error.message,
        matchError: matchResult.error.message
      })
      throw new DatabaseError('Failed to fetch activity data')
    }
    
    const tournaments = tournamentResult.data || []
    const matches = matchResult.data || []
    
    const events: ActivityEvent[] = []
    
    // Create tournament lookup for O(1) access
    const tournamentMap = new Map(
      tournaments.map(t => [t.id, t])
    )
    
    // Add tournament events
    tournaments
      .filter(tournament => tournament && typeof tournament.name === 'string')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach(tournament => {
        const event: ActivityEvent = {
          id: `tournament-${tournament.id}`,
          type: tournament.status === 'active' ? 'tournament_started' : 'tournament_created',
          title: tournament.status === 'active' ? 'Tournament Started' : 'Tournament Created',
          description: sanitizeDescription(
            `${sanitizeTournamentName(tournament.name)} ${
              tournament.status === 'active' ? 'has begun' : 'was created'
            }`
          ),
          timestamp: tournament.createdAt,
          relatedId: tournament.id,
          entityType: 'tournament'
        }
        
        events.push(validateActivityEvent(event))
      })
    
    // Add completed match events
    matches
      .filter(match => match && match.status === 'completed' && match.team1 && match.team2)
      .sort((a, b) => new Date(b.endTime || b.updatedAt).getTime() - new Date(a.endTime || a.updatedAt).getTime())
      .slice(0, 10)
      .forEach(match => {
        const tournament = tournamentMap.get(match.tournamentId)
        const winner = match.winner === match.team1.id ? match.team1.players : match.team2.players
        
        const event: ActivityEvent = {
          id: `match-${match.id}`,
          type: 'match_completed',
          title: 'Match Completed',
          description: sanitizeDescription(
            `${winner.map(p => sanitizePlayerName(p.displayName)).join(', ')} won in ${
              tournament ? sanitizeTournamentName(tournament.name) : 'Unknown Tournament'
            }`
          ),
          timestamp: match.endTime || match.updatedAt,
          relatedId: match.id,
          entityType: 'match'
        }
        
        events.push(validateActivityEvent(event))
      })
    
    // Sort all events by timestamp and return top 15
    const sortedEvents = events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15)
      
    timer.end({ eventCount: sortedEvents.length })
    return sortedEvents
  })
}

/**
 * Action wrapper for getRecentActivity
 */
export async function getRecentActivityAction(): Promise<ActionResult<ActivityEvent[]>> {
  const result = await getRecentActivity()
  return resultToActionResult(result, 'Recent activity loaded successfully')
}