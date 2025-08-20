import { Match, Team, TournamentType } from '@/types'

// Position and layout types for SVG rendering
export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface MatchPosition {
  match: Match
  position: Point
  size: Size
  round: number
  index: number
}

export interface RoundPosition {
  round: number
  x: number
  y: number
  matchCount: number
  spacing: number
}

export interface LineDefinition {
  from: Point
  to: Point
  type: 'horizontal' | 'vertical' | 'curved'
  style?: 'solid' | 'dashed'
}

// Layout configuration for different tournament formats
export interface LayoutConfig {
  format: TournamentType
  matchWidth: number
  matchHeight: number
  horizontalSpacing: number
  verticalSpacing: number
  roundSpacing: number
  padding: number
}

// Responsive layout configurations
export interface ResponsiveConfig {
  mobile: LayoutConfig
  tablet: LayoutConfig
  desktop: LayoutConfig
}

// Navigation and interaction state
export interface BracketViewState {
  scale: number
  translateX: number
  translateY: number
  selectedMatch?: string
  highlightedTeam?: string
  showDetails: boolean
}

export interface NavigationControls {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  panTo: (x: number, y: number) => void
  selectMatch: (matchId: string) => void
  highlightTeam: (teamId: string) => void
}

// Animation and transition types
export interface AnimationConfig {
  duration: number
  easing: string
  enabled: boolean
}

export interface WinnerAdvancement {
  fromMatch: string
  toMatch: string
  winner: Team
  animation?: AnimationConfig
}

// Export and sharing types
export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf'
  quality: 'low' | 'medium' | 'high'
  includeBackground: boolean
  includeControls: boolean
}

// Real-time update types
export interface BracketUpdateEvent {
  type: 'match_updated' | 'match_completed' | 'bracket_advanced' | 'tournament_completed'
  matchId?: string
  tournamentId: string
  data: any
  timestamp: string
}

export interface LiveBracketData {
  matches: Match[]
  bracketStructure: any[]
  lastUpdated: string
  isComplete: boolean
}

// Component prop types
export interface BracketRendererProps {
  tournament: any
  matches: Match[]
  bracketStructure: any[]
  layout?: LayoutConfig
  interactive?: boolean
  showControls?: boolean
  onMatchSelect?: (match: Match) => void
  onTeamHighlight?: (team: Team) => void
  className?: string
}

export interface MatchNodeProps {
  match: Match
  position: Point
  size: Size
  interactive?: boolean
  selected?: boolean
  highlighted?: boolean
  onClick?: () => void
  onHover?: (isHovered: boolean) => void
}

export interface BracketNavigationProps {
  viewState: BracketViewState
  controls: NavigationControls
  bounds: ViewBox
  showMinimap?: boolean
  allowFullscreen?: boolean
}

// Format-specific props
export interface SingleEliminationProps extends BracketRendererProps {
  showByes?: boolean
  roundLabels?: string[]
}

export interface DoubleEliminationProps extends BracketRendererProps {
  showBracketLabels?: boolean
  separateBrackets?: boolean
}

export interface SwissSystemProps extends BracketRendererProps {
  showStandings?: boolean
  currentRound?: number
}

export interface RoundRobinProps extends BracketRendererProps {
  showGroups?: boolean
  matrixView?: boolean
}

// Accessibility types
export interface AccessibilityConfig {
  announceUpdates: boolean
  keyboardNavigation: boolean
  highContrast: boolean
  reducedMotion: boolean
}

// Error and loading states
export interface BracketState {
  loading: boolean
  error?: string
  data?: LiveBracketData
  connected: boolean
}