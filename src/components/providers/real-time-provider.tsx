'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@/lib/db/supabase'
import { useTournamentStore } from '@/stores/tournament-store'
import { useMatchStore } from '@/stores/match-store'
import { usePlayerStore } from '@/stores/player-store'
import { useCourtStore } from '@/stores/court-store'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RealTimeConnectionState {
  isConnected: boolean
  tournamentId: string | null
  connectionError: string | null
  lastUpdate: string | null
  activeConnections: string[]
  retryCount: number
  maxRetries: number
}

export interface RealTimeContextValue extends RealTimeConnectionState {
  connectToTournament: (tournamentId: string, userInfo?: any) => Promise<void>
  disconnectFromTournament: () => Promise<void>
  retry: () => void
  broadcastTournamentEvent: (eventType: string, data: any) => void
  isRetrying: boolean
}

const RealTimeContext = createContext<RealTimeContextValue | null>(null)

export interface RealTimeProviderProps {
  children: React.ReactNode
  autoReconnect?: boolean
  maxRetries?: number
  retryDelay?: number
  enablePresence?: boolean
  onConnectionChange?: (connected: boolean) => void
  onError?: (error: string) => void
}

export function RealTimeProvider({
  children,
  autoReconnect = true,
  maxRetries = 5,
  retryDelay = 3000,
  enablePresence = true,
  onConnectionChange,
  onError
}: RealTimeProviderProps) {
  const [state, setState] = useState<RealTimeConnectionState>({
    isConnected: false,
    tournamentId: null,
    connectionError: null,
    lastUpdate: null,
    activeConnections: [],
    retryCount: 0,
    maxRetries
  })

  const [isRetrying, setIsRetrying] = useState(false)
  
  const supabase = createClientComponentClient()
  const mainChannelRef = useRef<RealtimeChannel | null>(null)
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Store references
  const tournamentStore = useTournamentStore()
  const matchStore = useMatchStore()
  const playerStore = usePlayerStore()
  const courtStore = useCourtStore()

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, connectionError: error }))
    if (error) {
      onError?.(error)
    }
  }, [onError])

  const setConnectionStatus = useCallback((connected: boolean) => {
    setState(prev => ({ ...prev, isConnected: connected }))
    onConnectionChange?.(connected)
  }, [onConnectionChange])

  // Connect all stores to real-time updates
  const connectStores = useCallback((tournamentId: string) => {
    try {
      tournamentStore.startRealTimeUpdates()
      matchStore.startRealTimeUpdates(tournamentId)
      playerStore.startRealTimeUpdates(tournamentId)
      courtStore.startRealTimeUpdates(tournamentId)
      
      setState(prev => ({
        ...prev,
        activeConnections: ['tournaments', 'matches', 'players', 'courts']
      }))
    } catch (error) {
      console.error('Error connecting stores:', error)
      setError('Failed to connect real-time stores')
    }
  }, [tournamentStore, matchStore, playerStore, courtStore, setError])

  // Disconnect all stores from real-time updates
  const disconnectStores = useCallback(() => {
    try {
      tournamentStore.stopRealTimeUpdates()
      matchStore.stopRealTimeUpdates()
      playerStore.stopRealTimeUpdates()
      courtStore.stopRealTimeUpdates()
      
      setState(prev => ({
        ...prev,
        activeConnections: []
      }))
    } catch (error) {
      console.error('Error disconnecting stores:', error)
    }
  }, [tournamentStore, matchStore, playerStore, courtStore])

  // Create presence channel for user tracking
  const createPresenceChannel = useCallback(async (tournamentId: string, userInfo?: any) => {
    if (!enablePresence || presenceChannelRef.current) return

    try {
      const channel = supabase.channel(`tournament_presence_${tournamentId}`, {
        config: { presence: { key: userInfo?.userId || 'anonymous' } }
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          console.log('Presence synced')
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences)
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && userInfo) {
            await channel.track({
              userId: userInfo.userId,
              name: userInfo.name || 'Anonymous',
              role: userInfo.role || 'spectator',
              joinedAt: new Date().toISOString()
            })
          }
        })

      presenceChannelRef.current = channel
    } catch (error) {
      console.error('Error creating presence channel:', error)
    }
  }, [supabase, enablePresence])

  // Connect to tournament real-time updates
  const connectToTournament = useCallback(async (tournamentId: string, userInfo?: any) => {
    // Don't connect if already connected to the same tournament
    if (state.isConnected && state.tournamentId === tournamentId) return

    // Disconnect from previous tournament if connected
    if (state.tournamentId && state.tournamentId !== tournamentId) {
      await disconnectFromTournament()
    }

    setState(prev => ({ 
      ...prev, 
      tournamentId,
      connectionError: null,
      retryCount: 0
    }))
    setError(null)

    try {
      // Create main tournament channel for system-wide events
      const mainChannel = supabase
        .channel(`tournament_main_${tournamentId}`)
        .on('broadcast', { event: 'tournament_event' }, (payload) => {
          const { eventType, data, timestamp } = payload.payload
          console.log('Tournament event:', eventType, data)
          
          setState(prev => ({ ...prev, lastUpdate: timestamp }))
        })
        .on('broadcast', { event: 'system_announcement' }, (payload) => {
          console.log('System announcement:', payload.payload)
        })
        .subscribe((status, error) => {
          if (error) {
            setError(`Main channel error: ${error.message}`)
            setConnectionStatus(false)
          } else if (status === 'SUBSCRIBED') {
            setConnectionStatus(true)
            setState(prev => ({ ...prev, retryCount: 0 }))
          }
        })

      mainChannelRef.current = mainChannel

      // Connect all stores to their respective real-time updates
      connectStores(tournamentId)

      // Create presence channel if enabled
      if (enablePresence) {
        await createPresenceChannel(tournamentId, userInfo)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to tournament'
      setError(errorMessage)
      setConnectionStatus(false)
      
      // Auto-retry if enabled
      if (autoReconnect && state.retryCount < maxRetries) {
        setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }))
        setIsRetrying(true)
        
        retryTimeoutRef.current = setTimeout(() => {
          setIsRetrying(false)
          connectToTournament(tournamentId, userInfo)
        }, retryDelay)
      }
    }
  }, [
    state.isConnected, 
    state.tournamentId, 
    state.retryCount, 
    maxRetries,
    supabase, 
    setError, 
    setConnectionStatus, 
    connectStores, 
    createPresenceChannel,
    autoReconnect,
    retryDelay,
    enablePresence
  ])

  // Disconnect from tournament real-time updates
  const disconnectFromTournament = useCallback(async () => {
    // Clear retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    // Remove channels
    if (mainChannelRef.current) {
      supabase.removeChannel(mainChannelRef.current)
      mainChannelRef.current = null
    }

    if (presenceChannelRef.current) {
      await presenceChannelRef.current.untrack()
      supabase.removeChannel(presenceChannelRef.current)
      presenceChannelRef.current = null
    }

    // Disconnect stores
    disconnectStores()

    setState(prev => ({
      ...prev,
      isConnected: false,
      tournamentId: null,
      connectionError: null,
      lastUpdate: null,
      activeConnections: [],
      retryCount: 0
    }))
    setConnectionStatus(false)
    setIsRetrying(false)
  }, [supabase, disconnectStores, setConnectionStatus])

  // Manual retry function
  const retry = useCallback(() => {
    if (state.tournamentId && state.retryCount < maxRetries) {
      connectToTournament(state.tournamentId)
    }
  }, [state.tournamentId, state.retryCount, maxRetries, connectToTournament])

  // Broadcast tournament event
  const broadcastTournamentEvent = useCallback((eventType: string, data: any) => {
    if (!mainChannelRef.current || !state.isConnected) return

    mainChannelRef.current.send({
      type: 'broadcast',
      event: 'tournament_event',
      payload: {
        eventType,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }, [state.isConnected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromTournament()
    }
  }, [disconnectFromTournament])

  // Handle network reconnection
  useEffect(() => {
    const handleOnline = () => {
      if (state.tournamentId && !state.isConnected && autoReconnect) {
        connectToTournament(state.tournamentId)
      }
    }

    const handleOffline = () => {
      setError('Network connection lost')
      setConnectionStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [state.tournamentId, state.isConnected, autoReconnect, connectToTournament, setError, setConnectionStatus])

  const contextValue: RealTimeContextValue = {
    ...state,
    connectToTournament,
    disconnectFromTournament,
    retry,
    broadcastTournamentEvent,
    isRetrying
  }

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  )
}

export function useRealTime() {
  const context = useContext(RealTimeContext)
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider')
  }
  return context
}

// Connection status indicator component
export function ConnectionStatus() {
  const { isConnected, connectionError, isRetrying, retry, retryCount, maxRetries } = useRealTime()

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm">Live</span>
      </div>
    )
  }

  if (isRetrying) {
    return (
      <div className="flex items-center gap-2 text-yellow-600">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-spin" />
        <span className="text-sm">Reconnecting...</span>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-sm">Disconnected</span>
        {retryCount < maxRetries && (
          <button 
            onClick={retry}
            className="ml-1 text-xs underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="h-2 w-2 rounded-full bg-gray-400" />
      <span className="text-sm">Offline</span>
    </div>
  )
}

// Hook for tournament-specific real-time connection
export function useTournamentRealTime(tournamentId: string | null, userInfo?: any) {
  const realTime = useRealTime()

  useEffect(() => {
    if (tournamentId) {
      realTime.connectToTournament(tournamentId, userInfo)
    }

    return () => {
      if (tournamentId) {
        realTime.disconnectFromTournament()
      }
    }
  }, [tournamentId, realTime, userInfo])

  return realTime
}