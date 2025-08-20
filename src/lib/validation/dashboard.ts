import { z } from 'zod'

/**
 * Dashboard data validation schemas
 */

export const DashboardStatsSchema = z.object({
  activeTournaments: z.number().min(0),
  registeredPlayers: z.number().min(0),
  liveMatches: z.number().min(0),
  totalMatches: z.number().min(0)
})

export const RecentTournamentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(['setup', 'registration', 'active', 'completed', 'cancelled']),
  participants: z.number().min(0),
  date: z.string()
})

export const ActiveMatchSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  tournamentName: z.string().min(1).max(200),
  team1: z.array(z.string().min(1)).min(1), // At least one player
  team2: z.array(z.string().min(1)).min(1), // At least one player
  currentScore: z.tuple([z.number().min(0), z.number().min(0)]),
  court: z.string().optional(),
  status: z.enum(['active', 'paused']),
  startedAt: z.string().optional(),
  duration: z.number().min(0).optional()
})

export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['match_completed', 'tournament_started', 'player_registered', 'match_started', 'tournament_created']),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  timestamp: z.string(),
  relatedId: z.string().uuid(),
  entityType: z.enum(['tournament', 'match', 'player'])
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>
export type RecentTournament = z.infer<typeof RecentTournamentSchema>
export type ActiveMatch = z.infer<typeof ActiveMatchSchema>
export type ActivityEvent = z.infer<typeof ActivityEventSchema>

/**
 * Input sanitization helpers for dashboard data
 */
export function sanitizeTournamentName(name: string): string {
  // Remove HTML tags (including script tags), decode entities, and limit length
  return name
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all other HTML tags
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .trim()
    .slice(0, 200)
}

export function sanitizePlayerName(name: string): string {
  // Remove HTML tags (including script tags), decode entities, and limit length
  return name
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all other HTML tags
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .trim()
    .slice(0, 100)
}

export function sanitizeDescription(description: string): string {
  // Remove HTML tags (including script tags), decode entities, and limit length
  return description
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all other HTML tags
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .trim()
    .slice(0, 500)
}

/**
 * Data validation helpers
 */
export function validateDashboardStats(data: unknown): DashboardStats {
  return DashboardStatsSchema.parse(data)
}

export function validateRecentTournament(data: unknown): RecentTournament {
  return RecentTournamentSchema.parse(data)
}

export function validateActiveMatch(data: unknown): ActiveMatch {
  return ActiveMatchSchema.parse(data)
}

export function validateActivityEvent(data: unknown): ActivityEvent {
  return ActivityEventSchema.parse(data)
}