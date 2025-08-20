'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useTournamentStore } from '@/stores/tournament-store'
import { useMatchStore } from '@/stores/match-store'
import { usePlayerStore } from '@/stores/player-store'
import { useCourtStore } from '@/stores/court-store'
import { useTournamentPresence } from '@/hooks/use-tournament-presence'

export interface RealTimeContextValue {
  // Connection status
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdated: string | null
  
  // Tournament context
  tournamentId: string | null
  setTournamentId: (id: string | null) => void
  
  // Store connections
  storeConnections: {
    tournaments: boolean
    matches: boolean
    players: boolean
    courts: boolean
  }
  
  // Presence
  presenceEnabled: boolean
  userRole: 'player' | 'official' | 'spectator' | 'organizer'
  setUserRole: (role: 'player' | 'official' | 'spectator' | 'organizer') => void
  
  // Actions
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

const RealTimeContext = createContext<RealTimeContextValue | null>(null)

export interface RealTimeProviderProps {
  children: ReactNode
  tournamentId?: string | null
  userId?: string
  userRole?: 'player' | 'official' | 'spectator' | 'organizer'
  displayName?: string
  enablePresence?: boolean
  autoConnect?: boolean
}

export function RealTimeProvider({
  children,
  tournamentId: propTournamentId = null,
  userId,
  userRole: propUserRole = 'spectator',
  displayName,
  enablePresence = true,
  autoConnect = true
}: RealTimeProviderProps) {
  const [tournamentId, setTournamentId] = useState<string | null>(propTournamentId)
  const [userRole, setUserRole] = useState<'player' | 'official' | 'spectator' | 'organizer'>(propUserRole)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [isReconnecting, setIsReconnecting] = useState(false)
  
  // Store hooks
  const {
    isConnected: tournamentsConnected,
    lastUpdated: tournamentsLastUpdated,
    startRealTimeUpdates: startTournamentUpdates,
    stopRealTimeUpdates: stopTournamentUpdates
  } = useTournamentStore()
  
  const {
    isConnected: matchesConnected,
    lastUpdated: matchesLastUpdated,
    startRealTimeUpdates: startMatchUpdates,
    stopRealTimeUpdates: stopMatchUpdates
  } = useMatchStore()
  
  const {
    isConnected: playersConnected,
    lastUpdated: playersLastUpdated,
    startRealTimeUpdates: startPlayerUpdates,
    stopRealTimeUpdates: stopPlayerUpdates
  } = usePlayerStore()
  
  const {
    isConnected: courtsConnected,
    lastUpdated: courtsLastUpdated,
    startRealTimeUpdates: startCourtUpdates,
    stopRealTimeUpdates: stopCourtUpdates
  } = useCourtStore()
  
  // Presence hook
  const {
    connectionStatus: presenceStatus,
    join: joinPresence,
    leave: leavePresence,
    updateRole: updatePresenceRole
  } = useTournamentPresence({
    tournamentId,
    userId,
    userRole,
    displayName,
    autoJoin: enablePresence && autoConnect
  })
  
  // Calculate overall connection status
  const storeConnections = {
    tournaments: tournamentsConnected,
    matches: matchesConnected,
    players: playersConnected,
    courts: courtsConnected
  }
  
  const isConnected = Object.values(storeConnections).some(connected => connected)
  
  const lastUpdated = [
    tournamentsLastUpdated,
    matchesLastUpdated,
    playersLastUpdated,
    courtsLastUpdated
  ]
    .filter(Boolean)
    .sort()
    .pop() || null
  
  // Update connection status based on store connections
  useEffect(() => {
    if (isReconnecting) return
    
    const connectedCount = Object.values(storeConnections).filter(Boolean).length
    const totalStores = Object.keys(storeConnections).length
    
    if (connectedCount === 0) {
      setConnectionStatus('disconnected')
    } else if (connectedCount === totalStores) {
      setConnectionStatus('connected')
    } else {
      setConnectionStatus('connecting')
    }
  }, [tournamentsConnected, matchesConnected, playersConnected, courtsConnected, isReconnecting])
  
  // Connect to real-time updates
  const connect = () => {
    setConnectionStatus('connecting')
    
    // Start all store subscriptions
    startTournamentUpdates()
    
    if (tournamentId) {
      startMatchUpdates(tournamentId)
      startPlayerUpdates(tournamentId)
    } else {
      startMatchUpdates()
      startPlayerUpdates()
    }
    
    startCourtUpdates()
    
    // Join presence if enabled
    if (enablePresence && tournamentId) {
      joinPresence(userRole, displayName)
    }
  }
  
  // Disconnect from real-time updates
  const disconnect = () => {
    setConnectionStatus('disconnected')
    
    // Stop all store subscriptions
    stopTournamentUpdates()
    stopMatchUpdates()
    stopPlayerUpdates()
    stopCourtUpdates()
    
    // Leave presence if enabled
    if (enablePresence) {
      leavePresence()
    }
  }
  
  // Reconnect to real-time updates
  const reconnect = async () => {
    setIsReconnecting(true)
    setConnectionStatus('connecting')
    
    // Disconnect first
    disconnect()
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Reconnect
    connect()
    
    setIsReconnecting(false)
  }
  
  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && connectionStatus === 'disconnected' && !isReconnecting) {
      connect()
    }
    
