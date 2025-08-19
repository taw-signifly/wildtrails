import { NextRequest, NextResponse } from 'next/server'
import { createSSEStream } from '@/lib/api/sse'
import { tournamentDB } from '@/lib/db/tournaments'

/**
 * GET /api/live/tournament/[id]
 * 
 * Server-Sent Events stream for tournament-wide real-time updates
 * 
 * Events broadcasted:
 * - TOURNAMENT_UPDATE: Tournament status/settings changes
 * - MATCH_UPDATE: Any match in the tournament updates
 * - MATCH_START: Matches starting in the tournament
 * - MATCH_COMPLETE: Matches completing in the tournament
 * - BRACKET_UPDATE: Tournament bracket progression updates
 * 
 * Usage:
 * const eventSource = new EventSource('/api/live/tournament/tournament-id-here')
 * eventSource.addEventListener('MATCH_COMPLETE', (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Match completed:', data.data.match)
 * })
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const tournamentId = params.id
    
    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }
    
    // Verify tournament exists
    const tournamentResult = await tournamentDB.findById(tournamentId)
    if (tournamentResult.error || !tournamentResult.data) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }
    
    const tournament = tournamentResult.data
    
    // Create SSE stream for this tournament
    const streamId = `tournament:${tournamentId}`
    const response = createSSEStream(streamId)
    
    // Log connection
    console.log(`SSE: New tournament stream connection for tournament ${tournamentId} (${tournament.name})`)
    
    return response
    
  } catch (error) {
    console.error('Error creating tournament SSE stream:', error)
    return NextResponse.json(
      { error: 'Failed to create event stream' },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    },
  })
}