import { Point, Size, ViewBox, LineDefinition, MatchPosition } from '@/types/bracket'

/**
 * SVG utility functions for bracket rendering
 */
export class SVGUtils {
  /**
   * Create an SVG path for connecting matches
   */
  static createConnectionPath(from: Point, to: Point, type: 'horizontal' | 'vertical' | 'curved' = 'curved'): string {
    switch (type) {
      case 'horizontal':
        return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
      
      case 'vertical':
        return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
      
      case 'curved':
        const midX = (from.x + to.x) / 2
        return `M ${from.x} ${from.y} Q ${midX} ${from.y} ${midX} ${(from.y + to.y) / 2} Q ${midX} ${to.y} ${to.x} ${to.y}`
      
      default:
        return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
    }
  }

  /**
   * Create connection lines for single elimination bracket
   */
  static createSingleEliminationConnections(positions: MatchPosition[]): LineDefinition[] {
    const lines: LineDefinition[] = []
    const rounds = this.groupPositionsByRound(positions)
    
    // Connect each round to the next
    for (let round = 1; round < Math.max(...Object.keys(rounds).map(Number)); round++) {
      const currentRound = rounds[round] || []
      const nextRound = rounds[round + 1] || []
      
      currentRound.forEach((position, index) => {
        const nextMatchIndex = Math.floor(index / 2)
        const nextMatch = nextRound[nextMatchIndex]
        
        if (nextMatch) {
          const fromPoint: Point = {
            x: position.position.x + position.size.width,
            y: position.position.y + position.size.height / 2
          }
          
          const toPoint: Point = {
            x: nextMatch.position.x,
            y: nextMatch.position.y + nextMatch.size.height / 2
          }
          
          lines.push({
            from: fromPoint,
            to: toPoint,
            type: 'curved'
          })
        }
      })
    }
    
    return lines
  }

  /**
   * Create connection lines for double elimination bracket
   */
  static createDoubleEliminationConnections(
    winnerPositions: MatchPosition[],
    loserPositions: MatchPosition[]
  ): LineDefinition[] {
    const lines: LineDefinition[] = []
    
    // Winner bracket connections
    lines.push(...this.createSingleEliminationConnections(winnerPositions))
    
    // Loser bracket connections
    lines.push(...this.createSingleEliminationConnections(loserPositions))
    
    // Cross-bracket connections (winner bracket losers to loser bracket)
    const winnerRounds = this.groupPositionsByRound(winnerPositions)
    const loserRounds = this.groupPositionsByRound(loserPositions)
    
    Object.keys(winnerRounds).forEach(roundStr => {
      const round = parseInt(roundStr)
      const winnerRound = winnerRounds[round]
      const correspondingLoserRound = loserRounds[round * 2] || loserRounds[round * 2 - 1]
      
      if (winnerRound && correspondingLoserRound) {
        winnerRound.forEach((winnerPosition, index) => {
          const loserPosition = correspondingLoserRound[index]
          if (loserPosition) {
            const fromPoint: Point = {
              x: winnerPosition.position.x + winnerPosition.size.width / 2,
              y: winnerPosition.position.y + winnerPosition.size.height
            }
            
            const toPoint: Point = {
              x: loserPosition.position.x + loserPosition.size.width / 2,
              y: loserPosition.position.y
            }
            
            lines.push({
              from: fromPoint,
              to: toPoint,
              type: 'curved',
              style: 'dashed'
            })
          }
        })
      }
    })
    
    return lines
  }

