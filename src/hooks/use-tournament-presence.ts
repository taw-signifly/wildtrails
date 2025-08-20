import { useEffect, useState, useRef } from 'react'
import { Tournament } from '@/types'
import { useTournamentStore, useCurrentTournament } from '@/stores/tournament-store'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface PresenceUser {
  userId: string
  displayName: string
  role: 'player' | 'official' | 'spectator' | 'organizer'
  joinedAt: string
  lastSeen: string
  isActive: boolean
}

export interface TournamentPresenceState {
  activeUsers: PresenceUser[]
  totalUsers: number
  officials: PresenceUser[]
  players: PresenceUser[]
  spectators: PresenceUser[]
  organizers: PresenceUser[]
}

export interface UseTournamentPresenceOptions {
  tournamentId?: string
  userId?: string
  userRole?: 'player' | 'official' | 'spectator' | 'organizer'
  displayName?: string
  autoJoin?: boolean
  heartbeatInterval?: number // milliseconds
}

export interface UseTournamentPresenceReturn {
  presence: TournamentPresenceState
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  isPresent: boolean
  
  // Actions
  join: (role: 'player' | 'official' | 'spectator' | 'organizer', displayName?: string) => Promise<void>
  leave: () => void
  updateRole: (role: 'player' | 'official' | 'spectator' | 'organizer') => void
  sendHeartbeat: () => void
}

export function useTournamentPresence(
  options: UseTournamentPresenceOptions = {}
): UseTournamentPresenceReturn {
  const {
    tournamentId: propTournamentId,
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userRole = 'spectator',
    displayName = 'Anonymous User',
    autoJoin = true,
    heartbeatInterval = 30000 // 30 seconds
  } = options
  
  const currentTournament = useCurrentTournament()
  const tournamentId = propTournamentId || currentTournament?.id
  
  const [presence, setPresence] = useState<TournamentPresenceState>({
    activeUsers: [],
    totalUsers: 0,
    officials: [],
    players: [],
    spectators: [],
    organizers: []
  })
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [isPresent, setIsPresent] = useState(false)
  
  const supabaseRef = useRef(createClientComponentClient())
  const channelRef = useRef<any>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const userRef = useRef({ userId, role: userRole, displayName })
  
  // Update user ref when props change
  useEffect(() => {
    userRef.current = { userId, role: userRole, displayName }
  }, [userId, userRole, displayName])
  
  // Process presence state from raw presence data
  const processPresenceState = (presenceState: any): TournamentPresenceState => {
    const users: PresenceUser[] = []
    
    // Extract users from presence state
    Object.keys(presenceState).forEach(key => {
      const presence = presenceState[key]
      if (presence && presence.length > 0) {
        const user = presence[0] // Take the latest presence entry
        users.push({
          userId: user.userId || key,
          displayName: user.displayName || 'Unknown User',
          role: user.role || 'spectator',
          joinedAt: user.joinedAt || new Date().toISOString(),
          lastSeen: user.lastSeen || new Date().toISOString(),
          isActive: true
        })
      }
    })
    
    // Sort by join time
    users.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
    
    return {
      activeUsers: users,
      totalUsers: users.length,
      officials: users.filter(u => u.role === 'official'),
      players: users.filter(u => u.role === 'player'),
      spectators: users.filter(u => u.role === 'spectator'),
      organizers: users.filter(u => u.role === 'organizer')
    }
  }
  
  // Join tournament presence
  const join = async (role: 'player' | 'official' | 'spectator' | 'organizer', name?: string) => {
    if (!tournamentId || channelRef.current) return
    
    setConnectionStatus('connecting')
    
    const userData = {
      userId: userRef.current.userId,
      role,
      displayName: name || userRef.current.displayName,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }
    
    try {
      channelRef.current = supabaseRef.current
        .channel(`tournament_${tournamentId}_presence`)
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channelRef.current?.presenceState()
          if (presenceState) {
            const processedState = processPresenceState(presenceState)
            setPresence(processedState)
            
            // Check if current user is present
            setIsPresent(processedState.activeUsers.some(u => u.userId === userRef.current.userId))
          }
          setConnectionStatus('connected')
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          const presenceState = channelRef.current?.presenceState()
          if (presenceState) {
            setPresence(processPresenceState(presenceState))
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          const presenceState = channelRef.current?.presenceState()
          if (presenceState) {
            setPresence(processPresenceState(presenceState))
          }
          
          // Check if current user left
          if (leftPresences.some((p: any) => p.userId === userRef.current.userId)) {
            setIsPresent(false)
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Track this user's presence
            await channelRef.current?.track(userData)
            setIsPresent(true)
            setConnectionStatus('connected')
            
            // Start heartbeat
            startHeartbeat()
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected')
            setIsPresent(false)
            stopHeartbeat()
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error')
            setIsPresent(false)
            stopHeartbeat()
          }
        })
    } catch (error) {
      console.error('Failed to join tournament presence:', error)
      setConnectionStatus('error')
    }
  }
  
  // Leave tournament presence
  const leave = () => {
    if (channelRef.current) {
      channelRef.current.untrack()
      supabaseRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
    
    setConnectionStatus('disconnected')
    setIsPresent(false)
    stopHeartbeat()
  }
  
  // Update user role
  const updateRole = (role: 'player' | 'official' | 'spectator' | 'organizer') => {
    if (channelRef.current && isPresent) {
      const userData = {
        userId: userRef.current.userId,
        role,
        displayName: userRef.current.displayName,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }
      
      channelRef.current.track(userData)
    }
  }
  
  // Send heartbeat to maintain presence
  const sendHeartbeat = () => {
    if (channelRef.current && isPresent) {
      const userData = {
        userId: userRef.current.userId,
        role: userRef.current.role,
        displayName: userRef.current.displayName,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }
      
      channelRef.current.track(userData)
    }
  }
  
  // Start heartbeat timer
  const startHeartbeat = () => {
    if (heartbeatRef.current) return
    
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat()
    }, heartbeatInterval)
  }
  
  // Stop heartbeat timer
  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }
  
  // Auto-join effect
  useEffect(() => {
    if (tournamentId && autoJoin && connectionStatus === 'disconnected') {
      join(userRole, displayName)
    }
    
    return () => {
      if (!autoJoin) {
        leave()
      }
    }
  }, [tournamentId, autoJoin])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      leave()
    }
  }, [])
  
  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs/minimized - maintain presence but reduce heartbeat
        stopHeartbeat()
      } else {
        // User is back - resume normal heartbeat
        if (isPresent) {
          sendHeartbeat()
          startHeartbeat()
        }
      }
    }
    
    const handleBeforeUnload = () => {
      // Clean leave when user closes/refreshes page
      if (channelRef.current) {
        channelRef.current.untrack()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isPresent])
  
  return {
    presence,
    connectionStatus,
    isPresent,
    join,
    leave,
    updateRole,
    sendHeartbeat
  }
}

