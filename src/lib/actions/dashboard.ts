'use server'

import { TournamentDB } from '@/lib/db/tournaments'
import { PlayerDB } from '@/lib/db/players'
import { MatchDB } from '@/lib/db/matches'
import { Tournament } from '@/types'
import { formatRelativeDate } from '@/lib/utils/date'

export interface DashboardStats {
  activeTournaments: number
  registeredPlayers: number
  liveMatches: number
  totalMatches: number
}

export interface RecentTournament {
  id: string
  name: string
  status: Tournament['status']
  participants: number
  date: string
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [tournamentResult, playerResult, matchResult] = await Promise.all([
      new TournamentDB().findAll(),
      new PlayerDB().findAll(),
      new MatchDB().findAll()
    ])

    // Handle Results - extract data or use empty arrays on error
    const tournaments = tournamentResult.data || []
    const players = playerResult.data || []
    const matches = matchResult.data || []

    const activeTournaments = tournaments.filter(t => 
      t.status === 'active' || t.status === 'setup'
    ).length

    const liveMatches = matches.filter(m => m.status === 'active').length

    return {
      activeTournaments,
      registeredPlayers: players.length,
      liveMatches,
      totalMatches: matches.length
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    // Return fallback data on error
    return {
      activeTournaments: 0,
      registeredPlayers: 0,
      liveMatches: 0,
      totalMatches: 0
    }
  }
}

export async function getRecentTournaments(): Promise<RecentTournament[]> {
  try {
    const tournamentResult = await new TournamentDB().findAll()
    const tournaments = tournamentResult.data || []
    
    // Sort by creation date (most recent first) and take top 3
    const recentTournaments = tournaments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map(tournament => ({
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        participants: tournament.maxPlayers || 0,
        date: formatRelativeDate(tournament.createdAt)
      }))

    return recentTournaments
  } catch (error) {
    console.error('Failed to fetch recent tournaments:', error)
    // Return empty array on error
    return []
  }
}

export interface ActiveMatch {
  id: string
  tournamentId: string
  tournamentName: string
  team1: string[]
  team2: string[]
  currentScore: [number, number]
  court?: string
  status: 'active' | 'paused'
  startedAt?: string
  duration?: number
}

export interface ActivityEvent {
  id: string
  type: 'match_completed' | 'tournament_started' | 'player_registered' | 'match_started' | 'tournament_created'
  title: string
  description: string
  timestamp: string
  relatedId: string
  entityType: 'tournament' | 'match' | 'player'
}

export async function getActiveMatches(): Promise<ActiveMatch[]> {
  try {
    const matchResult = await new MatchDB().findByStatus('active')
    const matches = matchResult.data || []
    const tournamentResult = await new TournamentDB().findAll()
    const tournaments = tournamentResult.data || []
    
    return matches.map(match => {
      const tournament = tournaments.find(t => t.id === match.tournamentId)
      return {
        id: match.id,
        tournamentId: match.tournamentId,
        tournamentName: tournament?.name || 'Unknown Tournament',
        team1: match.team1.players.map(p => p.displayName),
        team2: match.team2.players.map(p => p.displayName),
        currentScore: [match.score?.team1 || 0, match.score?.team2 || 0] as [number, number],
        court: match.courtId,
        status: match.status === 'active' ? 'active' : 'paused',
        startedAt: match.startTime,
        duration: match.startTime ? Math.floor((new Date().getTime() - new Date(match.startTime).getTime()) / (1000 * 60)) : undefined
      }
    })
  } catch (error) {
    console.error('Failed to fetch active matches:', error)
    return []
  }
}

export async function getRecentActivity(): Promise<ActivityEvent[]> {
  try {
    const [tournamentResult, matchResult] = await Promise.all([
      new TournamentDB().findAll(),
      new MatchDB().findAll()
    ])
    
    const tournaments = tournamentResult.data || []
    const matches = matchResult.data || []
    
    const events: ActivityEvent[] = []
    
    // Add tournament events
    tournaments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach(tournament => {
        events.push({
          id: `tournament-${tournament.id}`,
          type: tournament.status === 'active' ? 'tournament_started' : 'tournament_created',
          title: tournament.status === 'active' ? 'Tournament Started' : 'Tournament Created',
          description: `${tournament.name} ${tournament.status === 'active' ? 'has begun' : 'was created'}`,
          timestamp: tournament.createdAt,
          relatedId: tournament.id,
          entityType: 'tournament'
        })
      })
    
    // Add completed match events
    matches
      .filter(match => match.status === 'completed')
      .sort((a, b) => new Date(b.endTime || b.updatedAt).getTime() - new Date(a.endTime || a.updatedAt).getTime())
      .slice(0, 10)
      .forEach(match => {
        const tournament = tournaments.find(t => t.id === match.tournamentId)
        const winner = match.winner === match.team1.id ? match.team1.players : match.team2.players
        
        events.push({
          id: `match-${match.id}`,
          type: 'match_completed',
          title: 'Match Completed',
          description: `${winner.map(p => p.displayName).join(', ')} won in ${tournament?.name || 'Unknown Tournament'}`,
          timestamp: match.endTime || match.updatedAt,
          relatedId: match.id,
          entityType: 'match'
        })
      })
    
    // Sort all events by timestamp and return top 15
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15)
      
  } catch (error) {
    console.error('Failed to fetch recent activity:', error)
    return []
  }
}

