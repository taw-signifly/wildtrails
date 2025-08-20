import { SVGUtils } from '../svg-utils'
import { Point, MatchPosition } from '@/types/bracket'
import { Match, Team } from '@/types'

// Mock data
const mockTeam1: Team = {
  id: 'team-1',
  name: 'Team Alpha',
  players: [],
  tournamentId: 'tournament-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const mockTeam2: Team = {
  id: 'team-2',
  name: 'Team Beta',
  players: [],
  tournamentId: 'tournament-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const mockMatch: Match = {
  id: 'match-1',
  tournamentId: 'tournament-1',
  round: 1,
  roundName: 'Round 1',
  bracketType: 'winner',
  team1: mockTeam1,
  team2: mockTeam2,
  score: { team1: 0, team2: 0, isComplete: false },
  status: 'scheduled',
  ends: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const mockMatchPosition: MatchPosition = {
  match: mockMatch,
  position: { x: 100, y: 100 },
  size: { width: 200, height: 80 },
  round: 1,
  index: 0
}

describe('SVGUtils', () => {
  describe('createConnectionPath', () => {
    const from: Point = { x: 0, y: 0 }
    const to: Point = { x: 100, y: 100 }

    it('creates horizontal path correctly', () => {
      const path = SVGUtils.createConnectionPath(from, to, 'horizontal')
      expect(path).toBe('M 0 0 L 100 100')
    })

    it('creates vertical path correctly', () => {
      const path = SVGUtils.createConnectionPath(from, to, 'vertical')
      expect(path).toBe('M 0 0 L 100 100')
    })

    it('creates curved path correctly', () => {
      const path = SVGUtils.createConnectionPath(from, to, 'curved')
      expect(path).toContain('M 0 0 Q')
      expect(path).toContain('100 100')
    })

    it('defaults to straight line for unknown type', () => {
      const path = SVGUtils.createConnectionPath(from, to)
      expect(path).toContain('M 0 0')
      expect(path).toContain('100 100')
    })
  })

  describe('createSingleEliminationConnections', () => {
    it('creates connections between rounds', () => {
      const round1Match1: MatchPosition = {
        ...mockMatchPosition,
        match: { ...mockMatch, id: 'match-1', round: 1 },
        position: { x: 0, y: 0 },
        round: 1,
        index: 0
      }

      const round1Match2: MatchPosition = {
        ...mockMatchPosition,
        match: { ...mockMatch, id: 'match-2', round: 1 },
        position: { x: 0, y: 100 },
        round: 1,
        index: 1
      }

      const round2Match: MatchPosition = {
        ...mockMatchPosition,
        match: { ...mockMatch, id: 'match-3', round: 2 },
        position: { x: 300, y: 50 },
        round: 2,
        index: 0
      }

      const positions = [round1Match1, round1Match2, round2Match]
      const connections = SVGUtils.createSingleEliminationConnections(positions)

      expect(connections).toHaveLength(2)
      expect(connections[0].from.x).toBe(200) // match width
      expect(connections[0].to.x).toBe(300) // next round x
      expect(connections[0].type).toBe('curved')
    })

    it('returns empty array for no positions', () => {
      const connections = SVGUtils.createSingleEliminationConnections([])
      expect(connections).toHaveLength(0)
    })
  })

  describe('calculateViewBox', () => {
    it('calculates viewBox for single position', () => {
      const positions = [mockMatchPosition]
      const viewBox = SVGUtils.calculateViewBox(positions, 50)

      expect(viewBox.x).toBe(50) // position.x - padding
      expect(viewBox.y).toBe(50) // position.y - padding
      expect(viewBox.width).toBe(300) // size.width + 2 * padding
      expect(viewBox.height).toBe(180) // size.height + 2 * padding
    })

    it('calculates viewBox for multiple positions', () => {
      const position1: MatchPosition = {
        ...mockMatchPosition,
        position: { x: 0, y: 0 }
      }

      const position2: MatchPosition = {
        ...mockMatchPosition,
        position: { x: 400, y: 200 }
      }

      const positions = [position1, position2]
      const viewBox = SVGUtils.calculateViewBox(positions, 25)

      expect(viewBox.x).toBe(-25)
      expect(viewBox.y).toBe(-25)
      expect(viewBox.width).toBe(650) // 600 + 50 padding
      expect(viewBox.height).toBe(330) // 280 + 50 padding
    })

    it('returns default viewBox for empty positions', () => {
      const viewBox = SVGUtils.calculateViewBox([], 50)

      expect(viewBox.x).toBe(0)
      expect(viewBox.y).toBe(0)
      expect(viewBox.width).toBe(800)
      expect(viewBox.height).toBe(600)
    })
  })

  describe('calculateResponsiveDimensions', () => {
    it('calculates scale and translate for fitting viewport', () => {
      const positions = [
        {
          ...mockMatchPosition,
          position: { x: 0, y: 0 },
          size: { width: 200, height: 100 }
        }
      ]

      const dimensions = SVGUtils.calculateResponsiveDimensions(800, 600, positions)

      expect(dimensions.scale).toBeLessThanOrEqual(1)
      expect(dimensions.translateX).toBeGreaterThanOrEqual(0)
      expect(dimensions.translateY).toBeGreaterThanOrEqual(0)
    })

    it('does not scale up beyond 100%', () => {
      const positions = [
        {
          ...mockMatchPosition,
          position: { x: 0, y: 0 },
          size: { width: 100, height: 50 }
        }
      ]

      const dimensions = SVGUtils.calculateResponsiveDimensions(1000, 800, positions)

      expect(dimensions.scale).toBeLessThanOrEqual(1)
    })
  })

  describe('createTransform', () => {
    it('creates correct CSS transform string', () => {
      const transform = SVGUtils.createTransform(1.5, 100, 50)
      expect(transform).toBe('translate(100px, 50px) scale(1.5)')
    })

    it('handles zero values', () => {
      const transform = SVGUtils.createTransform(1, 0, 0)
      expect(transform).toBe('translate(0px, 0px) scale(1)')
    })

    it('handles negative values', () => {
      const transform = SVGUtils.createTransform(0.5, -50, -25)
      expect(transform).toBe('translate(-50px, -25px) scale(0.5)')
    })
  })

  describe('isPointInRect', () => {
    const rect = {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 80 }
    }

    it('returns true for point inside rectangle', () => {
      const point: Point = { x: 150, y: 120 }
      expect(SVGUtils.isPointInRect(point, rect)).toBe(true)
    })

    it('returns false for point outside rectangle', () => {
      const point: Point = { x: 50, y: 50 }
      expect(SVGUtils.isPointInRect(point, rect)).toBe(false)
    })

    it('returns true for point on rectangle edge', () => {
      const point: Point = { x: 100, y: 100 }
      expect(SVGUtils.isPointInRect(point, rect)).toBe(true)
    })

    it('returns true for point on opposite edge', () => {
      const point: Point = { x: 300, y: 180 }
      expect(SVGUtils.isPointInRect(point, rect)).toBe(true)
    })
  })

  describe('findMatchAtPoint', () => {
    const positions = [
      {
        ...mockMatchPosition,
        match: { ...mockMatch, id: 'match-1' },
        position: { x: 0, y: 0 },
        size: { width: 200, height: 80 }
      },
      {
        ...mockMatchPosition,
        match: { ...mockMatch, id: 'match-2' },
        position: { x: 300, y: 100 },
        size: { width: 200, height: 80 }
      }
    ]

    it('finds match at point', () => {
      const point: Point = { x: 100, y: 40 }
      const foundMatch = SVGUtils.findMatchAtPoint(point, positions)

      expect(foundMatch).not.toBeNull()
      expect(foundMatch?.match.id).toBe('match-1')
    })

    it('returns null when no match at point', () => {
      const point: Point = { x: 250, y: 50 }
      const foundMatch = SVGUtils.findMatchAtPoint(point, positions)

      expect(foundMatch).toBeNull()
    })
  })

  describe('generateRoundLabels', () => {
    it('generates single elimination labels correctly', () => {
      const labels = SVGUtils.generateRoundLabels(4, 'single')

      expect(labels).toHaveLength(4)
      expect(labels[0]).toBe('Round 1')
      expect(labels[1]).toBe('Quarterfinal')
      expect(labels[2]).toBe('Semifinal')
      expect(labels[3]).toBe('Final')
    })

    it('generates double elimination labels', () => {
      const labels = SVGUtils.generateRoundLabels(3, 'double')

      expect(labels).toHaveLength(3)
      expect(labels[0]).toBe('Round 1')
      expect(labels[1]).toBe('Round 2')
      expect(labels[2]).toBe('Round 3')
    })

    it('handles single round', () => {
      const labels = SVGUtils.generateRoundLabels(1, 'single')

      expect(labels).toHaveLength(1)
      expect(labels[0]).toBe('Final')
    })
  })

  describe('getMatchCenter', () => {
    it('calculates center point correctly', () => {
      const center = SVGUtils.getMatchCenter(mockMatchPosition)

      expect(center.x).toBe(200) // 100 + 200/2
      expect(center.y).toBe(140) // 100 + 80/2
    })
  })

  describe('createRoundedRect', () => {
    it('creates rounded rectangle path', () => {
      const path = SVGUtils.createRoundedRect(10, 20, 100, 50, 5)

      expect(path).toContain('M 15 20') // Start point accounting for radius
      expect(path).toContain('Q 10 20 15 20') // First corner curve
      expect(path).toContain('Z') // Close path
    })

    it('handles zero radius', () => {
      const path = SVGUtils.createRoundedRect(0, 0, 100, 50, 0)

      expect(path).toContain('M 0 0')
      expect(path).toContain('Q 0 0 0 0') // Degenerate curves
    })
  })
})