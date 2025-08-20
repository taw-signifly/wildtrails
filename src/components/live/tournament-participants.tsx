'use client'

import React, { useState, useEffect } from 'react'
import { useTournamentPresence, useOfficialPresence } from '@/hooks/use-tournament-presence'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface TournamentParticipantsProps {
  tournamentId: string | null
  userInfo?: {
    userId: string
    name: string
    role: 'player' | 'official' | 'spectator' | 'organizer'
    avatar?: string
  }
  showControls?: boolean
  compact?: boolean
  className?: string
}

export function TournamentParticipants({
  tournamentId,
  userInfo,
  showControls = false,
  compact = false,
  className = ''
}: TournamentParticipantsProps) {
  const [selectedRole, setSelectedRole] = useState<'all' | 'player' | 'official' | 'spectator' | 'organizer'>('all')
  const [showOfflineUsers, setShowOfflineUsers] = useState(false)

  const {
    activeUsers,
    totalUsers,
    usersByRole,
    isConnected,
    error,
    connect,
    disconnect,
    updateUserRole,
    broadcastUserAction
  } = useTournamentPresence(tournamentId, {
    autoConnect: !!tournamentId && !!userInfo,
    onUserJoin: (user) => {
      console.log('User joined tournament:', user.name)
      if (user.role === 'official' || user.role === 'organizer') {
        broadcastUserAction('official_joined', { userName: user.name, role: user.role })
      }
    },
    onUserLeave: (user) => {
      console.log('User left tournament:', user.name)
    }
  })

  // Connect with user info when available
  useEffect(() => {
    if (tournamentId && userInfo && !isConnected) {
      connect(userInfo)
    }

    return () => {
      if (isConnected) {
        disconnect()
      }
    }
  }, [tournamentId, userInfo, isConnected, connect, disconnect])

  if (!tournamentId) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">
          No tournament selected
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`p-4 border-red-200 bg-red-50 ${className}`}>
        <div className="text-center text-red-600">
          <p className="font-medium">Connection Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    )
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'organizer': return 'bg-purple-100 text-purple-800'
      case 'official': return 'bg-blue-100 text-blue-800'
      case 'player': return 'bg-green-100 text-green-800'
      case 'spectator': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getOnlineStatus = (lastSeen: string) => {
    const lastSeenTime = new Date(lastSeen).getTime()
    const now = new Date().getTime()
    const diffMinutes = (now - lastSeenTime) / (1000 * 60)

    if (diffMinutes < 1) return 'online'
    if (diffMinutes < 5) return 'away'
    return 'offline'
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const filteredUsers = selectedRole === 'all' 
    ? activeUsers
    : activeUsers.filter(user => user.role === selectedRole)

  const visibleUsers = showOfflineUsers 
    ? filteredUsers
    : filteredUsers.filter(user => getOnlineStatus(user.lastSeen) !== 'offline')

  if (compact) {
    return (
      <Card className={`p-3 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Participants</h4>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        
        <div className="text-2xl font-bold mb-2">{totalUsers}</div>
        
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>Players: {usersByRole.player?.length || 0}</div>
          <div>Officials: {(usersByRole.official?.length || 0) + (usersByRole.organizer?.length || 0)}</div>
          <div>Spectators: {usersByRole.spectator?.length || 0}</div>
          <div>Online: {visibleUsers.length}</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Tournament Participants</h3>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{totalUsers}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{usersByRole.player?.length || 0}</div>
          <div className="text-sm text-gray-600">Players</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {(usersByRole.official?.length || 0) + (usersByRole.organizer?.length || 0)}
          </div>
          <div className="text-sm text-gray-600">Officials</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">{usersByRole.spectator?.length || 0}</div>
          <div className="text-sm text-gray-600">Spectators</div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'organizer', 'official', 'player', 'spectator'].map((role) => (
          <Button
            key={role}
            variant={selectedRole === role ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRole(role as any)}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
            {role === 'all' ? ` (${totalUsers})` : ` (${usersByRole[role as keyof typeof usersByRole]?.length || 0})`}
          </Button>
        ))}
      </div>

      {/* Toggle offline users */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOfflineUsers(!showOfflineUsers)}
        >
          {showOfflineUsers ? 'Hide' : 'Show'} Offline Users
        </Button>
      </div>

      {/* Users List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {visibleUsers.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            {selectedRole === 'all' ? 'No participants' : `No ${selectedRole}s`} online
          </div>
        ) : (
          visibleUsers.map((user) => {
            const status = getOnlineStatus(user.lastSeen)
            
            return (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusDot(status)}`} />
                  </div>
                  
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">
                      {status === 'online' ? 'Online' : status === 'away' ? 'Away' : 'Offline'}
                      {status !== 'online' && (
                        <span className="ml-1">
                          ({Math.round((new Date().getTime() - new Date(user.lastSeen).getTime()) / (1000 * 60))}m ago)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getRoleColor(user.role)}>
                    {user.role}
                  </Badge>
                  
                  {showControls && userInfo?.role === 'organizer' && user.userId !== userInfo.userId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Handle role change or user management
                        console.log('Manage user:', user.userId)
                      }}
                    >
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Current User Role Controls */}
      {showControls && userInfo && isConnected && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              You are logged in as: <Badge className={getRoleColor(userInfo.role)}>{userInfo.role}</Badge>
            </div>
            
            {userInfo.role !== 'organizer' && (
              <div className="flex gap-2">
                {userInfo.role !== 'official' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUserRole('official')}
                  >
                    Become Official
                  </Button>
                )}
                
                {userInfo.role !== 'spectator' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUserRole('spectator')}
                  >
                    Become Spectator
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// Simple participant count component
export function ParticipantCount({ 
  tournamentId, 
  className = '' 
}: { 
  tournamentId: string | null
  className?: string 
}) {
  const { totalUsers, usersByRole, isConnected } = useTournamentPresence(tournamentId, {
    autoConnect: false
  })

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="text-sm font-medium">{totalUsers} participants</span>
      <span className="text-xs text-gray-500">
        ({usersByRole.player?.length || 0} players, {(usersByRole.official?.length || 0) + (usersByRole.organizer?.length || 0)} officials)
      </span>
    </div>
  )
}

// Official presence indicator for tournament organizers
export function OfficialPresence({ 
  tournamentId,
  officialInfo,
  className = ''
}: {
  tournamentId: string | null
  officialInfo: { userId: string; name: string; avatar?: string }
  className?: string
}) {
  const { officials, organizers, isConnected, totalOfficials } = useOfficialPresence(
    tournamentId,
    officialInfo
  )

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">Officials Online</h4>
        <div className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">{totalOfficials}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {[...organizers, ...officials].map((official) => (
          <div key={official.userId} className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
              {official.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <span className="font-medium">{official.name}</span>
              <Badge className={`ml-2 ${getRoleColor(official.role)}`} size="sm">
                {official.role}
              </Badge>
            </div>
          </div>
        ))}
        
        {totalOfficials === 0 && (
          <div className="text-sm text-gray-500">No officials online</div>
        )}
      </div>
    </Card>
  )
}

function getRoleColor(role: string) {
  switch (role) {
    case 'organizer': return 'bg-purple-100 text-purple-800'
    case 'official': return 'bg-blue-100 text-blue-800'
    case 'player': return 'bg-green-100 text-green-800'
    case 'spectator': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}