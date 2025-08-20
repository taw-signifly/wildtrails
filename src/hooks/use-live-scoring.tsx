'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Match } from '@/types'
import { createClientComponentClient } from '@/lib/db/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface LiveScoringState {
  currentMatch: Match | null
  isConnected: boolean
  connectionError: string | null
  isLoading: boolean
  lastUpdate: number | null
  activeBroadcasts: Set<string>
}

interface UseLiveScoringReturn extends LiveScoringState {
  subscribeToMatch: (matchId: string) => void
  unsubscribeFromMatch: (matchId: string) => void
  refreshMatch: () => Promise<void>
  broadcastScoreUpdate: (matchId: string, score: any) => void
  broadcastEndScored: (matchId: string, endData: any) => void
  broadcastMatchEvent: (matchId: string, eventType: string, data: any) => void
}

export function useLiveScoring(tournamentId: string): UseLiveScoringReturn {
  const [state, setState] = useState<LiveScoringState>({
    currentMatch: null,
    isConnected: false,
    connectionError: null,
    isLoading: false,
    lastUpdate: null,
    activeBroadcasts: new Set()
  })

  const activeMatchId = useRef<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClientComponentClient()

  // Initialize Supabase real-time connection for tournament
  const connectToTournament = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    setState(prev => ({ ...prev, connectionError: null }))

    try {
      const channel = supabase
        .channel(`live_scoring_${tournamentId}`)
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'matches',
            filter: `tournament_id=eq.${tournamentId}`
          },
          (payload) => {
            const { eventType, new: newRecord } = payload
            if (eventType === 'UPDATE' && newRecord && activeMatchId.current === newRecord.id) {
              setState(prev => ({
                ...prev,
                currentMatch: newRecord as Match,
                lastUpdate: Date.now()
              }))
            }
          }
        )
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public', 
            table: 'match_games',
            filter: `match_id=eq.${activeMatchId.current || ''}`
          },
          (payload) => {
            // Handle end-by-end scoring updates
            refreshMatch()
            setState(prev => ({ ...prev, lastUpdate: Date.now() }))
          }
        )
        .on('broadcast',
          { event: 'live_score' },
          (payload) => {
            const { matchId, score, timestamp } = payload.payload
            if (activeMatchId.current === matchId) {
              setState(prev => ({
                ...prev,
                currentMatch: prev.currentMatch ? { ...prev.currentMatch, score } : null,
                lastUpdate: Date.now()
              }))
            }
          }
        )
        .on('broadcast',
          { event: 'end_scored' },
          (payload) => {
            const { matchId } = payload.payload
            if (activeMatchId.current === matchId) {
              refreshMatch()
              setState(prev => ({ ...prev, lastUpdate: Date.now() }))
            }
          }
        )
        .on('broadcast',
          { event: 'match_event' },
          (payload) => {
            const { matchId, eventType, data } = payload.payload
            if (activeMatchId.current === matchId) {
              handleLiveEvent({ type: eventType, matchId, data })
              setState(prev => ({ ...prev, lastUpdate: Date.now() }))
            }
          }
        )
        .subscribe((status, error) => {
          if (error) {
            setState(prev => ({
              ...prev,
              isConnected: false,
              connectionError: `Connection error: ${error.message}`
            }))
          } else {
            switch (status) {
              case 'SUBSCRIBED':
                setState(prev => ({ ...prev, isConnected: true, connectionError: null }))
                break
              case 'CHANNEL_ERROR':
                setState(prev => ({
                  ...prev,
                  isConnected: false,
                  connectionError: 'Channel error'
                }))
                break
              case 'TIMED_OUT':
                setState(prev => ({
                  ...prev,
                  isConnected: false,
                  connectionError: 'Connection timed out'
                }))
                // Attempt to reconnect
                setTimeout(() => {
                  if (activeMatchId.current) {
                    connectToTournament()
                  }
                }, 3000)
                break
              case 'CLOSED':
                setState(prev => ({ ...prev, isConnected: false }))
                break
            }
          }
        })

      channelRef.current = channel
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        connectionError: 'Failed to connect' 
      }))
    }
  }, [tournamentId, supabase])

  // Handle live events from Supabase real-time
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
        case 'match_paused':
        case 'match_resumed':
          // Handle pause/resume without full refresh
          setState(prev => ({
            ...prev,
            currentMatch: prev.currentMatch ? {
              ...prev.currentMatch,
              status: eventData.type === 'match_paused' ? 'paused' : 'in_progress'
            } : null
          }))
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
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          team1:teams!team1_id(id, name),
          team2:teams!team2_id(id, name),
          court:courts!court_id(id, name, status),
          games:match_games(*)
        `)
        .eq('id', activeMatchId.current)
        .single()

      if (error) throw error

      setState(prev => ({ 
        ...prev, 
        currentMatch: data as Match,
        isLoading: false 
      }))
    } catch (error) {
      console.error('Error refreshing match:', error)
      setState(prev => ({ 
        ...prev, 
        connectionError: 'Error refreshing match data',
        isLoading: false 
      }))
    }
  }, [supabase])

  // Subscribe to a specific match
  const subscribeToMatch = useCallback(async (matchId: string) => {
    activeMatchId.current = matchId
    
    // Connect to tournament real-time if not already connected
    if (!state.isConnected && !channelRef.current) {
      connectToTournament()
    }

    // Load initial match data
    await refreshMatch()
  }, [state.isConnected, connectToTournament, refreshMatch])

  // Unsubscribe from current match
  const unsubscribeFromMatch = useCallback((matchId: string) => {
    if (activeMatchId.current === matchId) {
      activeMatchId.current = null
      setState(prev => ({ 
        ...prev, 
        currentMatch: null,
        activeBroadcasts: new Set()
      }))
      
      // Remove channel if no active match
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setState(prev => ({ ...prev, isConnected: false }))
      }
    }
  }, [supabase])

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

  // Broadcast score update
  const broadcastScoreUpdate = useCallback((matchId: string, score: any) => {
    if (!channelRef.current) return
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'live_score',
      payload: {
        matchId,
        score,
        timestamp: new Date().toISOString()
      }
    })
    
    setState(prev => ({
      ...prev,
      activeBroadcasts: new Set([...prev.activeBroadcasts, 'score_update'])
    }))
  }, [])
  
  // Broadcast end scored
  const broadcastEndScored = useCallback((matchId: string, endData: any) => {
    if (!channelRef.current) return
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'end_scored',
      payload: {
        matchId,
        endData,
        timestamp: new Date().toISOString()
      }
    })
    
    setState(prev => ({
      ...prev,
      activeBroadcasts: new Set([...prev.activeBroadcasts, 'end_scored'])
    }))
  }, [])
  
  // Broadcast match event
  const broadcastMatchEvent = useCallback((matchId: string, eventType: string, data: any) => {
    if (!channelRef.current) return
    
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
    
    setState(prev => ({
      ...prev,
      activeBroadcasts: new Set([...prev.activeBroadcasts, eventType])
    }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      activeMatchId.current = null
    }
  }, [supabase])

  return {
    ...state,
    subscribeToMatch,
    unsubscribeFromMatch,
    refreshMatch,
    broadcastScoreUpdate,
    broadcastEndScored,
    broadcastMatchEvent
  }
}