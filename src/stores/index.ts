// Store exports and provider setup for WildTrails application
export * from './tournament-store'
export * from './player-store'
export * from './match-store'

// Re-export all hooks for convenient importing
export {
  useTournamentStore,
  useTournaments,
  useCurrentTournament,
  useTournamentLoading,
  useTournamentError
} from './tournament-store'

export {
  usePlayerStore,
  usePlayers,
  useCurrentPlayer,
  usePlayerLoading,
  usePlayerError
} from './player-store'

export {
  useMatchStore,
  useMatches,
  useActiveMatches,
  useCurrentMatch,
  useMatchLoading,
  useMatchError
} from './match-store'

// Initialize real-time connections for all stores
export const initializeRealTimeConnections = () => {
  // These will be called when the app starts
  const { startRealTimeUpdates: startTournamentUpdates } = useTournamentStore.getState()
  const { startRealTimeUpdates: startPlayerUpdates } = usePlayerStore.getState()
  const { startRealTimeUpdates: startMatchUpdates } = useMatchStore.getState()

  startTournamentUpdates()
  startPlayerUpdates()
  startMatchUpdates()
}

// Clean up all real-time connections
export const cleanupRealTimeConnections = () => {
  const { stopRealTimeUpdates: stopTournamentUpdates } = useTournamentStore.getState()
  const { stopRealTimeUpdates: stopPlayerUpdates } = usePlayerStore.getState()
  const { stopRealTimeUpdates: stopMatchUpdates } = useMatchStore.getState()

  stopTournamentUpdates()
  stopPlayerUpdates()
  stopMatchUpdates()
}

// Global store management utilities
export const clearAllStoreErrors = () => {
  useTournamentStore.getState().clearError()
  usePlayerStore.getState().clearError()
  useMatchStore.getState().clearError()
}

export const getConnectionStatus = () => ({
  tournaments: useTournamentStore.getState().isConnected,
  players: usePlayerStore.getState().isConnected,
  matches: useMatchStore.getState().isConnected
})

// Optional: Provider component for app-wide initialization
import React, { useEffect } from 'react'
import { useTournamentStore } from './tournament-store'
import { usePlayerStore } from './player-store'
import { useMatchStore } from './match-store'

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Initialize real-time connections when the provider mounts
    initializeRealTimeConnections()

    // Cleanup on unmount
    return () => {
      cleanupRealTimeConnections()
    }
  }, [])

  return React.createElement(React.Fragment, null, children)
}