    return () => {
      if (!autoConnect) {
        disconnect()
      }
    }
  }, [autoConnect, tournamentId])
  
  // Update tournament context
  useEffect(() => {
    if (propTournamentId !== tournamentId) {
      setTournamentId(propTournamentId)
    }
  }, [propTournamentId])
  
  // Handle user role changes
  useEffect(() => {
    if (propUserRole !== userRole) {
      setUserRole(propUserRole)
      if (enablePresence && tournamentId) {
        updatePresenceRole(propUserRole)
      }
    }
  }, [propUserRole, userRole, enablePresence, tournamentId])
  
  // Handle tournament ID changes
  useEffect(() => {
    if (tournamentId && isConnected) {
      // Restart subscriptions with new tournament ID
      if (matchesConnected) {
        stopMatchUpdates()
        startMatchUpdates(tournamentId)
      }
      
      if (playersConnected) {
        stopPlayerUpdates()
        startPlayerUpdates(tournamentId)
      }
      
      // Update presence
      if (enablePresence) {
        leavePresence()
        joinPresence(userRole, displayName)
      }
    }
  }, [tournamentId])
  
  // Connection health monitoring
  useEffect(() => {
    let healthCheckInterval: NodeJS.Timeout | null = null
    
    if (isConnected) {
      // Check connection health every 30 seconds
      healthCheckInterval = setInterval(() => {
        const now = Date.now()
        const fiveMinutesAgo = now - 5 * 60 * 1000
        
        // If no updates in 5 minutes, consider reconnecting
        if (lastUpdated && new Date(lastUpdated).getTime() < fiveMinutesAgo) {
          console.warn('No real-time updates received in 5 minutes, reconnecting...')
          reconnect()
        }
      }, 30000)
    }
    
    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
      }
    }
  }, [isConnected, lastUpdated])
  
  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
        console.log('Network reconnected, attempting to reconnect real-time services...')
        reconnect()
      }
    }
    
    const handleOffline = () => {
      setConnectionStatus('error')
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [connectionStatus])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])
  
  const contextValue: RealTimeContextValue = {
    isConnected,
    connectionStatus,
    lastUpdated,
    tournamentId,
    setTournamentId: (id: string | null) => {
      setTournamentId(id)
    },
    storeConnections,
    presenceEnabled: enablePresence,
    userRole,
    setUserRole: (role: 'player' | 'official' | 'spectator' | 'organizer') => {
      setUserRole(role)
      if (enablePresence && tournamentId) {
        updatePresenceRole(role)
      }
    },
    connect,
    disconnect,
    reconnect
  }
  
  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  )
}

// Hook to use the real-time context
export function useRealTime(): RealTimeContextValue {
  const context = useContext(RealTimeContext)
  
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider')
  }
  
  return context
}

// Hook for connection status display
export function useRealTimeStatus() {
  const { isConnected, connectionStatus, lastUpdated, storeConnections } = useRealTime()
  
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'green'
      case 'connecting': return 'yellow'
      case 'error': return 'red'
      default: return 'gray'
    }
  }
  
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection Error'
      default: return 'Disconnected'
    }
  }
  
  const connectedStores = Object.entries(storeConnections)
    .filter(([, connected]) => connected)
    .map(([store]) => store)
  
  return {
    isConnected,
    connectionStatus,
    statusColor: getStatusColor(),
    statusText: getStatusText(),
    lastUpdated,
    connectedStores,
    storeConnections
  }
}