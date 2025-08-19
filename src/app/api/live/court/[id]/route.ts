import { NextRequest, NextResponse } from 'next/server'
import { createSSEStream } from '@/lib/api/sse'
import { courtDB } from '@/lib/db/courts'

/**
 * GET /api/live/court/[id]
 * 
 * Server-Sent Events stream for court-specific real-time updates
 * 
 * Events broadcasted:
 * - COURT_UPDATE: Court status changes (available, in-use, maintenance, reserved)
 * - MATCH_START: Match started on this court
 * - MATCH_COMPLETE: Match completed on this court
 * - MATCH_UPDATE: Updates to the current match on this court
 * 
 * Useful for court management dashboards, digital displays showing court status,
 * and scheduling systems that need real-time court availability.
 * 
 * Usage:
 * const eventSource = new EventSource('/api/live/court/court-id-here')
 * eventSource.addEventListener('COURT_UPDATE', (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Court status changed:', data.data.court.status)
 *   updateCourtStatusDisplay(data.data.court)
 * })
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const courtId = params.id
    
    if (!courtId) {
      return NextResponse.json(
        { error: 'Court ID is required' },
        { status: 400 }
      )
    }
    
    // Verify court exists
    const courtResult = await courtDB.findById(courtId)
    if (courtResult.error || !courtResult.data) {
      return NextResponse.json(
        { error: 'Court not found' },
        { status: 404 }
      )
    }
    
    const court = courtResult.data
    
    // Create SSE stream for this court
    const streamId = `court:${courtId}`
    const response = createSSEStream(streamId)
    
    // Log connection
    console.log(`SSE: New court stream connection for court ${courtId} (${court.name})`)
    
    return response
    
  } catch (error) {
    console.error('Error creating court SSE stream:', error)
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