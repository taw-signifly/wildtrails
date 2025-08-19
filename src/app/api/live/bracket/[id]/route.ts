import { NextRequest, NextResponse } from 'next/server'
import { createSSEStream } from '@/lib/api/sse'
import { tournamentDB } from '@/lib/db/tournaments'

/**
 * GET /api/live/bracket/[id]
 * 
 * Server-Sent Events stream for tournament bracket progression updates
 * 
 * Events broadcasted:
 * - BRACKET_UPDATE: Bracket structure changes (matches completed, winners advanced)
 * - MATCH_COMPLETE: Match completions that affect bracket progression
 * - TOURNAMENT_UPDATE: Tournament status changes affecting bracket
 * 
 * This stream is optimized for bracket visualization components that need
 * to update immediately when tournament progression occurs.
 * 
 * Usage:
 * const eventSource = new EventSource('/api/live/bracket/tournament-id-here')
 * eventSource.addEventListener('BRACKET_UPDATE', (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Bracket updated:', data.data.bracket)
 *   updateBracketVisualization(data.data.bracket)
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
    
    // Create SSE stream for this tournament's bracket
    const streamId = `bracket:${tournamentId}`
    const response = createSSEStream(streamId)
    
    // Log connection
    console.log(`SSE: New bracket stream connection for tournament ${tournamentId} (${tournament.name})`)
    
    return response
    
  } catch (error) {
    console.error('Error creating bracket SSE stream:', error)
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