// Hook for simple presence display without joining
export function useTournamentPresenceDisplay(tournamentId: string | null) {
  const [presence, setPresence] = useState<TournamentPresenceState>({
    activeUsers: [],
    totalUsers: 0,
    officials: [],
    players: [],
    spectators: [],
    organizers: []
  })
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const supabaseRef = useRef(createClientComponentClient())
  const channelRef = useRef<any>(null)
  
  // Process presence state from raw presence data
  const processPresenceState = (presenceState: any): TournamentPresenceState => {
    const users: PresenceUser[] = []
    
    Object.keys(presenceState).forEach(key => {
      const presence = presenceState[key]
      if (presence && presence.length > 0) {
        const user = presence[0]
        users.push({
          userId: user.userId || key,
          displayName: user.displayName || 'Unknown User',
          role: user.role || 'spectator',
          joinedAt: user.joinedAt || new Date().toISOString(),
          lastSeen: user.lastSeen || new Date().toISOString(),
          isActive: true
        })
      }
    })
    
    users.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
    
    return {
      activeUsers: users,
      totalUsers: users.length,
      officials: users.filter(u => u.role === 'official'),
      players: users.filter(u => u.role === 'player'),
      spectators: users.filter(u => u.role === 'spectator'),
      organizers: users.filter(u => u.role === 'organizer')
    }
  }
  
  useEffect(() => {
    if (!tournamentId) return
    
    setConnectionStatus('connecting')
    
    channelRef.current = supabaseRef.current
      .channel(`tournament_${tournamentId}_presence`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channelRef.current?.presenceState()
        if (presenceState) {
          setPresence(processPresenceState(presenceState))
        }
        setConnectionStatus('connected')
      })
      .on('presence', { event: 'join' }, () => {
        const presenceState = channelRef.current?.presenceState()
        if (presenceState) {
          setPresence(processPresenceState(presenceState))
        }
      })
      .on('presence', { event: 'leave' }, () => {
        const presenceState = channelRef.current?.presenceState()
        if (presenceState) {
          setPresence(processPresenceState(presenceState))
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
    
    return () => {
      if (channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setConnectionStatus('disconnected')
    }
  }, [tournamentId])
  
  return {
    presence,
    connectionStatus
  }
}