import { useEffect, useState, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@/lib/db/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PresenceUser {
  userId: string
  name: string
  role: 'player' | 'official' | 'spectator' | 'organizer'
  avatar?: string
  joinedAt: string
  lastSeen: string
}

export interface TournamentPresenceState {
  activeUsers: PresenceUser[]
  totalUsers: number
  usersByRole: Record<string, PresenceUser[]>
  isConnected: boolean
  error: string | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export interface TournamentPresenceActions {
  connect: (userInfo: Omit<PresenceUser, 'joinedAt' | 'lastSeen'>) => void
  disconnect: () => void
  updateUserRole: (role: PresenceUser['role']) => void
  broadcastUserAction: (action: string, data?: any) => void
}

export type UseTournamentPresenceReturn = TournamentPresenceState & TournamentPresenceActions

/**
 * Hook for tracking active users in a tournament using Supabase Presence
 * Provides real-time user tracking, role management, and user interaction broadcasting
 */
export function useTournamentPresence(
  tournamentId: string | null,
  options: {
    autoConnect?: boolean
    updateInterval?: number
    onUserJoin?: (user: PresenceUser) => void
    onUserLeave?: (user: PresenceUser) => void
    onUserUpdate?: (user: PresenceUser) => void
  } = {}
): UseTournamentPresenceReturn {
  const {
    autoConnect = false,
    updateInterval = 30000, // 30 seconds
    onUserJoin,
    onUserLeave,
    onUserUpdate
  } = options

  const [state, setState] = useState<TournamentPresenceState>({
    activeUsers: [],
    totalUsers: 0,
    usersByRole: {
      player: [],
      official: [],
      spectator: [],
      organizer: []
    },
    isConnected: false,
    error: null,
    connectionStatus: 'disconnected'
  })

  const supabase = createClientComponentClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userInfoRef = useRef<Omit<PresenceUser, 'joinedAt' | 'lastSeen'> | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout>()

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ 
      ...prev, 
      error,
      connectionStatus: error ? 'error' : prev.connectionStatus
    }))
  }, [])

  const setConnectionStatus = useCallback((status: TournamentPresenceState['connectionStatus']) => {
    setState(prev => ({ 
      ...prev, 
      connectionStatus: status,
      isConnected: status === 'connected'
    }))
  }, [])

  // Process presence state and update local state
  const processPresenceState = useCallback((presenceState: Record<string, any[]>) => {
    const activeUsers: PresenceUser[] = []
    const usersByRole: Record<string, PresenceUser[]> = {
      player: [],
      official: [],
      spectator: [],
      organizer: []
    }

    Object.values(presenceState).forEach(presences => {
      presences.forEach(presence => {
        const user: PresenceUser = {
          userId: presence.userId,
          name: presence.name,
          role: presence.role,
          avatar: presence.avatar,
          joinedAt: presence.joinedAt,
          lastSeen: presence.lastSeen || new Date().toISOString()
        }
        
        activeUsers.push(user)
        if (usersByRole[user.role]) {
          usersByRole[user.role].push(user)
        }
      })
    })

    // Sort users by join time (most recent first)
    activeUsers.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())

    setState(prev => ({
      ...prev,
      activeUsers,
      totalUsers: activeUsers.length,
      usersByRole
    }))
  }, [])

  // Connect to tournament presence
  const connect = useCallback((userInfo: Omit<PresenceUser, 'joinedAt' | 'lastSeen'>) => {
    if (!tournamentId || channelRef.current) return

    userInfoRef.current = userInfo
    setConnectionStatus('connecting')
    setError(null)

    const channel = supabase
      .channel(`tournament_presence_${tournamentId}`, {
        config: { presence: { key: userInfo.userId } }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState()
        processPresenceState(presenceState)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const newUser = newPresences[0] as PresenceUser
        onUserJoin?.(newUser)
        
        const presenceState = channel.presenceState()
        processPresenceState(presenceState)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const leftUser = leftPresences[0] as PresenceUser
        onUserLeave?.(leftUser)
        
        const presenceState = channel.presenceState()
        processPresenceState(presenceState)
      })
      .on('broadcast', { event: 'user_action' }, ({ payload }) => {
        console.log('User action:', payload)
      })
      .subscribe(async (status, error) => {
        if (error) {
          setError(`Presence subscription error: ${error.message}`)
          setConnectionStatus('error')
          return
        }

        switch (status) {
          case 'SUBSCRIBED':
            // Track presence with user info
            const presenceData = {
              ...userInfo,
              joinedAt: new Date().toISOString(),
              lastSeen: new Date().toISOString()
            }

            await channel.track(presenceData)
            setConnectionStatus('connected')

            // Set up heartbeat to update lastSeen
            heartbeatRef.current = setInterval(async () => {
              await channel.track({
                ...presenceData,
                lastSeen: new Date().toISOString()
              })
            }, updateInterval)
            break

          case 'CHANNEL_ERROR':
            setError('Presence channel error')
            setConnectionStatus('error')
            break

          case 'TIMED_OUT':
            setError('Presence connection timed out')
            setConnectionStatus('error')
            break

          case 'CLOSED':
            setConnectionStatus('disconnected')
            break
        }
      })

    channelRef.current = channel
  }, [tournamentId, supabase, processPresenceState, onUserJoin, onUserLeave, updateInterval, setConnectionStatus, setError])

  // Disconnect from presence
  const disconnect = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.untrack()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = undefined
    }

    setConnectionStatus('disconnected')
    setState(prev => ({
      ...prev,
      activeUsers: [],
      totalUsers: 0,
      usersByRole: {
        player: [],
        official: [],
        spectator: [],
        organizer: []
      }
    }))
  }, [supabase, setConnectionStatus])

  // Update user role
  const updateUserRole = useCallback(async (role: PresenceUser['role']) => {
    if (!channelRef.current || !userInfoRef.current) return

    const updatedUserInfo = {
      ...userInfoRef.current,
      role,
      lastSeen: new Date().toISOString()
    }

    userInfoRef.current = { ...userInfoRef.current, role }

    await channelRef.current.track({
      ...updatedUserInfo,
      joinedAt: userInfoRef.current.joinedAt || new Date().toISOString()
    })

    onUserUpdate?.(updatedUserInfo as PresenceUser)
  }, [onUserUpdate])

  // Broadcast user action
  const broadcastUserAction = useCallback((action: string, data?: any) => {
    if (!channelRef.current || !userInfoRef.current) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'user_action',
      payload: {
        userId: userInfoRef.current.userId,
        action,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }, [])

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && tournamentId && userInfoRef.current) {
      connect(userInfoRef.current)
    }

    return () => {
      disconnect()
    }
  }, [tournamentId, autoConnect, connect, disconnect])

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
    updateUserRole,
    broadcastUserAction
  }
}

