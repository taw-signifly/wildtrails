'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Match, Tournament } from '@/types'
import { BracketRendererProps, MatchPosition, BracketViewState, LineDefinition } from '@/types/bracket'
import { LayoutCalculator } from '@/lib/brackets/layout-calculator'
import { SVGUtils } from '@/lib/brackets/svg-utils'
import { MatchNode } from './match-node'
import { cn } from '@/lib/utils'

interface ExtendedBracketRendererProps extends BracketRendererProps {
  enableZoom?: boolean
  enablePan?: boolean
  showConnections?: boolean
  showRoundLabels?: boolean
  theme?: 'default' | 'minimal' | 'colorful'
  compact?: boolean
}

export function BracketRenderer({
  tournament,
  matches,
  bracketStructure,
  layout,
  interactive = true,
  showControls = true,
  enableZoom = true,
  enablePan = true,
  showConnections = true,
  showRoundLabels = true,
  theme = 'default',
  compact = false,
  onMatchSelect,
  onTeamHighlight,
  className
}: ExtendedBracketRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  
  const [viewState, setViewState] = useState<BracketViewState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    selectedMatch: undefined,
    highlightedTeam: undefined,
    showDetails: false
  })
  
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [positions, setPositions] = useState<MatchPosition[]>([])
  const [connections, setConnections] = useState<LineDefinition[]>([])

  // Memoize layout calculator to prevent recreation on every render
  const layoutCalculator = useMemo(() => new LayoutCalculator(), [])

  // Calculate positions and connections when matches change
  useEffect(() => {
    if (!matches.length) {
      setPositions([])
      setConnections([])
      return
    }

    let newPositions: MatchPosition[] = []
    let newConnections: LineDefinition[] = []

    const responsiveConfig = layoutCalculator.calculateResponsiveConfig(
      containerSize.width,
      containerSize.height,
      tournament.type
    )

    const finalLayout = { ...responsiveConfig, ...layout }

    // Calculate positions based on tournament type
    switch (tournament.type) {
      case 'single-elimination':
        newPositions = layoutCalculator.calculateSingleEliminationLayout(matches, finalLayout)
        if (showConnections) {
          newConnections = SVGUtils.createSingleEliminationConnections(newPositions)
        }
        break

      case 'double-elimination':
        // For double elimination, we need to separate winner and loser bracket matches
        const winnerMatches = matches.filter(m => m.bracketType === 'winner')
        const loserMatches = matches.filter(m => m.bracketType === 'loser')
        
        const doublePositions = layoutCalculator.calculateDoubleEliminationLayout(
          winnerMatches,
          loserMatches,
          finalLayout
        )
        
        newPositions = [...doublePositions.winner, ...doublePositions.loser]
        
        if (showConnections) {
          newConnections = SVGUtils.createDoubleEliminationConnections(
            doublePositions.winner,
            doublePositions.loser
          )
        }
        break

      case 'swiss':
        newPositions = layoutCalculator.calculateSwissSystemLayout(matches, finalLayout)
        break

      case 'round-robin':
        newPositions = layoutCalculator.calculateRoundRobinLayout(matches, finalLayout)
        break

      case 'barrage':
        newPositions = layoutCalculator.calculateBarrageLayout(matches, finalLayout)
        break

      default:
        newPositions = layoutCalculator.calculateSingleEliminationLayout(matches, finalLayout)
    }

    setPositions(newPositions)
    setConnections(newConnections)
  }, [matches, tournament.type, layout, containerSize, showConnections, layoutCalculator])

  // Calculate initial view state
  useEffect(() => {
    if (positions.length > 0 && containerRef.current) {
      const viewBox = SVGUtils.calculateViewBox(positions, 50)
      const optimalZoom = layoutCalculator.calculateOptimalZoom(
        positions,
        containerSize.width,
        containerSize.height
      )

      const responsive = SVGUtils.calculateResponsiveDimensions(
        containerSize.width,
        containerSize.height,
        positions
      )

      setViewState(prev => ({
        ...prev,
        scale: Math.min(optimalZoom, responsive.scale),
        translateX: responsive.translateX,
        translateY: responsive.translateY
      }))
    }
  }, [positions, containerSize, layoutCalculator])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle match selection
  const handleMatchClick = useCallback((match: Match) => {
    setViewState(prev => ({ 
      ...prev, 
      selectedMatch: match.id,
      showDetails: true 
    }))
    onMatchSelect?.(match)
  }, [onMatchSelect])

  // Handle team highlighting
  const handleTeamHighlight = useCallback((teamId: string) => {
    setViewState(prev => ({ 
      ...prev, 
      highlightedTeam: teamId 
    }))
    
    const team = matches
      .flatMap(m => [m.team1, m.team2])
      .filter(t => t !== undefined)
      .find(t => t.id === teamId)
    
    if (team) {
      onTeamHighlight?.(team)
    }
  }, [matches, onTeamHighlight])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (enableZoom) {
      setViewState(prev => ({ 
        ...prev, 
        scale: Math.min(prev.scale * 1.2, 3) 
      }))
    }
  }, [enableZoom])

  const handleZoomOut = useCallback(() => {
    if (enableZoom) {
      setViewState(prev => ({ 
        ...prev, 
        scale: Math.max(prev.scale / 1.2, 0.1) 
      }))
    }
  }, [enableZoom])

  const handleResetView = useCallback(() => {
    if (positions.length > 0) {
      const optimalZoom = layoutCalculator.calculateOptimalZoom(
        positions,
        containerSize.width,
        containerSize.height
      )

      const responsive = SVGUtils.calculateResponsiveDimensions(
        containerSize.width,
        containerSize.height,
        positions
      )

      setViewState(prev => ({
        ...prev,
        scale: Math.min(optimalZoom, responsive.scale),
        translateX: responsive.translateX,
        translateY: responsive.translateY,
        selectedMatch: undefined,
        highlightedTeam: undefined
      }))
    }
  }, [positions, containerSize, layoutCalculator])

  // Calculate SVG dimensions (memoized to prevent recalculation on every render)
  const bracketDimensions = useMemo(() => 
    layoutCalculator.calculateBracketDimensions(positions), 
    [layoutCalculator, positions]
  )
  const viewBox = useMemo(() => 
    SVGUtils.calculateViewBox(positions, 50), 
    [positions]
  )

  const svgTransform = `translate(${viewState.translateX}, ${viewState.translateY}) scale(${viewState.scale})`

  if (!matches.length) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-gray-50 rounded-lg', className)}>
        <div className="text-center text-gray-500">
          <p className="text-lg">No matches to display</p>
          <p className="text-sm">Tournament bracket will appear here once matches are created</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full bg-white rounded-lg overflow-hidden', className)}
    >
      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border p-2">
          <div className="flex space-x-2">
            <button
              onClick={handleZoomIn}
              disabled={!enableZoom || viewState.scale >= 3}
              className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              disabled={!enableZoom || viewState.scale <= 0.1}
              className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              title="Reset View"
            >
              ⌂
            </button>
          </div>
        </div>
      )}

      {/* SVG Container */}
      <div className="relative w-full h-full">
        {/* Connection lines */}
        {showConnections && connections.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform={svgTransform}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              
              {/* Grid background */}
              <rect 
                x={viewBox.x} 
                y={viewBox.y} 
                width={viewBox.width} 
                height={viewBox.height} 
                fill="url(#grid)" 
                opacity="0.5"
              />
              
              {/* Connection lines */}
              {connections.map((connection, index) => (
                <path
                  key={index}
                  d={SVGUtils.createConnectionPath(connection.from, connection.to, connection.type)}
                  stroke={connection.style === 'dashed' ? '#9ca3af' : '#6b7280'}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={connection.style === 'dashed' ? '5,5' : undefined}
                  opacity="0.8"
                />
              ))}
            </g>
          </svg>
        )}

        {/* Match nodes */}
        <div className="relative w-full h-full" style={{ transform: svgTransform }}>
          {positions.map(position => {
            const isSelected = viewState.selectedMatch === position.match.id
            const isHighlighted = 
              viewState.highlightedTeam === position.match.team1?.id ||
              viewState.highlightedTeam === position.match.team2?.id

            return (
              <MatchNode
                key={position.match.id}
                match={position.match}
                position={position.position}
                size={position.size}
                interactive={interactive}
                selected={isSelected}
                highlighted={isHighlighted}
                compact={compact}
                theme={theme}
                onClick={() => handleMatchClick(position.match)}
                onHover={(isHovered) => {
                  if (isHovered) {
                    handleTeamHighlight(position.match.team1?.id || '')
                  }
                }}
              />
            )
          })}
        </div>

        {/* Round labels */}
        {showRoundLabels && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Round labels implementation would go here */}
          </div>
        )}
      </div>
    </div>
  )
}

export default BracketRenderer