  /**
   * Calculate optimal viewBox for a set of match positions
   */
  static calculateViewBox(positions: MatchPosition[], padding: number = 50): ViewBox {
    if (positions.length === 0) {
      return { x: 0, y: 0, width: 800, height: 600 }
    }
    
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    
    positions.forEach(pos => {
      minX = Math.min(minX, pos.position.x)
      minY = Math.min(minY, pos.position.y)
      maxX = Math.max(maxX, pos.position.x + pos.size.width)
      maxY = Math.max(maxY, pos.position.y + pos.size.height)
    })
    
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    }
  }

  /**
   * Calculate responsive dimensions based on viewport
   */
  static calculateResponsiveDimensions(
    viewportWidth: number,
    viewportHeight: number,
    positions: MatchPosition[]
  ): { scale: number; translateX: number; translateY: number } {
    const viewBox = this.calculateViewBox(positions)
    const scaleX = viewportWidth / viewBox.width
    const scaleY = viewportHeight / viewBox.height
    const scale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond 100%
    
    const scaledWidth = viewBox.width * scale
    const scaledHeight = viewBox.height * scale
    
    const translateX = (viewportWidth - scaledWidth) / 2
    const translateY = (viewportHeight - scaledHeight) / 2
    
    return { scale, translateX, translateY }
  }

  /**
   * Generate CSS transform string for positioning
   */
  static createTransform(scale: number, translateX: number, translateY: number): string {
    return `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }

  /**
   * Check if a point is within a rectangle
   */
  static isPointInRect(point: Point, rect: { position: Point; size: Size }): boolean {
    return (
      point.x >= rect.position.x &&
      point.x <= rect.position.x + rect.size.width &&
      point.y >= rect.position.y &&
      point.y <= rect.position.y + rect.size.height
    )
  }

  /**
   * Find the match at a given point
   */
  static findMatchAtPoint(point: Point, positions: MatchPosition[]): MatchPosition | null {
    return positions.find(pos => this.isPointInRect(point, pos)) || null
  }

  /**
   * Generate round labels for different tournament formats
   */
  static generateRoundLabels(totalRounds: number, format: 'single' | 'double'): string[] {
    const labels: string[] = []
    
    if (format === 'single') {
      for (let round = 1; round <= totalRounds; round++) {
        if (round === totalRounds) {
          labels.push('Final')
        } else if (round === totalRounds - 1) {
          labels.push('Semifinal')
        } else if (round === totalRounds - 2) {
          labels.push('Quarterfinal')
        } else {
          labels.push(`Round ${round}`)
        }
      }
    } else {
      // Double elimination has more complex labeling
      for (let round = 1; round <= totalRounds; round++) {
        labels.push(`Round ${round}`)
      }
    }
    
    return labels
  }

  /**
   * Create animation keyframes for winner advancement
   */
  static createAdvancementAnimation(from: Point, to: Point, duration: number = 1000): string {
    return `
      @keyframes advance-winner {
        0% {
          transform: translate(${from.x}px, ${from.y}px);
          opacity: 1;
        }
        50% {
          transform: translate(${(from.x + to.x) / 2}px, ${(from.y + to.y) / 2}px);
          opacity: 0.5;
        }
        100% {
          transform: translate(${to.x}px, ${to.y}px);
          opacity: 1;
        }
      }
    `
  }

  /**
   * Group match positions by round for easier processing
   */
  private static groupPositionsByRound(positions: MatchPosition[]): Record<number, MatchPosition[]> {
    return positions.reduce((groups, position) => {
      const round = position.round
      if (!groups[round]) {
        groups[round] = []
      }
      groups[round].push(position)
      return groups
    }, {} as Record<number, MatchPosition[]>)
  }

  /**
   * Calculate the center point of a match position
   */
  static getMatchCenter(position: MatchPosition): Point {
    return {
      x: position.position.x + position.size.width / 2,
      y: position.position.y + position.size.height / 2
    }
  }

  /**
   * Create a rounded rectangle path
   */
  static createRoundedRect(x: number, y: number, width: number, height: number, radius: number): string {
    return `M ${x + radius} ${y} 
            L ${x + width - radius} ${y} 
            Q ${x + width} ${y} ${x + width} ${y + radius}
            L ${x + width} ${y + height - radius} 
            Q ${x + width} ${y + height} ${x + width - radius} ${y + height}
            L ${x + radius} ${y + height} 
            Q ${x} ${y + height} ${x} ${y + height - radius}
            L ${x} ${y + radius} 
            Q ${x} ${y} ${x + radius} ${y} Z`
  }

  /**
   * Export SVG as string for download
   */
  static exportSVGAsString(svgElement: SVGElement): string {
    const serializer = new XMLSerializer()
    return serializer.serializeToString(svgElement)
  }
}