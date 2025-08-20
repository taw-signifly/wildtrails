import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchNode } from '../match-node'
import { Match, Team } from '@/types'

// Mock match data
const mockTeam1: Team = {
  id: 'team-1',
  name: 'Team Alpha',
  players: ['player1@example.com', 'player2@example.com'],
  tournamentId: 'tournament-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const mockTeam2: Team = {
  id: 'team-2',
  name: 'Team Beta',
  players: ['player3@example.com', 'player4@example.com'],
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
  score: { team1: 13, team2: 8, isComplete: true },
  status: 'completed',
  winner: 'team-1',
  ends: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const defaultProps = {
  match: mockMatch,
  position: { x: 100, y: 100 },
  size: { width: 200, height: 80 }
}

describe('MatchNode', () => {
  it('renders match with team names', () => {
    render(<MatchNode {...defaultProps} />)
    
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
  })

  it('displays scores when showScores is true', () => {
    render(<MatchNode {...defaultProps} showScores={true} />)
    
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('hides scores when showScores is false', () => {
    render(<MatchNode {...defaultProps} showScores={false} />)
    
    expect(screen.queryByText('13')).not.toBeInTheDocument()
    expect(screen.queryByText('8')).not.toBeInTheDocument()
  })

  it('displays status badge when showStatus is true', () => {
    render(<MatchNode {...defaultProps} showStatus={true} />)
    
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('highlights winner when match is completed', () => {
    render(<MatchNode {...defaultProps} />)
    
    const winnerElement = screen.getByText('Team Alpha').closest('div')
    const loserElement = screen.getByText('Team Beta').closest('div')
    
    expect(winnerElement).toHaveClass('font-semibold', 'text-green-700')
    expect(loserElement).toHaveClass('text-gray-600')
  })

  it('calls onClick when interactive and clicked', () => {
    const mockOnClick = jest.fn()
    render(<MatchNode {...defaultProps} interactive={true} onClick={mockOnClick} />)
    
    const matchNode = screen.getByRole('button')
    fireEvent.click(matchNode)
    
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when not interactive', () => {
    const mockOnClick = jest.fn()
    render(<MatchNode {...defaultProps} interactive={false} onClick={mockOnClick} />)
    
    const matchNode = screen.getByLabelText('Match between Team Alpha and Team Beta')
    fireEvent.click(matchNode)
    
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('shows TBD for empty teams', () => {
    const matchWithEmptyTeams: Match = {
      ...mockMatch,
      team1: { id: '', name: '', players: [] } as Team,
      team2: { id: '', name: '', players: [] } as Team
    }
    
    render(<MatchNode {...defaultProps} match={matchWithEmptyTeams} />)
    
    expect(screen.getAllByText('TBD')).toHaveLength(2)
  })

  it('applies correct positioning styles', () => {
    const { container } = render(<MatchNode {...defaultProps} />)
    const matchNode = container.firstChild as HTMLElement
    
    expect(matchNode).toHaveStyle({
      position: 'absolute',
      left: '100px',
      top: '100px',
      width: '200px',
      height: '80px'
    })
  })

  it('shows court information when available', () => {
    const matchWithCourt: Match = {
      ...mockMatch,
      court: 'Court 1'
    }
    
    render(<MatchNode {...defaultProps} match={matchWithCourt} />)
    
    expect(screen.getByText('Court 1')).toBeInTheDocument()
  })

  it('shows scheduled time when available', () => {
    const scheduledTime = new Date('2023-12-01T10:00:00Z')
    const matchWithTime: Match = {
      ...mockMatch,
      scheduledTime: scheduledTime.toISOString()
    }
    
    render(<MatchNode {...defaultProps} match={matchWithTime} />)
    
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('applies selected styling when selected prop is true', () => {
    const { container } = render(<MatchNode {...defaultProps} selected={true} />)
    const matchNode = container.firstChild as HTMLElement
    
    expect(matchNode).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2')
  })

  it('applies highlighted styling when highlighted prop is true', () => {
    const { container } = render(<MatchNode {...defaultProps} highlighted={true} />)
    const matchNode = container.firstChild as HTMLElement
    
    expect(matchNode).toHaveClass('bg-yellow-50', 'border-yellow-300')
  })

  describe('different themes', () => {
    it('renders minimal theme correctly', () => {
      const { container } = render(<MatchNode {...defaultProps} theme="minimal" />)
      const matchNode = container.firstChild as HTMLElement
      
      expect(matchNode).toHaveClass('border', 'rounded-md', 'p-2', 'bg-white', 'text-xs')
    })

    it('renders compact theme correctly', () => {
      render(<MatchNode {...defaultProps} compact={true} />)
      
      // Compact theme should show status badge
      expect(screen.getByText('completed')).toBeInTheDocument()
    })
  })

  describe('match statuses', () => {
    it('applies correct styling for scheduled matches', () => {
      const scheduledMatch: Match = { ...mockMatch, status: 'scheduled' }
      const { container } = render(<MatchNode {...defaultProps} match={scheduledMatch} />)
      const matchNode = container.firstChild as HTMLElement
      
      expect(matchNode).toHaveClass('bg-gray-100', 'border-gray-300')
    })

    it('applies correct styling for active matches', () => {
      const activeMatch: Match = { ...mockMatch, status: 'active' }
      const { container } = render(<MatchNode {...defaultProps} match={activeMatch} />)
      const matchNode = container.firstChild as HTMLElement
      
      expect(matchNode).toHaveClass('bg-blue-50', 'border-blue-300')
    })

    it('applies correct styling for cancelled matches', () => {
      const cancelledMatch: Match = { ...mockMatch, status: 'cancelled' }
      const { container } = render(<MatchNode {...defaultProps} match={cancelledMatch} />)
      const matchNode = container.firstChild as HTMLElement
      
      expect(matchNode).toHaveClass('bg-red-50', 'border-red-300')
    })
  })

  it('calls onHover with correct parameters', () => {
    const mockOnHover = jest.fn()
    render(<MatchNode {...defaultProps} onHover={mockOnHover} />)
    
    const matchNode = screen.getByRole('button')
    
    fireEvent.mouseEnter(matchNode)
    expect(mockOnHover).toHaveBeenCalledWith(true)
    
    fireEvent.mouseLeave(matchNode)
    expect(mockOnHover).toHaveBeenCalledWith(false)
  })

  it('has correct accessibility attributes', () => {
    render(<MatchNode {...defaultProps} interactive={true} />)
    
    const matchNode = screen.getByRole('button')
    expect(matchNode).toHaveAttribute('tabIndex', '0')
    expect(matchNode).toHaveAttribute('aria-label', 'Match between Team Alpha and Team Beta')
  })
})