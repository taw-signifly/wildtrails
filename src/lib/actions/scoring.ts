'use server'

import { revalidatePath } from 'next/cache'
import { ActionResult } from '@/types/actions'
import { EndInput, EndScoreResult, ScoreValidationResult, TeamStatistics, TournamentStatistics, ScoringConfiguration } from '@/types/scoring'
import { Match, GameFormat } from '@/types'
import { ScoringEngine, createScoringEngine } from '@/lib/scoring/engine'
import { CacheMetrics } from '@/lib/scoring/cache'
import { GeometryUtils } from '@/lib/scoring/geometry'
import { matchDB } from '@/lib/db/matches'

/**
 * Server Actions for Petanque Scoring Engine
 * Integrates scoring engine with Next.js Server Actions pattern
 */

/**
 * Process end scoring for a match
 */
export async function processEndScoringAction(
  matchId: string,
  formData: FormData
): Promise<ActionResult<EndScoreResult>> {
  try {
    // Parse form data into EndInput structure
    const endNumber = parseInt(formData.get('endNumber') as string)
    const jackX = parseFloat(formData.get('jackX') as string)
    const jackY = parseFloat(formData.get('jackY') as string)
    const boulesData = formData.get('boules') as string
    const duration = formData.get('duration') ? parseFloat(formData.get('duration') as string) : undefined
    const notes = formData.get('notes') as string || undefined

    if (isNaN(endNumber) || isNaN(jackX) || isNaN(jackY)) {
      return {
        success: false,
        error: 'Invalid end number or jack position coordinates'
      }
    }

    let boules
    try {
      boules = JSON.parse(boulesData)
    } catch {
      return {
        success: false,
        error: 'Invalid boules data format'
      }
    }

    const endInput: EndInput = {
      endNumber,
      jackPosition: { x: jackX, y: jackY },
      boules,
      duration,
      notes
    }

    // Create scoring engine and process end
    const engine = new ScoringEngine()
    const result = await engine.processEndScoring(matchId, endInput)

    if (!result.success) {
      return result
    }

    // Update match in database
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }

    // Add end to match and update score
    // Calculate distances for boules that don't have them
    const boulesWithDistance = endInput.boules.map(boule => ({
      ...boule,
      distance: GeometryUtils.calculateDistance(boule.position, endInput.jackPosition)
    }))

    const newEnd = {
      id: `${matchId}-end-${endInput.endNumber}`,
      endNumber: endInput.endNumber,
      winner: result.data.winner,
      points: result.data.points,
      boules: boulesWithDistance,
      jackPosition: endInput.jackPosition,
      duration: endInput.duration,
      completed: true,
      createdAt: new Date().toISOString()
    }

    const updatedMatch = {
      ...matchResult.data,
      ends: [
        ...matchResult.data.ends,
        newEnd
      ]
    }

    // Update match score  
    if (result.data.winner === matchResult.data.team1?.id) {
      updatedMatch.score!.team1 += result.data.points
    } else {
      updatedMatch.score!.team2 += result.data.points
    }

    // Check if game is complete
    if (updatedMatch.score!.team1 >= 13 || updatedMatch.score!.team2 >= 13) {
      updatedMatch.score!.isComplete = true
      updatedMatch.status = 'completed'
      updatedMatch.endTime = new Date().toISOString()
      updatedMatch.winner = updatedMatch.score!.team1 >= 13 ? matchResult.data.team1?.id! : matchResult.data.team2?.id!
    }

    // Save updated match
    const updateResult = await matchDB.update(matchId, updatedMatch)
    if (updateResult.error || !updateResult.data) {
      return {
        success: false,
        error: 'Failed to update match'
      }
    }

    // Revalidate related paths
    revalidatePath(`/matches/${matchId}`)
    revalidatePath(`/tournaments/${matchResult.data.tournamentId}`)

    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process end scoring'
    }
  }
}

/**
 * Process end scoring with typed data (programmatic interface)
 */
export async function processEndScoringDataAction(
  matchId: string,
  endInput: EndInput
): Promise<ActionResult<EndScoreResult>> {
  try {
    const engine = new ScoringEngine()
    return await engine.processEndScoring(matchId, endInput)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process end scoring'
    }
  }
}

/**
 * Validate match score
 */
export async function validateMatchScoreAction(
  matchId: string
): Promise<ActionResult<ScoreValidationResult>> {
  try {
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return {
        success: false,
        error: 'Match not found'
      }
    }

    const engine = new ScoringEngine()
    return engine.validateMatchScore(matchResult.data)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate match score'
    }
  }
}

