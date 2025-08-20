import { useEffect, useState, useRef } from 'react'
import { Match, Score } from '@/types'
import { useMatchStore, useMatches, useMatchConnection } from '@/stores/match-store'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface UseRealTimeMatchOptions {
  autoConnect?: boolean
  enableBroadcast?: boolean
}

export interface UseRealTimeMatchReturn {
  match: Match | null
  isLive: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  liveScore: Score | null
  lastUpdated: string | null
  
  // Actions
  connect: () => void
  disconnect: () => void
  broadcastScore: (score: Score) => void
  setSelectedMatch: (matchId: string | null) => void
}

export function useRealTimeMatch(
  matchId: string | null, 
  options: UseRealTimeMatchOptions = {}
): UseRealTimeMatchReturn {
  const { autoConnect = true, enableBroadcast = false } = options
  
  const matches = useMatches()
  const isConnected = useMatchConnection()
  const { startRealTimeUpdates, stopRealTimeUpdates, setSelectedMatch, broadcastScore } = useMatchStore()
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [liveScore, setLiveScore] = useState<Score | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  
  const supabaseRef = useRef(createClientComponentClient())
  const channelRef = useRef<any>(null)
  const matchRef = useRef<Match | null>(null)
  
  // Find current match
  const match = matchId ? matches.find(m => m.id === matchId) || null : null
  matchRef.current = match
  
  const isLive = match?.status === 'active'
  
  // Connect to real-time updates
  const connect = () => {
    if (!matchId || channelRef.current) return
    
    setConnectionStatus('connecting')
    setSelectedMatch(matchId)
    
    try {
      // Subscribe to specific match updates via broadcast channel
      channelRef.current = supabaseRef.current
        .channel(`match_${matchId}`)
        .on('broadcast', { event: 'live_score' }, (payload) => {
          const { matchId: receivedMatchId, score, timestamp } = payload.payload
          if (receivedMatchId === matchId) {
            setLiveScore(score)
            setLastUpdated(timestamp || new Date().toISOString())
          }
        })
        .on('broadcast', { event: 'match_update' }, (payload) => {
          const { matchId: receivedMatchId, updates, timestamp } = payload.payload
          if (receivedMatchId === matchId) {
            // Match updates are handled by the store's postgres_changes subscription
            setLastUpdated(timestamp || new Date().toISOString())
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected')
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected')
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error')
          }
        })
      
      // Also start the general match real-time updates if not already started
      if (!isConnected) {
        startRealTimeUpdates()
      }
    } catch (error) {
      console.error('Failed to connect to real-time match updates:', error)
      setConnectionStatus('error')
    }
  }
  
  // Disconnect from real-time updates
  const disconnect = () => {
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setConnectionStatus('disconnected')
    setSelectedMatch(null)
    setLiveScore(null)
  }
  
  // Broadcast score update
  const handleBroadcastScore = (score: Score) => {
    if (!matchId || !enableBroadcast) return
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'live_score',
        payload: {
          matchId,
          score,
          timestamp: new Date().toISOString()
        }
      })
    }
    
    // Also update via store for database persistence
    broadcastScore(matchId, score)
  }
  
  // Auto-connect effect
  useEffect(() => {
    if (matchId && autoConnect && connectionStatus === 'disconnected') {
      connect()
    }
    
    return () => {
      if (!autoConnect) {
        disconnect()
      }
    }
  }, [matchId, autoConnect])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])
  
  // Update live score from store when match changes
  useEffect(() => {
    if (match?.score) {
      setLiveScore(match.score)
      setLastUpdated(match.updated_at || new Date().toISOString())
    }
  }, [match?.score, match?.updated_at])
  
  return {
    match,
    isLive,
    connectionStatus,
    liveScore,
    lastUpdated,
    connect,
    disconnect,
    broadcastScore: handleBroadcastScore,
    setSelectedMatch
  }
}

// Hook for managing multiple live matches
export function useRealTimeLiveMatches() {
  const { liveMatches, isConnected, startRealTimeUpdates, stopRealTimeUpdates, loadLiveMatches } = useMatchStore()
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected')
  }, [isConnected])
  
  const connect = () => {
    setConnectionStatus('connecting')
    startRealTimeUpdates()
    loadLiveMatches()
  }
  
  const disconnect = () => {
    stopRealTimeUpdates()
    setConnectionStatus('disconnected')
  }
  
  useEffect(() => {
    // Auto-connect to live matches on mount
    connect()
    
    return () => {
      disconnect()
    }
  }, [])
  
  return {
    liveMatches,
    connectionStatus,
    connect,
    disconnect
  }
}