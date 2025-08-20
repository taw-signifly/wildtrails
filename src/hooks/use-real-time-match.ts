import { useEffect, useState, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@/lib/db/supabase'
import { Match } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RealTimeMatchState {
  match: Match | null
  isConnected: boolean
  isLoading: boolean
  error: string | null
  lastUpdate: string | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export interface RealTimeMatchActions {
  connect: () => void
  disconnect: () => void
  broadcastScoreUpdate: (score: any) => void
  broadcastMatchEvent: (eventType: string, data: any) => void
}

export type UseRealTimeMatchReturn = RealTimeMatchState & RealTimeMatchActions

/**
 * Hook for real-time match subscriptions and interactions
 * Provides live score updates, match status changes, and broadcast capabilities
 */
export function useRealTimeMatch(
  matchId: string | null,
  options: {
    autoConnect?: boolean
    enableBroadcast?: boolean
    onScoreUpdate?: (score: any) => void
    onStatusChange?: (status: Match['status']) => void
    onMatchEvent?: (eventType: string, data: any) => void
  } = {}
): UseRealTimeMatchReturn {
  const {
    autoConnect = true,
    enableBroadcast = true,
    onScoreUpdate,
    onStatusChange,
    onMatchEvent
  } = options

  const [state, setState] = useState<RealTimeMatchState>({
    match: null,
    isConnected: false,
    isLoading: false,
    error: null,
    lastUpdate: null,
    connectionStatus: 'disconnected'
  })

  const supabase = createClientComponentClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const matchRef = useRef<Match | null>(null)

  // Update match ref when state changes
  useEffect(() => {
    matchRef.current = state.match
  }, [state.match])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ 
      ...prev, 
      error,
      connectionStatus: error ? 'error' : prev.connectionStatus
    }))
  }, [])

  const setConnectionStatus = useCallback((status: RealTimeMatchState['connectionStatus']) => {
    setState(prev => ({ 
      ...prev, 
      connectionStatus: status,
      isConnected: status === 'connected'
    }))
  }, [])

  // Load initial match data
  const loadMatch = useCallback(async () => {
    if (!matchId) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          team1:teams!team1_id(id, name),
          team2:teams!team2_id(id, name),
          court:courts!court_id(id, name, status)
        `)
        .eq('id', matchId)
        .single()

      if (error) throw error

      setState(prev => ({
        ...prev,
        match: data,
        isLoading: false,
        lastUpdate: new Date().toISOString()
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load match'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [matchId, supabase, setError])

  // Connect to real-time updates
  const connect = useCallback(() => {
    if (!matchId || channelRef.current) return

    setConnectionStatus('connecting')
    setError(null)

    const channel = supabase
      .channel(`match_${matchId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload

          switch (eventType) {
            case 'UPDATE':
              if (newRecord) {
                const updatedMatch = newRecord as Match
                const previousMatch = matchRef.current

                setState(prev => ({
                  ...prev,
                  match: updatedMatch,
                  lastUpdate: new Date().toISOString()
                }))

                // Call event handlers
                if (previousMatch && newRecord.score !== oldRecord?.score) {
                  onScoreUpdate?.(updatedMatch.score)
                }

                if (previousMatch && newRecord.status !== oldRecord?.status) {
                  onStatusChange?.(updatedMatch.status)
                }
              }
              break

            case 'DELETE':
              setState(prev => ({
                ...prev,
                match: null,
                lastUpdate: new Date().toISOString()
              }))
              break
          }
        }
      )

    // Subscribe to match-specific broadcast events
    if (enableBroadcast) {
      channel.on('broadcast',
        { event: 'live_score' },
        (payload) => {
          const { score, timestamp } = payload.payload
          onScoreUpdate?.(score)
          
          setState(prev => ({
            ...prev,
            lastUpdate: timestamp
          }))
        }
      )

      channel.on('broadcast',
        { event: 'match_event' },
        (payload) => {
          const { eventType, data, timestamp } = payload.payload
          onMatchEvent?.(eventType, data)
          
          setState(prev => ({
            ...prev,
            lastUpdate: timestamp
          }))
        }
      )
    }

    // Subscribe to match_games for end-by-end scoring
    channel.on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'match_games',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        console.log('Match game update:', payload)
        setState(prev => ({
          ...prev,
          lastUpdate: new Date().toISOString()
        }))
      }
    )

    channel.subscribe((status, err) => {
      if (err) {
        setError(`Subscription error: ${err.message}`)
        setConnectionStatus('error')
      } else {
        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus('connected')
            break
          case 'CHANNEL_ERROR':
            setError('Channel connection error')
            setConnectionStatus('error')
            break
          case 'TIMED_OUT':
            setError('Connection timed out')
            setConnectionStatus('error')
            break
          case 'CLOSED':
            setConnectionStatus('disconnected')
            break
        }
      }
    })

    channelRef.current = channel
  }, [matchId, supabase, enableBroadcast, onScoreUpdate, onStatusChange, onMatchEvent, setConnectionStatus, setError])

  // Disconnect from real-time updates
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [supabase, setConnectionStatus])

  // Broadcast live score update
  const broadcastScoreUpdate = useCallback((score: any) => {
    if (!channelRef.current || !enableBroadcast) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'live_score',
      payload: {
        matchId,
        score,
        timestamp: new Date().toISOString()
      }
    })
  }, [matchId, enableBroadcast])

  // Broadcast match event
  const broadcastMatchEvent = useCallback((eventType: string, data: any) => {
    if (!channelRef.current || !enableBroadcast) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'match_event',
      payload: {
        matchId,
        eventType,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }, [matchId, enableBroadcast])

  // Load match data and connect on mount
  useEffect(() => {
    if (matchId) {
      loadMatch()
      
      if (autoConnect) {
        connect()
      }
    }

    return () => {
      disconnect()
    }
  }, [matchId, autoConnect, loadMatch, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    broadcastScoreUpdate,
    broadcastMatchEvent
  }
}

/**
 * Simplified hook for just watching match updates without broadcast capabilities
 */
export function useMatchUpdates(
  matchId: string | null,
  onUpdate?: (match: Match) => void
): {
  match: Match | null
  isConnected: boolean
  error: string | null
} {
  const { match, isConnected, error } = useRealTimeMatch(matchId, {
    autoConnect: true,
    enableBroadcast: false,
    onScoreUpdate: onUpdate ? (score) => {
      if (match) onUpdate({ ...match, score })
    } : undefined,
    onStatusChange: onUpdate ? (status) => {
      if (match) onUpdate({ ...match, status })
    } : undefined
  })

  return { match, isConnected, error }
}

/**
 * Hook for live scoring with optimistic updates
 */
export function useLiveMatchScoring(matchId: string | null) {
  const [optimisticScore, setOptimisticScore] = useState<any>(null)
  const [isPending, setIsPending] = useState(false)

  const {
    match,
    isConnected,
    error,
    broadcastScoreUpdate
  } = useRealTimeMatch(matchId, {
    autoConnect: true,
    enableBroadcast: true,
    onScoreUpdate: (score) => {
      // Clear optimistic update when real update arrives
      setOptimisticScore(null)
      setIsPending(false)
    }
  })

  const updateScore = useCallback((newScore: any) => {
    if (!matchId) return

    // Apply optimistic update
    setOptimisticScore(newScore)
    setIsPending(true)

    // Broadcast the update
    broadcastScoreUpdate(newScore)

    // Clear optimistic state after timeout (fallback)
    setTimeout(() => {
      if (isPending) {
        setOptimisticScore(null)
        setIsPending(false)
      }
    }, 5000)
  }, [matchId, broadcastScoreUpdate, isPending])

  const displayScore = optimisticScore || match?.score

  return {
    match,
    score: displayScore,
    isConnected,
    error,
    isPending,
    updateScore
  }
}