'use client'

import { Match, Team } from '@/types'
import { MatchNodeProps } from '@/types/bracket'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface ExtendedMatchNodeProps extends MatchNodeProps {
  showScores?: boolean
  showStatus?: boolean
  compact?: boolean
  theme?: 'default' | 'minimal' | 'colorful'
}

export function MatchNode({
  match,
  position,
  size,
  interactive = true,
  selected = false,
  highlighted = false,
  showScores = true,
  showStatus = true,
  compact = false,
  theme = 'default',
  onClick,
  onHover
}: ExtendedMatchNodeProps) {
  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-gray-100 border-gray-300'
      case 'active': return 'bg-blue-50 border-blue-300'
      case 'completed': return 'bg-green-50 border-green-300'
      case 'cancelled': return 'bg-red-50 border-red-300'
      default: return 'bg-gray-100 border-gray-300'
    }
  }

  const getStatusBadgeColor = (status: Match['status']) => {
    switch (status) {
      case 'scheduled': return 'secondary'
      case 'active': return 'default'
      case 'completed': return 'outline'
      case 'cancelled': return 'destructive'
      default: return 'secondary'
    }
  }

  const getWinnerHighlight = (teamId: string) => {
    if (match.status !== 'completed' || !match.winner) return ''
    return match.winner === teamId ? 'font-semibold text-green-700' : 'text-gray-600'
  }

  const getTeamDisplay = (team: Team) => {
    if (!team.id) {
      return { name: 'TBD', players: [] }
    }
    
    const name = team.name || 'Team'
    const players = team.players || []
    
    return { name, players }
  }

  const team1Display = getTeamDisplay(match.team1)
  const team2Display = getTeamDisplay(match.team2)

  const containerStyle = {
    position: 'absolute' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
  }

  const baseClasses = cn(
    'transition-all duration-200',
    getStatusColor(match.status),
    {
      'cursor-pointer hover:shadow-md': interactive,
      'ring-2 ring-blue-500 ring-offset-2': selected,
      'bg-yellow-50 border-yellow-300': highlighted,
      'shadow-lg': selected || highlighted,
    }
  )

  const handleClick = () => {
    if (interactive && onClick) {
      onClick()
    }
  }

  const handleMouseEnter = () => {
    onHover?.(true)
  }

  const handleMouseLeave = () => {
    onHover?.(false)
  }

  if (theme === 'minimal') {
    return (
      <div
        style={containerStyle}
        className={cn(
          'border rounded-md p-2 bg-white text-xs',
          baseClasses
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={`Match between ${team1Display.name} and ${team2Display.name}`}
      >
        <div className="space-y-1">
          <div className={cn('truncate', getWinnerHighlight(match.team1.id || ''))}>
            {team1Display.name}
            {showScores && match.score && (
              <span className="ml-2 font-medium">
                {match.score.team1}
              </span>
            )}
          </div>
          <hr className="border-gray-300" />
          <div className={cn('truncate', getWinnerHighlight(match.team2.id || ''))}>
            {team2Display.name}
            {showScores && match.score && (
              <span className="ml-2 font-medium">
                {match.score.team2}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <Card
        style={containerStyle}
        className={cn('p-2 text-xs', baseClasses)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={`Match between ${team1Display.name} and ${team2Display.name}`}
      >
        <div className="space-y-1">
          <div className={cn('flex justify-between items-center', getWinnerHighlight(match.team1.id || ''))}>
            <span className="truncate flex-1">{team1Display.name}</span>
            {showScores && match.score && (
              <span className="ml-2 font-medium">{match.score.team1}</span>
            )}
          </div>
          <div className={cn('flex justify-between items-center', getWinnerHighlight(match.team2.id || ''))}>
            <span className="truncate flex-1">{team2Display.name}</span>
            {showScores && match.score && (
              <span className="ml-2 font-medium">{match.score.team2}</span>
            )}
          </div>
          {showStatus && (
            <div className="flex justify-center">
              <Badge variant={getStatusBadgeColor(match.status)} className="text-xs px-1 py-0">
                {match.status}
              </Badge>
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card
      style={containerStyle}
      className={cn('p-3', baseClasses)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`Match between ${team1Display.name} and ${team2Display.name}`}
    >
      <div className="h-full flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          {match.roundName && (
            <span className="text-xs text-gray-500 font-medium">
              {match.roundName}
            </span>
          )}
          {showStatus && (
            <Badge variant={getStatusBadgeColor(match.status)} className="text-xs">
              {match.status}
            </Badge>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-2 flex-1">
          {/* Team 1 */}
          <div className={cn('flex justify-between items-center', getWinnerHighlight(match.team1.id || ''))}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {team1Display.name}
              </div>
              {!compact && team1Display.players.length > 0 && (
                <div className="text-xs text-gray-500 truncate">
                  {team1Display.players.slice(0, 2).join(', ')}
                  {team1Display.players.length > 2 && '...'}
                </div>
              )}
            </div>
            {showScores && match.score && (
              <div className="ml-2 text-lg font-bold">
                {match.score.team1}
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Team 2 */}
          <div className={cn('flex justify-between items-center', getWinnerHighlight(match.team2.id || ''))}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {team2Display.name}
              </div>
              {!compact && team2Display.players.length > 0 && (
                <div className="text-xs text-gray-500 truncate">
                  {team2Display.players.slice(0, 2).join(', ')}
                  {team2Display.players.length > 2 && '...'}
                </div>
              )}
            </div>
            {showScores && match.score && (
              <div className="ml-2 text-lg font-bold">
                {match.score.team2}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {(match.courtId || match.scheduledTime) && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
            <div className="flex justify-between">
              {match.courtId && <span>Court {match.courtId}</span>}
              {match.scheduledTime && (
                <span>
                  {new Date(match.scheduledTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default MatchNode