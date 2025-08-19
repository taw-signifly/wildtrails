/**
 * Server-Sent Events utilities for real-time updates
 */

import { Match, Tournament, Court, Score, End } from '@/types'
import { BracketNode } from '@/lib/actions/bracket-management'

/**
 * SSE Event types for real-time updates
 */
export type SSEEventType = 
  | 'MATCH_UPDATE'
  | 'SCORE_UPDATE' 
  | 'END_SCORED'
  | 'MATCH_START'
  | 'MATCH_COMPLETE'
  | 'MATCH_CANCEL'
  | 'BRACKET_UPDATE'
  | 'TOURNAMENT_UPDATE'
  | 'COURT_UPDATE'
  | 'CONNECTION_ESTABLISHED'
  | 'KEEPALIVE'

/**
 * Base SSE event structure
 */
export interface SSEEvent {
  id: string
  type: SSEEventType
  timestamp: string
  data: any
}

/**
 * Match-specific event data interfaces
 */
export interface MatchUpdateEvent extends SSEEvent {
  type: 'MATCH_UPDATE'
  data: {
    matchId: string
    match: Match
    changes: string[]
  }
}

export interface ScoreUpdateEvent extends SSEEvent {
  type: 'SCORE_UPDATE'
  data: {
    matchId: string
    score: Score
    previousScore?: Score
  }
}

export interface EndScoredEvent extends SSEEvent {
  type: 'END_SCORED'
  data: {
    matchId: string
    end: End
    newScore: Score
  }
}

export interface MatchStartEvent extends SSEEvent {
  type: 'MATCH_START'
  data: {
    matchId: string
    match: Match
    courtId?: string
  }
}

export interface MatchCompleteEvent extends SSEEvent {
  type: 'MATCH_COMPLETE'
  data: {
    matchId: string
    match: Match
    winner: string
    finalScore: Score
    duration?: number
  }
}

export interface BracketUpdateEvent extends SSEEvent {
  type: 'BRACKET_UPDATE'
  data: {
    tournamentId: string
    matchId: string
    bracket: BracketNode[]
    affectedMatches: string[]
  }
}

export interface TournamentUpdateEvent extends SSEEvent {
  type: 'TOURNAMENT_UPDATE'
  data: {
    tournamentId: string
    tournament: Tournament
    changes: string[]
  }
}

export interface CourtUpdateEvent extends SSEEvent {
  type: 'COURT_UPDATE'
  data: {
    courtId: string
    court: Court
    changes: string[]
  }
}

/**
 * Connection management for SSE streams
 */
class SSEConnectionManager {
  private connections: Map<string, Map<string, ReadableStreamDefaultController>> = new Map()
  private eventHistory: Map<string, SSEEvent[]> = new Map()
  private readonly MAX_HISTORY_SIZE = 100

  /**
   * Add a client connection to a stream
   */
  addConnection(streamId: string, connectionId: string, controller: ReadableStreamDefaultController): void {
    if (!this.connections.has(streamId)) {
      this.connections.set(streamId, new Map())
    }
    
    const streamConnections = this.connections.get(streamId)!
    streamConnections.set(connectionId, controller)
    
    console.log(`SSE: Client ${connectionId} connected to stream ${streamId}. Total connections: ${streamConnections.size}`)
    
    // Send connection established event
    this.sendToConnection(controller, {
      id: `conn-${Date.now()}`,
      type: 'CONNECTION_ESTABLISHED',
      timestamp: new Date().toISOString(),
      data: {
        streamId,
        connectionId,
        historySize: this.getEventHistory(streamId).length
      }
    })
    
    // Send recent event history
    this.sendHistoryToConnection(streamId, controller)
  }

  /**
   * Remove a client connection from a stream
   */
  removeConnection(streamId: string, connectionId: string): void {
    const streamConnections = this.connections.get(streamId)
    if (streamConnections) {
      streamConnections.delete(connectionId)
      console.log(`SSE: Client ${connectionId} disconnected from stream ${streamId}. Remaining connections: ${streamConnections.size}`)
      
      // Clean up empty streams
      if (streamConnections.size === 0) {
        this.connections.delete(streamId)
        console.log(`SSE: Stream ${streamId} cleaned up (no active connections)`)
      }
    }
  }

