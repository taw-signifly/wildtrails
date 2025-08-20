// Core bracket components
export { BracketRenderer } from './bracket-renderer'
export { MatchNode } from './match-node'
export { BracketNavigation } from './bracket-navigation'
export { ResponsiveBracket } from './responsive-bracket'

// Tournament format-specific components
export { SingleEliminationBracket } from './single-elimination'
export { DoubleEliminationBracket } from './double-elimination'

// Re-export types for convenience
export type {
  BracketRendererProps,
  MatchNodeProps,
  BracketNavigationProps,
  SingleEliminationProps,
  DoubleEliminationProps,
  BracketViewState,
  NavigationControls,
  MatchPosition,
  LineDefinition,
  LayoutConfig,
  Point,
  Size,
  ViewBox
} from '@/types/bracket'

// Re-export utilities
export { LayoutCalculator } from '@/lib/brackets/layout-calculator'
export { SVGUtils } from '@/lib/brackets/svg-utils'

// Re-export hooks
export { useBracketUpdates, useStaticBracketData } from '@/hooks/use-bracket-updates'