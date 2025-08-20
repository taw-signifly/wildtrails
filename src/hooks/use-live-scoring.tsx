'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Match } from '@/types'
import { getMatchById } from '@/lib/actions/matches'

interface LiveScoringState {
  currentMatch: Match | null
  isConnected: boolean
  connectionError: string | null
  isLoading: boolean
  lastUpdate: number | null
}

interface UseLiveScoringReturn extends LiveScoringState {
  subscribeToMatch: (matchId: string) => void
  unsubscribeFromMatch: (matchId: string) => void
  refreshMatch: () => Promise<void>
}

export function useLiveScoring(tournamentId: string): UseLiveScoringReturn {
  const [state, setState] = useState<LiveScoringState>({
    currentMatch: null,
    isConnected: false,
    connectionError: null,
    isLoading: false,
    lastUpdate: null
  })

  const activeMatchId = useRef<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Initialize SSE connection for tournament
  const connectToTournament = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState(prev => ({ ...prev, connectionError: null }))

    try {
      const eventSource = new EventSource(`/api/live/tournament/${tournamentId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, connectionError: null }))
      }

      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data)
          handleLiveEvent(eventData)
          setState(prev => ({ ...prev, lastUpdate: Date.now() }))
        } catch (error) {
          console.error('Error parsing live event:', error)
        }
      }

      eventSource.onerror = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          connectionError: 'Connection lost' 
        }))
        eventSource.close()
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (activeMatchId.current) {
            connectToTournament()
          }
        }, 3000)
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        connectionError: 'Failed to connect' 
      }))
    }
  }, [tournamentId])

  // Handle live events from SSE
  const handleLiveEvent = useCallback((eventData: any) => {
    if (!activeMatchId.current) return

    // Only handle events for the currently subscribed match
    if (eventData.matchId === activeMatchId.current) {
      switch (eventData.type) {
        case 'score_update':
        case 'end_scored':
        case 'match_complete':
        case 'match_start':
          // Refresh match data when relevant events occur
          refreshMatch()
          break
        default:
          break
      }
    }
  }, [])

  // Refresh current match data
  const refreshMatch = useCallback(async () => {
    if (!activeMatchId.current) return

    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const result = await getMatchById(activeMatchId.current)
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          currentMatch: result.data,
          isLoading: false 
        }))
      } else {
        console.error('Failed to refresh match:', result.error)
        setState(prev => ({ 
          ...prev, 
          connectionError: 'Failed to refresh match data',
          isLoading: false 
        }))
      }
    } catch (error) {
      console.error('Error refreshing match:', error)
      setState(prev => ({ 
        ...prev, 
        connectionError: 'Error refreshing match data',
        isLoading: false 
      }))
    }
  }, [])

  // Subscribe to a specific match
  const subscribeToMatch = useCallback(async (matchId: string) => {
    activeMatchId.current = matchId
    
    // Connect to tournament SSE if not already connected
    if (!state.isConnected && !eventSourceRef.current) {
      connectToTournament()
    }

    // Load initial match data
    await refreshMatch()
  }, [state.isConnected, connectToTournament, refreshMatch])

  // Unsubscribe from current match
  const unsubscribeFromMatch = useCallback((matchId: string) => {
    if (activeMatchId.current === matchId) {
      activeMatchId.current = null
      setState(prev => ({ ...prev, currentMatch: null }))
    }
  }, [])

  // Set up real-time event listeners for custom events
  useEffect(() => {
    const handleScoreUpdate = (event: CustomEvent) => {
      if (activeMatchId.current === event.detail.matchId) {
        refreshMatch()
      }
    }

    const handleEndScored = (event: CustomEvent) => {
      if (activeMatchId.current === event.detail.matchId) {
        refreshMatch()
      }
    }

    const handleMatchComplete = (event: CustomEvent) => {
      if (activeMatchId.current === event.detail.matchId) {
        refreshMatch()
      }
    }

    const handleMatchStart = (event: CustomEvent) => {
      if (activeMatchId.current === event.detail.matchId) {
        refreshMatch()
      }
    }

    // Add event listeners
    window.addEventListener('tournament-score-update', handleScoreUpdate as EventListener)
    window.addEventListener('tournament-end-scored', handleEndScored as EventListener)
    window.addEventListener('tournament-match-complete', handleMatchComplete as EventListener)
    window.addEventListener('tournament-match-start', handleMatchStart as EventListener)

    // Cleanup
    return () => {
      window.removeEventListener('tournament-score-update', handleScoreUpdate as EventListener)
      window.removeEventListener('tournament-end-scored', handleEndScored as EventListener)
      window.removeEventListener('tournament-match-complete', handleMatchComplete as EventListener)
      window.removeEventListener('tournament-match-start', handleMatchStart as EventListener)
    }
  }, [refreshMatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      activeMatchId.current = null
    }
  }, [])

  return {
    ...state,
    subscribeToMatch,
    unsubscribeFromMatch,
    refreshMatch
  }
}