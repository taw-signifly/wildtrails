import { Match, TournamentType } from '@/types'
import { MatchPosition, RoundPosition, LayoutConfig, Point, Size } from '@/types/bracket'

/**
 * Layout calculator for different tournament bracket formats
 */
export class LayoutCalculator {
  private defaultConfig: LayoutConfig = {
    format: 'single-elimination',
    matchWidth: 200,
    matchHeight: 80,
    horizontalSpacing: 120,
    verticalSpacing: 40,
    roundSpacing: 320,
    padding: 50
  }

  /**
   * Calculate layout for single elimination bracket
   */
  calculateSingleEliminationLayout(matches: Match[], config?: Partial<LayoutConfig>): MatchPosition[] {
    const finalConfig = { ...this.defaultConfig, ...config }
    const positions: MatchPosition[] = []
    const rounds = this.groupMatchesByRound(matches)
    const maxRound = Math.max(...Object.keys(rounds).map(Number))
    
    Object.keys(rounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const roundMatches = rounds[round].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
      const matchesInRound = roundMatches.length
      
      // Calculate vertical positioning for this round
      const totalHeight = matchesInRound * finalConfig.matchHeight + (matchesInRound - 1) * finalConfig.verticalSpacing
      const startY = finalConfig.padding + (maxRound > 1 ? this.calculateVerticalOffset(round, maxRound, finalConfig) : 0)
      
      roundMatches.forEach((match, index) => {
        const position: Point = {
          x: finalConfig.padding + (round - 1) * finalConfig.roundSpacing,
          y: startY + index * (finalConfig.matchHeight + finalConfig.verticalSpacing) * Math.pow(2, round - 1)
        }
        
        const size: Size = {
          width: finalConfig.matchWidth,
          height: finalConfig.matchHeight
        }
        
        positions.push({
          match,
          position,
          size,
          round,
          index
        })
      })
    })
    