  /**
   * Broadcast event to all connections in a stream
   */
  broadcast(streamId: string, event: SSEEvent): void {
    const streamConnections = this.connections.get(streamId)
    if (!streamConnections || streamConnections.size === 0) {
      console.log(`SSE: No active connections for stream ${streamId}, event queued`)
      this.addToHistory(streamId, event)
      return
    }

    console.log(`SSE: Broadcasting event ${event.type} to ${streamConnections.size} connections in stream ${streamId}`)
    
    const deadConnections: string[] = []
    
    for (const [connectionId, controller] of streamConnections) {
      try {
        this.sendToConnection(controller, event)
      } catch (error) {
        console.error(`SSE: Failed to send to connection ${connectionId}:`, error)
        deadConnections.push(connectionId)
      }
    }
    
    // Clean up dead connections
    deadConnections.forEach(connectionId => {
      this.removeConnection(streamId, connectionId)
    })
    
    // Add to history
    this.addToHistory(streamId, event)
  }

  /**
   * Send keepalive to all connections
   */
  sendKeepalive(): void {
    const keepaliveEvent: SSEEvent = {
      id: `keepalive-${Date.now()}`,
      type: 'KEEPALIVE',
      timestamp: new Date().toISOString(),
      data: { timestamp: Date.now() }
    }

    for (const [streamId, streamConnections] of this.connections) {
      for (const [connectionId, controller] of streamConnections) {
        try {
          this.sendToConnection(controller, keepaliveEvent)
        } catch (error) {
          console.error(`SSE: Keepalive failed for connection ${connectionId}:`, error)
          this.removeConnection(streamId, connectionId)
        }
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number
    streamCount: number
    streams: Record<string, number>
  } {
    const streams: Record<string, number> = {}
    let totalConnections = 0
    
    for (const [streamId, streamConnections] of this.connections) {
      const count = streamConnections.size
      streams[streamId] = count
      totalConnections += count
    }
    
    return {
      totalConnections,
      streamCount: this.connections.size,
      streams
    }
  }

  private sendToConnection(controller: ReadableStreamDefaultController, event: SSEEvent): void {
    const sseData = this.formatSSEMessage(event)
    controller.enqueue(new TextEncoder().encode(sseData))
  }

  private formatSSEMessage(event: SSEEvent): string {
    const data = JSON.stringify(event)
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${data}\n\n`
  }

  private addToHistory(streamId: string, event: SSEEvent): void {
    if (!this.eventHistory.has(streamId)) {
      this.eventHistory.set(streamId, [])
    }
    
    const history = this.eventHistory.get(streamId)!
    history.push(event)
    
    // Keep only recent events
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE)
    }
  }

  private getEventHistory(streamId: string): SSEEvent[] {
    return this.eventHistory.get(streamId) || []
  }

  private sendHistoryToConnection(streamId: string, controller: ReadableStreamDefaultController): void {
    const history = this.getEventHistory(streamId)
    history.forEach(event => {
      try {
        this.sendToConnection(controller, event)
      } catch (error) {
        console.error('SSE: Failed to send history event:', error)
      }
    })
  }
}

// Global connection manager instance
const connectionManager = new SSEConnectionManager()

// Setup keepalive interval (every 30 seconds)
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    connectionManager.sendKeepalive()
  }, 30000)
}

/**
 * Create an SSE stream response
 */
export function createSSEStream(streamId: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      connectionManager.addConnection(streamId, connectionId, controller)
      
      // Store connection ID for cleanup
      ;(controller as any)._connectionId = connectionId
      ;(controller as any)._streamId = streamId
    },
    cancel() {
      const connectionId = (this as any)._connectionId
      const streamId = (this as any)._streamId
      if (connectionId && streamId) {
        connectionManager.removeConnection(streamId, connectionId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

/**
 * Broadcast an event to a specific stream
 */
export function broadcastEvent(streamId: string, event: Omit<SSEEvent, 'id' | 'timestamp'>): void {
  const fullEvent: SSEEvent = {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...event
  }
  
  connectionManager.broadcast(streamId, fullEvent)
}

/**
 * Broadcast match update
 */
export function broadcastMatchUpdate(matchId: string, match: Match, changes: string[] = []): void {
  const event: Omit<MatchUpdateEvent, 'id' | 'timestamp'> = {
    type: 'MATCH_UPDATE',
    data: {
      matchId,
      match,
      changes
    }
  }
  
  // Broadcast to match-specific stream
  broadcastEvent(`match:${matchId}`, event)
  
  // Broadcast to tournament-wide stream
  broadcastEvent(`tournament:${match.tournamentId}`, event)
}

/**
 * Broadcast score update
 */
export function broadcastScoreUpdate(matchId: string, score: Score, previousScore?: Score): void {
  const event: Omit<ScoreUpdateEvent, 'id' | 'timestamp'> = {
    type: 'SCORE_UPDATE',
    data: {
      matchId,
      score,
      previousScore
    }
  }
  
  broadcastEvent(`match:${matchId}`, event)
  
  // Also broadcast to tournament stream
  // Note: We need the tournament ID, so we'll get it from the match
  // For now, just broadcast to match stream
}

/**
 * Broadcast end scored
 */
export function broadcastEndScored(matchId: string, end: End, newScore: Score): void {
  const event: Omit<EndScoredEvent, 'id' | 'timestamp'> = {
    type: 'END_SCORED',
    data: {
      matchId,
      end,
      newScore
    }
  }
  
  broadcastEvent(`match:${matchId}`, event)
}

/**
 * Broadcast match start
 */
export function broadcastMatchStart(matchId: string, match: Match, courtId?: string): void {
  const event: Omit<MatchStartEvent, 'id' | 'timestamp'> = {
    type: 'MATCH_START',
    data: {
      matchId,
      match,
      courtId
    }
  }
  
  broadcastEvent(`match:${matchId}`, event)
  broadcastEvent(`tournament:${match.tournamentId}`, event)
  
  if (courtId) {
    broadcastEvent(`court:${courtId}`, event)
  }
}

/**
 * Broadcast match completion
 */
export function broadcastMatchComplete(matchId: string, match: Match): void {
  const event: Omit<MatchCompleteEvent, 'id' | 'timestamp'> = {
    type: 'MATCH_COMPLETE',
    data: {
      matchId,
      match,
      winner: match.winner!,
      finalScore: match.score,
      duration: match.duration
    }
  }
  
  broadcastEvent(`match:${matchId}`, event)
  broadcastEvent(`tournament:${match.tournamentId}`, event)
  
  if (match.courtId) {
    broadcastEvent(`court:${match.courtId}`, event)
  }
}

/**
 * Broadcast bracket update
 */
export function broadcastBracketUpdate(
  tournamentId: string,
  matchId: string,
  bracket: BracketNode[],
  affectedMatches: string[]
): void {
  const event: Omit<BracketUpdateEvent, 'id' | 'timestamp'> = {
    type: 'BRACKET_UPDATE',
    data: {
      tournamentId,
      matchId,
      bracket,
      affectedMatches
    }
  }
  
  broadcastEvent(`tournament:${tournamentId}`, event)
  broadcastEvent(`bracket:${tournamentId}`, event)
}

/**
 * Broadcast tournament update
 */
export function broadcastTournamentUpdate(tournamentId: string, tournament: Tournament, changes: string[]): void {
  const event: Omit<TournamentUpdateEvent, 'id' | 'timestamp'> = {
    type: 'TOURNAMENT_UPDATE',
    data: {
      tournamentId,
      tournament,
      changes
    }
  }
  
  broadcastEvent(`tournament:${tournamentId}`, event)
}

/**
 * Broadcast court update
 */
export function broadcastCourtUpdate(courtId: string, court: Court, changes: string[]): void {
  const event: Omit<CourtUpdateEvent, 'id' | 'timestamp'> = {
    type: 'COURT_UPDATE',
    data: {
      courtId,
      court,
      changes
    }
  }
  
  broadcastEvent(`court:${courtId}`, event)
}

/**
 * Get SSE connection statistics
 */
export function getSSEStats() {
  return connectionManager.getStats()
}