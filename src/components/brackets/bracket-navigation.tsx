'use client'

import React, { useState } from 'react'
import { Match } from '@/types'
import { BracketNavigationProps, BracketViewState, NavigationControls } from '@/types/bracket'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ExtendedBracketNavigationProps extends BracketNavigationProps {
  matches?: Match[]
  tournament?: any
  onRoundSelect?: (round: number) => void
  onMatchSearch?: (query: string) => void
  onExport?: (format: 'png' | 'svg' | 'pdf') => void
}

export function BracketNavigation({
  viewState,
  controls,
  bounds,
  showMinimap = true,
  allowFullscreen = true,
  matches = [],
  tournament,
  onRoundSelect,
  onMatchSearch,
  onExport
}: ExtendedBracketNavigationProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState<'controls' | 'rounds' | 'search'>('controls')

  // Calculate tournament statistics
  const totalRounds = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0
  const completedMatches = matches.filter(m => m.status === 'completed')
  const activeMatches = matches.filter(m => m.status === 'active')
  const currentRound = activeMatches.length > 0 
    ? Math.min(...activeMatches.map(m => m.round))
    : totalRounds

  const handleZoomIn = () => controls.zoomIn()
  const handleZoomOut = () => controls.zoomOut()
  const handleResetView = () => controls.resetView()
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onMatchSearch?.(searchQuery)
  }

  const getRoundProgress = (round: number) => {
    const roundMatches = matches.filter(m => m.round === round)
    const completedRoundMatches = roundMatches.filter(m => m.status === 'completed')
    return roundMatches.length > 0 ? completedRoundMatches.length / roundMatches.length : 0
  }

  const getRoundLabel = (round: number) => {
    if (tournament?.type === 'single-elimination') {
      if (round === totalRounds) return 'Final'
      if (round === totalRounds - 1) return 'Semifinal'
      if (round === totalRounds - 2) return 'Quarterfinal'
    }
    return `Round ${round}`
  }

  if (isMinimized) {
    return (
      <Card className="fixed top-4 right-4 z-40 p-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(false)}
            title="Expand Controls"
          >
            ⚙️
          </Button>
          <div className="text-xs text-gray-600">
            {Math.round(viewState.scale * 100)}%
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="fixed top-4 right-4 z-40 w-80 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b">
        <h3 className="font-semibold text-sm">Bracket Controls</h3>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            ―
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('controls')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'controls'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Controls
        </button>
        {totalRounds > 0 && (
          <button
            onClick={() => setActiveTab('rounds')}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'rounds'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Rounds
          </button>
        )}
        {matches.length > 0 && (
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'search'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Search
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 max-h-72 overflow-y-auto">
        {/* Controls Tab */}
        {activeTab === 'controls' && (
          <div className="space-y-4">
            {/* Zoom Controls */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Zoom ({Math.round(viewState.scale * 100)}%)
              </label>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={viewState.scale <= 0.1}
                  title="Zoom Out"
                >
                  −
                </Button>
                <div className="flex-1 flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(viewState.scale * 50, 100)}%` }}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={viewState.scale >= 3}
                  title="Zoom In"
                >
                  +
                </Button>
              </div>
            </div>

            {/* View Controls */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetView}
                className="w-full"
              >
                Reset View
              </Button>
              {allowFullscreen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFullscreen}
                  className="w-full"
                >
                  Fullscreen
                </Button>
              )}
            </div>

            {/* Export Options */}
            {onExport && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-2">
                  Export Bracket
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport('png')}
                    className="text-xs"
                  >
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport('svg')}
                    className="text-xs"
                  >
                    SVG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport('pdf')}
                    className="text-xs"
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rounds Tab */}
        {activeTab === 'rounds' && totalRounds > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 mb-3">
              Navigate to specific tournament rounds
            </div>
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => {
              const progress = getRoundProgress(round)
              const isCurrentRound = round === currentRound
              const roundMatches = matches.filter(m => m.round === round)
              
              return (
                <div
                  key={round}
                  className={cn(
                    'p-2 rounded-lg border cursor-pointer transition-all hover:bg-gray-50',
                    isCurrentRound && 'bg-blue-50 border-blue-200'
                  )}
                  onClick={() => onRoundSelect?.(round)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">
                        {getRoundLabel(round)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {roundMatches.length} matches
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-gray-600">
                        {Math.round(progress * 100)}%
                      </div>
                      {isCurrentRound && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && matches.length > 0 && (
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search teams or matches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button type="submit" size="sm" className="w-full">
                  Search
                </Button>
              </div>
            </form>

            {/* Quick filters */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Quick Filters
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMatchSearch?.('status:active')}
                  className="text-xs"
                >
                  Active Matches
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMatchSearch?.('status:completed')}
                  className="text-xs"
                >
                  Completed
                </Button>
              </div>
            </div>

            {/* Recent searches or suggestions could go here */}
          </div>
        )}
      </div>

      {/* Minimap */}
      {showMinimap && activeTab === 'controls' && (
        <div className="border-t p-2">
          <div className="text-xs font-medium text-gray-700 mb-2">Minimap</div>
          <div className="bg-gray-100 rounded h-16 flex items-center justify-center">
            <span className="text-xs text-gray-500">Minimap placeholder</span>
          </div>
        </div>
      )}
    </Card>
  )
}

export default BracketNavigation