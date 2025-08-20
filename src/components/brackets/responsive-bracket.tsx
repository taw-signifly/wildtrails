'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Match, Tournament } from '@/types'
import { BracketRendererProps, LayoutConfig } from '@/types/bracket'
import { LayoutCalculator } from '@/lib/brackets/layout-calculator'
import { SingleEliminationBracket } from './single-elimination'
import { BracketRenderer } from './bracket-renderer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ResponsiveBracketProps extends BracketRendererProps {
  enableFullscreen?: boolean
  enableMobileOptimizations?: boolean
  enableTouchGestures?: boolean
  mobileBreakpoint?: number
  tabletBreakpoint?: number
}

type ViewMode = 'auto' | 'mobile' | 'tablet' | 'desktop' | 'fullscreen'

export function ResponsiveBracket({
  tournament,
  matches,
  bracketStructure,
  enableFullscreen = true,
  enableMobileOptimizations = true,
  enableTouchGestures = true,
  mobileBreakpoint = 768,
  tabletBreakpoint = 1024,
  onMatchSelect,
  onTeamHighlight,
  className,
  ...props
}: ResponsiveBracketProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('auto')
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 })
  const [layout, setLayout] = useState<Partial<LayoutConfig>>({})

  // Memoize layout calculator to prevent recreation on every render
  const layoutCalculator = useMemo(() => new LayoutCalculator(), [])

  // Detect screen size and update view mode
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      setScreenSize({ width, height })

      if (viewMode === 'auto') {
        if (width < mobileBreakpoint) {
          setLayout(layoutCalculator.calculateResponsiveConfig(width, height, tournament.type))
        } else if (width < tabletBreakpoint) {
          setLayout(layoutCalculator.calculateResponsiveConfig(width, height, tournament.type))
        } else {
          setLayout(layoutCalculator.calculateResponsiveConfig(width, height, tournament.type))
        }
      }
    }

    updateScreenSize()
    window.addEventListener('resize', updateScreenSize)
    
    return () => window.removeEventListener('resize', updateScreenSize)
  }, [viewMode, mobileBreakpoint, tabletBreakpoint, tournament.type, layoutCalculator])

  // Handle fullscreen mode
  const toggleFullscreen = async () => {
    if (!enableFullscreen) return

    try {
      if (!isFullscreen) {
        await containerRef.current?.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen toggle failed:', err)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableTouchGestures) return
    const touch = e.touches[0]
    setTouchStartPos({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableTouchGestures) return
    // Touch move logic could be implemented here for custom pan/zoom
  }

  // Get current device type
  const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
    if (screenSize.width < mobileBreakpoint) return 'mobile'
    if (screenSize.width < tabletBreakpoint) return 'tablet'
    return 'desktop'
  }

  const deviceType = getDeviceType()
  const isMobile = deviceType === 'mobile'
  const isTablet = deviceType === 'tablet'

  // Mobile-optimized component
  const MobileBracketView = () => (
    <div className="space-y-4">
      {/* Mobile Tournament Header */}
      <Card className="p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{tournament.name}</h2>
          <p className="text-sm text-gray-600">
            {tournament.type.replace('-', ' ').toUpperCase()}
          </p>
          <div className="flex justify-center space-x-2 mt-2">
            <Badge variant="outline">{matches.length} matches</Badge>
            <Badge variant="outline">
              {matches.filter(m => m.status === 'completed').length} completed
            </Badge>
          </div>
        </div>
      </Card>

      {/* Compact bracket view */}
      <Card className="p-2">
        <div className="h-96 overflow-auto">
          <BracketRenderer
            tournament={tournament}
            matches={matches}
            bracketStructure={bracketStructure}
            layout={layout as LayoutConfig}
            compact={true}
            theme="minimal"
            showControls={false}
            onMatchSelect={onMatchSelect}
            onTeamHighlight={onTeamHighlight}
            {...props}
          />
        </div>
      </Card>

      {/* Mobile match list */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Matches by Round</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Array.from(new Set(matches.map(m => m.round)))
            .sort((a, b) => a - b)
            .map(round => (
              <div key={round}>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Round {round}
                </h4>
                <div className="space-y-2 pl-2">
                  {matches
                    .filter(m => m.round === round)
                    .map(match => (
                      <div
                        key={match.id}
                        className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                        onClick={() => onMatchSelect?.(match)}
                      >
                        <div className="text-sm font-medium">
                          {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                        </div>
                        <div className="text-xs text-gray-600 flex justify-between">
                          <span>{match.status}</span>
                          {match.score && (
                            <span>{match.score.team1} - {match.score.team2}</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )

  // Tablet-optimized component
  const TabletBracketView = () => (
    <div className="space-y-4">
      {/* Tablet header with controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{tournament.name}</h2>
          <p className="text-sm text-gray-600">
            {tournament.type.replace('-', ' ').toUpperCase()} • {matches.length} matches
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'auto' ? 'desktop' : 'auto')}
          >
            {viewMode === 'auto' ? 'Fixed View' : 'Auto View'}
          </Button>
          {enableFullscreen && (
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          )}
        </div>
      </div>

      {/* Tablet bracket view */}
      <Card>
        <div className="h-[500px]">
          {tournament.type === 'single-elimination' ? (
            <SingleEliminationBracket
              tournament={tournament}
              matches={matches}
              bracketStructure={bracketStructure}
              onMatchSelect={onMatchSelect}
              onTeamHighlight={onTeamHighlight}
              {...props}
            />
          ) : (
            <BracketRenderer
              tournament={tournament}
              matches={matches}
              bracketStructure={bracketStructure}
              layout={layout as LayoutConfig}
              onMatchSelect={onMatchSelect}
              onTeamHighlight={onTeamHighlight}
              {...props}
            />
          )}
        </div>
      </Card>
    </div>
  )

  // Desktop component
  const DesktopBracketView = () => (
    <div className="space-y-4">
      {/* Desktop controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">{tournament.name}</h2>
          <Badge variant="outline">
            {tournament.type.replace('-', ' ').toUpperCase()}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'auto' ? 'tablet' : 'auto')}
          >
            Tablet View
          </Button>
          {enableFullscreen && (
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          )}
        </div>
      </div>

      {/* Full desktop bracket */}
      <div className={cn("min-h-[600px]", isFullscreen && "h-screen")}>
        {tournament.type === 'single-elimination' ? (
          <SingleEliminationBracket
            tournament={tournament}
            matches={matches}
            bracketStructure={bracketStructure}
            onMatchSelect={onMatchSelect}
            onTeamHighlight={onTeamHighlight}
            {...props}
          />
        ) : (
          <BracketRenderer
            tournament={tournament}
            matches={matches}
            bracketStructure={bracketStructure}
            layout={layout as LayoutConfig}
            onMatchSelect={onMatchSelect}
            onTeamHighlight={onTeamHighlight}
            {...props}
          />
        )}
      </div>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full',
        isFullscreen && 'bg-white p-4',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black text-white text-xs p-2 rounded opacity-75 z-50">
          {deviceType} • {screenSize.width}x{screenSize.height} • {viewMode}
        </div>
      )}

      {/* Render appropriate view based on device type */}
      {isMobile && enableMobileOptimizations ? (
        <MobileBracketView />
      ) : isTablet ? (
        <TabletBracketView />
      ) : (
        <DesktopBracketView />
      )}
    </div>
  )
}

export default ResponsiveBracket