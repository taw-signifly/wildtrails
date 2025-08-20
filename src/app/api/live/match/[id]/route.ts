import { NextRequest, NextResponse } from 'next/server'
import { createSSEStream } from '@/lib/api/sse'
import { matchDB } from '@/lib/db/matches'

/**
 * GET /api/live/match/[id]
 * 
 * Server-Sent Events stream for match-specific real-time updates
 * 
 * Events broadcasted:
 * - MATCH_UPDATE: General match state changes
 * - SCORE_UPDATE: Score changes during live play
 * - END_SCORED: New end completed with points
 * - MATCH_START: Match started
 * - MATCH_COMPLETE: Match finished
 * - MATCH_CANCEL: Match cancelled
 * 
 * Usage:
 * const eventSource = new EventSource('/api/live/match/match-id-here')
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Match update:', data)
 * }
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const matchId = params.id
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      )
    }
    
    // Verify match exists
    const matchResult = await matchDB.findById(matchId)
    if (matchResult.error || !matchResult.data) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }
    
    const match = matchResult.data
    
    // Create SSE stream for this match
    const streamId = `match:${matchId}`
    const response = createSSEStream(streamId)
    
    // Log connection
    console.log(`SSE: New match stream connection for match ${matchId} (${match.team1?.name || 'TBD'} vs ${match.team2?.name || 'TBD'})`)
    
    return response
    
  } catch (error) {
    console.error('Error creating match SSE stream:', error)
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