    return positions
  }

  /**
   * Calculate layout for double elimination bracket
   */
  calculateDoubleEliminationLayout(
    winnerMatches: Match[],
    loserMatches: Match[],
    config?: Partial<LayoutConfig>
  ): { winner: MatchPosition[]; loser: MatchPosition[] } {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    // Calculate winner bracket positions (top half)
    const winnerPositions = this.calculateSingleEliminationLayout(winnerMatches, {
      ...finalConfig,
      padding: finalConfig.padding
    })
    
    // Calculate loser bracket positions (bottom half)
    const winnerHeight = this.calculateBracketHeight(winnerPositions)
    const loserPositions = this.calculateSingleEliminationLayout(loserMatches, {
      ...finalConfig,
      padding: finalConfig.padding + winnerHeight + finalConfig.verticalSpacing * 2
    })
    
    return {
      winner: winnerPositions,
      loser: loserPositions
    }
  }

  /**
   * Calculate layout for Swiss system display
   */
  calculateSwissSystemLayout(matches: Match[], config?: Partial<LayoutConfig>): MatchPosition[] {
    const finalConfig = { ...this.defaultConfig, ...config }
    const positions: MatchPosition[] = []
    const rounds = this.groupMatchesByRound(matches)
    
    Object.keys(rounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const roundMatches = rounds[round]
      
      roundMatches.forEach((match, index) => {
        const position: Point = {
          x: finalConfig.padding + (round - 1) * finalConfig.roundSpacing,
          y: finalConfig.padding + index * (finalConfig.matchHeight + finalConfig.verticalSpacing)
        }
        
        const size: Size = {
          width: finalConfig.matchWidth,
          height: finalConfig.matchHeight
        }
        
        positions.push({
          match,
          position,
          size,
          round,
          index
        })
      })
    })
    
    return positions
  }

  /**
   * Calculate layout for round-robin display
   */
  calculateRoundRobinLayout(matches: Match[], config?: Partial<LayoutConfig>): MatchPosition[] {
    const finalConfig = { ...this.defaultConfig, ...config }
    const positions: MatchPosition[] = []
    
    // For round-robin, we can display matches in a grid or list format
    // Here we'll use a list format organized by round
    const rounds = this.groupMatchesByRound(matches)
    
    Object.keys(rounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const roundMatches = rounds[round]
      
      // Calculate grid layout for matches within a round
      const matchesPerRow = Math.ceil(Math.sqrt(roundMatches.length))
      
      roundMatches.forEach((match, index) => {
        const row = Math.floor(index / matchesPerRow)
        const col = index % matchesPerRow
        
        const position: Point = {
          x: finalConfig.padding + col * (finalConfig.matchWidth + finalConfig.horizontalSpacing),
          y: finalConfig.padding + (round - 1) * 200 + row * (finalConfig.matchHeight + finalConfig.verticalSpacing)
        }
        
        const size: Size = {
          width: finalConfig.matchWidth,
          height: finalConfig.matchHeight
        }
        
        positions.push({
          match,
          position,
          size,
          round,
          index
        })
      })
    })
    
    return positions
  }

  /**
   * Calculate layout for barrage format
   */
  calculateBarrageLayout(matches: Match[], config?: Partial<LayoutConfig>): MatchPosition[] {
    const finalConfig = { ...this.defaultConfig, ...config }
    const positions: MatchPosition[] = []
    const rounds = this.groupMatchesByRound(matches)
    
    // Barrage format has a more complex layout showing qualification paths
    Object.keys(rounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const roundMatches = rounds[round]
      
      roundMatches.forEach((match, index) => {
        const position: Point = {
          x: finalConfig.padding + (round - 1) * finalConfig.roundSpacing,
          y: finalConfig.padding + index * (finalConfig.matchHeight + finalConfig.verticalSpacing)
        }
        
        const size: Size = {
          width: finalConfig.matchWidth,
          height: finalConfig.matchHeight
        }
        
        positions.push({
          match,
          position,
          size,
          round,
          index
        })
      })
    })
    
    return positions
  }

  /**
   * Calculate responsive layout configuration based on viewport
   */
  calculateResponsiveConfig(
    viewportWidth: number,
    viewportHeight: number,
    format: TournamentType
  ): LayoutConfig {
    const baseConfig = { ...this.defaultConfig, format }
    
    if (viewportWidth < 768) {
      // Mobile configuration
      return {
        ...baseConfig,
        matchWidth: 150,
        matchHeight: 60,
        horizontalSpacing: 80,
        verticalSpacing: 20,
        roundSpacing: 220,
        padding: 20
      }
    } else if (viewportWidth < 1024) {
      // Tablet configuration
      return {
        ...baseConfig,
        matchWidth: 180,
        matchHeight: 70,
        horizontalSpacing: 100,
        verticalSpacing: 30,
        roundSpacing: 270,
        padding: 30
      }
    } else {
      // Desktop configuration
      return baseConfig
    }
  }

  /**
   * Calculate round positions for navigation
   */
  calculateRoundPositions(matches: Match[]): RoundPosition[] {
    const rounds = this.groupMatchesByRound(matches)
    const positions: RoundPosition[] = []
    
    Object.keys(rounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const roundMatches = rounds[round]
      const matchCount = roundMatches.length
      
      const x = this.defaultConfig.padding + (round - 1) * this.defaultConfig.roundSpacing
      const y = this.defaultConfig.padding
      const spacing = this.defaultConfig.matchHeight + this.defaultConfig.verticalSpacing
      
      positions.push({
        round,
        x,
        y,
        matchCount,
        spacing
      })
    })
    
    return positions
  }

  /**
   * Calculate optimal zoom level for viewport
   */
  calculateOptimalZoom(
    positions: MatchPosition[],
    viewportWidth: number,
    viewportHeight: number
  ): number {
    if (positions.length === 0) return 1
    
    const bracketWidth = this.calculateBracketWidth(positions)
    const bracketHeight = this.calculateBracketHeight(positions)
    
    const scaleX = (viewportWidth * 0.9) / bracketWidth
    const scaleY = (viewportHeight * 0.9) / bracketHeight
    
    return Math.min(scaleX, scaleY, 1)
  }

  /**
   * Get layout configuration for specific tournament format
   */
  getLayoutForFormat(format: TournamentType): Partial<LayoutConfig> {
    switch (format) {
      case 'single-elimination':
        return {
          format,
          roundSpacing: 320,
          verticalSpacing: 40
        }
      
      case 'double-elimination':
        return {
          format,
          roundSpacing: 280,
          verticalSpacing: 30
        }
      
      case 'swiss':
        return {
          format,
          roundSpacing: 250,
          verticalSpacing: 20
        }
      
      case 'round-robin':
        return {
          format,
          roundSpacing: 300,
          verticalSpacing: 25
        }
      
      case 'barrage':
        return {
          format,
          roundSpacing: 280,
          verticalSpacing: 35
        }
      
      default:
        return { format }
    }
  }

  /**
   * Calculate bracket dimensions
   */
  calculateBracketDimensions(positions: MatchPosition[]): { width: number; height: number } {
    return {
      width: this.calculateBracketWidth(positions),
      height: this.calculateBracketHeight(positions)
    }
  }

  private groupMatchesByRound(matches: Match[]): Record<number, Match[]> {
    return matches.reduce((groups, match) => {
      const round = match.round
      if (!groups[round]) {
        groups[round] = []
      }
      groups[round].push(match)
      return groups
    }, {} as Record<number, Match[]>)
  }

  private calculateVerticalOffset(round: number, maxRound: number, config: LayoutConfig): number {
    // Calculate vertical offset for proper tree positioning
    const roundsFromEnd = maxRound - round
    return Math.pow(2, roundsFromEnd - 1) * (config.matchHeight + config.verticalSpacing) / 2
  }

  private calculateBracketWidth(positions: MatchPosition[]): number {
    if (positions.length === 0) return 0
    
    const maxX = Math.max(...positions.map(pos => pos.position.x + pos.size.width))
    const minX = Math.min(...positions.map(pos => pos.position.x))
    
    return maxX - minX
  }

  private calculateBracketHeight(positions: MatchPosition[]): number {
    if (positions.length === 0) return 0
    
    const maxY = Math.max(...positions.map(pos => pos.position.y + pos.size.height))
    const minY = Math.min(...positions.map(pos => pos.position.y))
    
    return maxY - minY
  }
}