/**
 * Simplified hook for just tracking user count without full presence features
 */
export function useTournamentUserCount(tournamentId: string | null): {
  totalUsers: number
  usersByRole: Record<string, number>
  isConnected: boolean
} {
  const { totalUsers, usersByRole, isConnected } = useTournamentPresence(tournamentId, {
    autoConnect: false
  })

  const userCountsByRole = Object.entries(usersByRole).reduce((acc, [role, users]) => {
    acc[role] = users.length
    return acc
  }, {} as Record<string, number>)

  return {
    totalUsers,
    usersByRole: userCountsByRole,
    isConnected
  }
}

/**
 * Hook for officials/organizers with enhanced presence features
 */
export function useOfficialPresence(
  tournamentId: string | null,
  officialInfo: Omit<PresenceUser, 'joinedAt' | 'lastSeen' | 'role'>
) {
  const presenceReturn = useTournamentPresence(tournamentId, {
    autoConnect: true,
    onUserJoin: (user) => {
      if (user.role === 'official' || user.role === 'organizer') {
        console.log('Official joined:', user.name)
      }
    },
    onUserLeave: (user) => {
      if (user.role === 'official' || user.role === 'organizer') {
        console.log('Official left:', user.name)
      }
    }
  })

  useEffect(() => {
    if (tournamentId) {
      presenceReturn.connect({
        ...officialInfo,
        role: 'official'
      })
    }
  }, [tournamentId, officialInfo, presenceReturn])

  const officials = presenceReturn.usersByRole.official || []
  const organizers = presenceReturn.usersByRole.organizer || []

  return {
    ...presenceReturn,
    officials,
    organizers,
    totalOfficials: officials.length + organizers.length
  }
}