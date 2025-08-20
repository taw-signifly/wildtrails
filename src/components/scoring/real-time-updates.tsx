'use client'

import { useEffect, useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'

interface RealTimeUpdatesProps {
  tournamentId: string
}

interface ConnectionState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastEventTime: number | null
  reconnectAttempts: number
}

interface TournamentEvent {
  type: 'score_update' | 'end_scored' | 'match_complete' | 'match_start' | 'bracket_update'
  matchId?: string
  data: any
  timestamp: string
}

export function RealTimeUpdates({ tournamentId }: RealTimeUpdatesProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastEventTime: null,
    reconnectAttempts: 0
  })
  
  const [recentEvents, setRecentEvents] = useState<TournamentEvent[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxReconnectAttempts = 5

  // Initialize SSE connection
  const connectToUpdates = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setConnectionState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }))

    try {
      const eventSource = new EventSource(`/api/live/tournament/${tournamentId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('SSE connection established')
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          error: null
        }))
      }

      eventSource.onmessage = (event) => {
        try {
          const eventData: TournamentEvent = JSON.parse(event.data)
          
          setConnectionState(prev => ({
            ...prev,
            lastEventTime: Date.now()
          }))

          // Add to recent events (keep last 10)
          setRecentEvents(prev => [eventData, ...prev.slice(0, 9)])

          // Handle specific event types
          handleTournamentEvent(eventData)
        } catch (error) {
          console.error('Error parsing SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          error: 'Connection lost'
        }))

        eventSource.close()
        attemptReconnect()
      }
    } catch (error) {
      console.error('Error creating SSE connection:', error)
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to connect to live updates'
      }))
      attemptReconnect()
    }
  }

  // Handle incoming tournament events
  const handleTournamentEvent = (event: TournamentEvent) => {
    switch (event.type) {
      case 'score_update':
        console.log('Score updated:', event.data)
        // Trigger page revalidation for score updates
        window.dispatchEvent(new CustomEvent('tournament-score-update', {
          detail: { matchId: event.matchId, score: event.data }
        }))
        break
        
      case 'end_scored':
        console.log('End scored:', event.data)
        window.dispatchEvent(new CustomEvent('tournament-end-scored', {
          detail: { matchId: event.matchId, end: event.data }
        }))
        break
        
      case 'match_complete':
        console.log('Match completed:', event.data)
        window.dispatchEvent(new CustomEvent('tournament-match-complete', {
          detail: { matchId: event.matchId, result: event.data }
        }))
        break
        
      case 'match_start':
        console.log('Match started:', event.data)
        window.dispatchEvent(new CustomEvent('tournament-match-start', {
          detail: { matchId: event.matchId }
        }))
        break
        
      case 'bracket_update':
        console.log('Bracket updated:', event.data)
        window.dispatchEvent(new CustomEvent('tournament-bracket-update', {
          detail: event.data
        }))
        break
        
      default:
        console.log('Unknown event type:', event.type)
    }
  }

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = () => {
    setConnectionState(prev => {
      if (prev.reconnectAttempts >= maxReconnectAttempts) {
        return {
          ...prev,
          error: 'Maximum reconnection attempts reached'
        }
      }

      const delay = Math.pow(2, prev.reconnectAttempts) * 1000 // Exponential backoff
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Attempting to reconnect... (attempt ${prev.reconnectAttempts + 1})`)
        connectToUpdates()
      }, delay)

      return {
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }
    })
  }

  // Manual reconnect
  const handleManualReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }))
    connectToUpdates()
  }

  // Initialize connection on mount
  useEffect(() => {
    connectToUpdates()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [tournamentId])

  // Don't render if connected and no recent events
  if (connectionState.isConnected && recentEvents.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionState.isConnected 
              ? 'bg-green-500' 
              : connectionState.isConnecting 
              ? 'bg-yellow-500 animate-pulse' 
              : 'bg-red-500'
          }`} />
          <span className="text-sm font-medium">
            {connectionState.isConnected 
              ? 'Live Updates Active'
              : connectionState.isConnecting 
              ? 'Connecting...'
              : 'Disconnected'
            }
          </span>
        </div>

        {/* Connection Actions */}
        {connectionState.error && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">{connectionState.error}</span>
            {connectionState.reconnectAttempts < maxReconnectAttempts && (
              <button
                onClick={handleManualReconnect}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Recent Updates</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {recentEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {event.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-blue-800">
                    {getEventDescription(event)}
                  </span>
                </div>
                <span className="text-blue-600">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Info */}
      {connectionState.lastEventTime && (
        <div className="text-xs text-gray-500">
          Last update: {new Date(connectionState.lastEventTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

// Helper function to generate event descriptions
function getEventDescription(event: TournamentEvent): string {
  switch (event.type) {
    case 'score_update':
      return `Score updated: ${event.data.team1 || 0} - ${event.data.team2 || 0}`
    case 'end_scored':
      return `End ${event.data.endNumber}: ${event.data.points} points scored`
    case 'match_complete':
      return `Match completed`
    case 'match_start':
      return `Match started`
    case 'bracket_update':
      return `Tournament bracket updated`
    default:
      return 'Tournament update'
  }
}