/**
 * Calculate team statistics
 */
export async function calculateTeamStatisticsAction(
  teamId: string,
  tournamentId?: string
): Promise<ActionResult<TeamStatistics>> {
  try {
    // Get matches for the team
    const matchesResult = await matchDB.findAll()
    if (matchesResult.error || !matchesResult.data) {
      return {
        success: false,
        error: 'Failed to retrieve matches'
      }
    }

    // Filter matches for the team
    let teamMatches = matchesResult.data.filter(match => 
      match.team1?.id === teamId || match.team2?.id === teamId
    )

    // Filter by tournament if specified
    if (tournamentId) {
      teamMatches = teamMatches.filter(match => match.tournamentId === tournamentId)
    }

    const engine = new ScoringEngine()
    return engine.calculateTeamStatistics(teamId, teamMatches)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate team statistics'
    }
  }
}

/**
 * Calculate tournament statistics
 */
export async function calculateTournamentStatisticsAction(
  tournamentId: string
): Promise<ActionResult<TournamentStatistics>> {
  try {
    // Get matches for the tournament
    const matchesResult = await matchDB.findAll()
    if (matchesResult.error || !matchesResult.data) {
      return {
        success: false,
        error: 'Failed to retrieve matches'
      }
    }

    const tournamentMatches = matchesResult.data.filter(match => 
      match.tournamentId === tournamentId
    )

    const engine = new ScoringEngine()
    const result = engine.calculateTournamentStatistics(tournamentId, tournamentMatches)

    return {
      success: true,
      data: result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate tournament statistics'
    }
  }
}

/**
 * Calculate end score (for testing/validation purposes)
 */
export async function calculateEndScoreAction(
  formData: FormData
): Promise<ActionResult<EndScoreResult>> {
  try {
    const jackX = parseFloat(formData.get('jackX') as string)
    const jackY = parseFloat(formData.get('jackY') as string)
    const boulesData = formData.get('boules') as string
    const teamIdsData = formData.get('teamIds') as string

    if (isNaN(jackX) || isNaN(jackY)) {
      return {
        success: false,
        error: 'Invalid jack position coordinates'
      }
    }

    let boules, teamIds
    try {
      boules = JSON.parse(boulesData)
      teamIds = JSON.parse(teamIdsData)
    } catch {
      return {
        success: false,
        error: 'Invalid boules or team IDs data format'
      }
    }

    const engine = new ScoringEngine()
    return engine.calculateEndScore(boules, { x: jackX, y: jackY }, teamIds)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate end score'
    }
  }
}

/**
 * Get scoring engine performance metrics
 */
export async function getScoringEngineMetricsAction(): Promise<ActionResult<{
  cacheMetrics: Record<string, CacheMetrics>
  totalMemoryUsage: number
  cacheNames: string[]
  overallHitRate: number
}>> {
  try {
    const engine = new ScoringEngine()
    const metrics = engine.getPerformanceMetrics()

    return {
      success: true,
      data: metrics
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scoring engine metrics'
    }
  }
}

/**
 * Clear scoring engine caches
 */
export async function clearScoringCachesAction(): Promise<ActionResult<{ success: boolean }>> {
  try {
    const engine = new ScoringEngine()
    engine.clearCaches()

    return {
      success: true,
      data: { success: true }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear scoring caches'
    }
  }
}

/**
 * Create scoring engine for specific game format
 */
export async function createScoringEngineAction(
  format: GameFormat
): Promise<ActionResult<{ engineId: string; config: ScoringConfiguration }>> {
  try {
    const engine = createScoringEngine(format)
    const state = engine.getState()

    return {
      success: true,
      data: {
        engineId: `engine-${format}-${Date.now()}`,
        config: state.config
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scoring engine'
    }
  }
}

/**
 * Warmup scoring engine caches with common calculations
 */
export async function warmupScoringEngineAction(
  positions: Array<{ x: number; y: number }>
): Promise<ActionResult<{ calculationsPerformed: number; duration: number }>> {
  try {
    const { GeometryUtils } = await import('@/lib/scoring/geometry')
    
    const start = Date.now()
    GeometryUtils.warmupGeometryCache(positions)
    const duration = Date.now() - start

    const calculationsPerformed = (positions.length * (positions.length - 1)) / 2

    return {
      success: true,
      data: {
        calculationsPerformed,
        duration
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to warmup scoring engine'
    }
  }
}