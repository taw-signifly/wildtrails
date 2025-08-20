'use client'

import React, { useState } from 'react'
import { useTournamentPresenceDisplay } from '@/hooks/use-tournament-presence'
import { useActivePlayers, useCheckedInPlayers } from '@/stores/player-store'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export interface TournamentParticipantsProps {
  tournamentId: string | null
  showPresence?: boolean
  showPlayerStats?: boolean
  compact?: boolean
}

export function TournamentParticipants({
  tournamentId,
  showPresence = true,
  showPlayerStats = true,
  compact = false
}: TournamentParticipantsProps) {
  const [activeTab, setActiveTab] = useState('all')
  
  // Get presence data
  const { presence, connectionStatus } = useTournamentPresenceDisplay(tournamentId)
  
  // Get player data from store
  const activePlayers = useActivePlayers()
  const checkedInPlayers = useCheckedInPlayers()
  
  // Format time since joined
  const getTimeSince = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }
  
  // Get role badge variant
  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'organizer': return 'default'
      case 'official': return 'secondary'
      case 'player': return 'outline'
      default: return 'outline'
    }
  }
  
  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'organizer': return 'text-blue-600'
      case 'official': return 'text-green-600'
      case 'player': return 'text-gray-600'
      default: return 'text-gray-400'
    }
  }
  
  // Get user initials
  const getUserInitials = (displayName: string) => {
    return displayName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
  }
  
  if (compact) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Participants</h3>
          {showPresence && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <div className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-500'
              }`}></div>
              <span>{presence.totalUsers} online</span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          {showPresence && presence.activeUsers.slice(0, 5).map(user => (
            <div key={user.userId} className="flex items-center space-x-2 text-sm">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getUserInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{user.displayName}</span>
              <Badge variant={getRoleVariant(user.role)} className="text-xs py-0">
                {user.role}
              </Badge>
            </div>
          ))}
          
          {showPresence && presence.totalUsers > 5 && (
            <div className="text-xs text-gray-500 text-center pt-1">
              and {presence.totalUsers - 5} more...
            </div>
          )}
          
          {!showPresence && (
            <div className="text-sm text-gray-500">
              {activePlayers.length} active players
            </div>
          )}
        </div>
      </Card>
    )
  }
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Tournament Participants</h2>
        {showPresence && (
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {connectionStatus === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All {showPresence ? `(${presence.totalUsers})` : `(${activePlayers.length})`}
          </TabsTrigger>
          {showPresence && (
            <>
              <TabsTrigger value="officials">
                Officials ({presence.officials.length})
              </TabsTrigger>
              <TabsTrigger value="players">
                Players ({presence.players.length})
              </TabsTrigger>
              <TabsTrigger value="spectators">
                Spectators ({presence.spectators.length})
              </TabsTrigger>
            </>
          )}
          {!showPresence && (
            <>
              <TabsTrigger value="checkedIn">
                Checked In ({checkedInPlayers.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({activePlayers.length})
              </TabsTrigger>
              <TabsTrigger value="stats">
                Stats
              </TabsTrigger>
            </>
          )}
        </TabsList>
        
        {showPresence ? (
          <>
            <TabsContent value="all" className="mt-4">
              <ParticipantsList 
                users={presence.activeUsers} 
                showStats={showPlayerStats}
                showTime={true}
              />
            </TabsContent>
            
            <TabsContent value="officials" className="mt-4">
              <ParticipantsList 
                users={presence.officials} 
                showStats={showPlayerStats}
                showTime={true}
              />
            </TabsContent>
            
            <TabsContent value="players" className="mt-4">
              <ParticipantsList 
                users={presence.players} 
                showStats={showPlayerStats}
                showTime={true}
              />
            </TabsContent>
            
            <TabsContent value="spectators" className="mt-4">
              <ParticipantsList 
                users={presence.spectators} 
                showStats={showPlayerStats}
                showTime={true}
              />
            </TabsContent>
          </>
        ) : (
          <>
            <TabsContent value="all" className="mt-4">
              <PlayersList players={activePlayers} showStats={showPlayerStats} />
            </TabsContent>
            
            <TabsContent value="checkedIn" className="mt-4">
              <PlayersList players={checkedInPlayers} showStats={showPlayerStats} />
            </TabsContent>
            
            <TabsContent value="active" className="mt-4">
              <PlayersList players={activePlayers} showStats={showPlayerStats} />
            </TabsContent>
            
            <TabsContent value="stats" className="mt-4">
              <TournamentStats 
                activePlayers={activePlayers}
                checkedInPlayers={checkedInPlayers}
                presenceData={showPresence ? presence : null}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </Card>
  )
}

// Component for displaying presence users
function ParticipantsList({ 
  users, 
  showStats = true, 
  showTime = true 
}: { 
  users: any[]
  showStats?: boolean
  showTime?: boolean 
}) {
  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'organizer': return 'default'
      case 'official': return 'secondary'
      case 'player': return 'outline'
      default: return 'outline'
    }
  }
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'organizer': return 'text-blue-600'
      case 'official': return 'text-green-600'
      case 'player': return 'text-gray-600'
      default: return 'text-gray-400'
    }
  }
  
  const getUserInitials = (displayName: string) => {
    return displayName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
  }
  
  const getTimeSince = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }
  
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No participants in this category
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      {users.map(user => (
        <div key={user.userId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {getUserInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium">{user.displayName}</span>
              <Badge variant={getRoleVariant(user.role)}>
                {user.role}
              </Badge>
              {user.isActive && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
            </div>
            
            {showTime && (
              <div className="text-sm text-gray-500 mt-1">
                Joined {getTimeSince(user.joinedAt)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Component for displaying player data
function PlayersList({ 
  players, 
  showStats = true 
}: { 
  players: any[]
  showStats?: boolean 
}) {
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
  
  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No players in this category
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      {players.map(player => (
        <div key={player.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarImage src={player.avatar} />
            <AvatarFallback>
              {getUserInitials(player.firstName, player.lastName)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium">{player.displayName}</span>
              {player.club && (
                <Badge variant="outline">{player.club}</Badge>
              )}
            </div>
            
            {showStats && player.stats && (
              <div className="text-sm text-gray-500 mt-1">
                {player.stats.matchesPlayed} matches • {player.stats.winPercentage}% win rate
              </div>
            )}
          </div>
          
          <div className="text-right text-sm">
            <div className="text-gray-600">
              Format: {player.preferences.preferredFormat}
            </div>
            {player.ranking && (
              <div className="text-gray-500">
                Rank #{player.ranking}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Component for tournament statistics
function TournamentStats({
  activePlayers,
  checkedInPlayers,
  presenceData
}: {
  activePlayers: any[]
  checkedInPlayers: any[]
  presenceData: any
}) {
  const stats = [
    {
      label: 'Total Active Players',
      value: activePlayers.length,
      color: 'text-blue-600'
    },
    {
      label: 'Checked In Players',
      value: checkedInPlayers.length,
      color: 'text-green-600'
    },
    {
      label: 'Check-in Rate',
      value: activePlayers.length > 0 
        ? `${Math.round((checkedInPlayers.length / activePlayers.length) * 100)}%`
        : '0%',
      color: 'text-purple-600'
    }
  ]
  
  if (presenceData) {
    stats.push(
      {
        label: 'Online Users',
        value: presenceData.totalUsers,
        color: 'text-green-600'
      },
      {
        label: 'Officials Online',
        value: presenceData.officials.length,
        color: 'text-blue-600'
      },
      {
        label: 'Spectators Online',
        value: presenceData.spectators.length,
        color: 'text-gray-600'
      }
    )
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="p-4 text-center">
          <div className={`text-2xl font-bold ${stat.color} mb-1`}>
            {stat.value}
          </div>
          <div className="text-sm text-gray-500">
            {stat.label}
          </div>
        </Card>
      ))}
    </div>
  )
}