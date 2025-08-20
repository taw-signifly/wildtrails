'use server'

import { TournamentDB } from '@/lib/db/tournaments'
import { PlayerDB } from '@/lib/db/players'
import { MatchDB } from '@/lib/db/matches'
import { Tournament } from '@/types'

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

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  
  if (diffInHours === 0) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else {
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
  }
}