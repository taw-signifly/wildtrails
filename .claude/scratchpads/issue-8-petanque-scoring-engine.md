# Issue #8: Implement Petanque Scoring Engine and Validation

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/8

## Analysis Summary

Implementing a comprehensive Petanque scoring engine focused on geometric calculations, distance measurement, statistical analysis, and advanced rule validation. This builds on existing match management infrastructure.

## Current State Analysis

### ✅ **Infrastructure Already Complete**
- **Match Management**: Full server actions in `/src/lib/actions/matches.ts` and `/src/lib/actions/live-scoring.ts`
- **Basic Petanque Validation**: Score validation (0-13 points, game completion rules) in `/src/lib/validation/match.ts`
- **End-by-End Scoring**: Complete tracking with `End`, `Boule`, and `Position` schemas
- **Database Operations**: MatchDB class with scoring methods in `/src/lib/db/matches.ts`
- **Real-time Updates**: SSE broadcasting for live scoring events
- **Form Integration**: Progressive enhancement with React 19 `useActionState`

### ❌ **Missing Components (Issue #8 Focus)**
- **Scoring Engine**: Mathematical calculations for end scoring
- **Distance Calculator**: Boule to jack distance measurement 
- **End Winner Determination**: Logic to determine which team wins each end
- **Points Calculation**: Count scoring boules (closer than opponent's closest)
- **Statistical Engine**: APD, Delta system, points differential calculations
- **Geometry Utilities**: Coordinate system and distance calculations
- **Advanced Validation**: Rule enforcement beyond basic score limits

## Implementation Plan

### Phase 1: Core Geometry and Distance System
**Files**: 
- `/src/lib/scoring/geometry.ts` - Position and distance utilities
- `/src/types/scoring.ts` - Scoring-specific types

**Core Geometry Functions**:
1. `calculateDistance(pos1: Position, pos2: Position): number` - Euclidean distance
2. `isValidCourtPosition(position: Position, courtDimensions: CourtDimensions): boolean` - Bounds checking
3. `normalizePosition(position: Position): Position` - Coordinate normalization
4. `getRelativePosition(boule: Position, jack: Position): RelativePosition` - Relative positioning

**Distance Calculations**:
1. `calculateBouleDistance(boule: Position, jack: Position): number` - Distance from jack in cm
2. `findClosestBoule(boules: Boule[], jack: Position): Boule | null` - Find closest boule
3. `sortBoulesByDistance(boules: Boule[], jack: Position): Boule[]` - Sort by distance from jack
4. `calculateBoulesInRadius(boules: Boule[], center: Position, radius: number): Boule[]` - Proximity calculations

### Phase 2: End Scoring Calculator
**File**: `/src/lib/scoring/calculator.ts` - Mathematical scoring calculations

**End Scoring Logic**:
1. `calculateEndScore(boules: Boule[], jack: Position): EndScoreResult` - Main scoring function
2. `determineEndWinner(boules: Boule[], jack: Position): { winner: string; points: number }` - Winner calculation
3. `countScoringBoules(team1Boules: Boule[], team2Boules: Boule[], jack: Position): number` - Points counting
4. `validateEndConfiguration(boules: Boule[], jack: Position): ValidationResult` - Configuration validation

**Special Cases**:
1. `handleEqualDistances(boules: Boule[], jack: Position): EndScoreResult` - Tie handling
2. `handleJackDisplacement(originalJack: Position, newJack: Position, boules: Boule[]): EndScoreResult` - Jack movement
3. `handleMeasuredEnd(boules: Boule[], jack: Position): EndScoreResult` - Close measurement scenarios

### Phase 3: Core Scoring Engine
**File**: `/src/lib/scoring/engine.ts` - Main scoring engine class

**ScoringEngine Class**:
```typescript
class ScoringEngine {
  calculateEndScore(boules: Boule[], jack: Position): EndScoreResult
  validateMatchScore(match: Match): ScoreValidationResult
  isGameComplete(score: Score): boolean
  getGameWinner(score: Score): string | null
  calculatePointsDifferential(finalScore: Score): number
  processEndScoring(matchId: string, endData: EndInput): Promise<EndScoreResult>
  validateScoreProgression(currentScore: Score, newScore: Score): boolean
}
```

**Key Business Rules**:
- Team with closest boule wins the end
- 1 point per boule closer than opponent's closest
- Maximum 6 points per end (triples format)
- Minimum 1 point per end for winning team
- First team to 13 points wins the game

### Phase 4: Statistical Calculations
**File**: `/src/lib/scoring/statistics.ts` - Tournament statistics and metrics

**Statistical Functions**:
1. `calculatePointsDifferential(score: Score): number` - Match margin calculation
2. `calculateAPD(matches: Match[]): number` - Average Points Differential
3. `calculateDelta(matches: Match[]): number` - Delta system for tie-breaking
4. `calculateTeamStatistics(teamId: string, matches: Match[]): TeamStatistics` - Team performance
5. `calculatePlayerStatistics(playerId: string, matches: Match[]): PlayerStatistics` - Individual stats

**Advanced Analytics**:
1. `analyzeEndPatterns(match: Match): EndAnalysis` - End-by-end pattern analysis
2. `calculateMatchMomentum(match: Match): MomentumAnalysis` - Game momentum tracking
3. `generatePerformanceMetrics(matches: Match[]): PerformanceMetrics` - Comprehensive metrics
4. `calculateFormIndex(recentMatches: Match[]): number` - Recent form calculation

### Phase 5: Advanced Validation Rules
**File**: `/src/lib/scoring/validation.ts` - Advanced rule validation

**Validation Functions**:
1. `validatePetanqueRules(score: Score, ends: End[]): RuleValidationResult` - Complete rule checking
2. `validateEndProgression(ends: End[]): ValidationResult` - End sequence validation
3. `validateBouleConfiguration(boules: Boule[], format: GameFormat): ValidationResult` - Boule setup
4. `detectScoreInconsistencies(match: Match): InconsistencyReport` - Score integrity checks

**Rule Enforcement**:
1. `enforceMaxPointsPerEnd(points: number, format: GameFormat): boolean` - Point limits
2. `enforceGameCompletionRules(score: Score): boolean` - Game ending rules  
3. `enforceSequentialEndNumbers(ends: End[]): boolean` - End numbering
4. `enforcePlayerBouleCount(boules: Boule[], format: GameFormat): boolean` - Boule count limits

### Phase 6: Petanque Rule Definitions
**File**: `/src/lib/scoring/rules.ts` - Official Petanque rule definitions

**Rule Constants**:
```typescript
export const PETANQUE_RULES = {
  MAX_GAME_POINTS: 13,
  MIN_END_POINTS: 1,
  MAX_END_POINTS: 6,
  SINGLES_BOULES_PER_PLAYER: 3,
  DOUBLES_BOULES_PER_PLAYER: 3,
  TRIPLES_BOULES_PER_PLAYER: 2,
  STANDARD_COURT_LENGTH: 15,
  STANDARD_COURT_WIDTH: 4,
  MIN_THROWING_DISTANCE: 6,
  MAX_THROWING_DISTANCE: 10,
  JACK_DIAMETER: 3, // cm
  BOULE_DIAMETER: 7.5, // cm
  MEASUREMENT_PRECISION: 0.1 // cm
}
```

**Rule Validation Functions**:
1. `validateGameFormat(format: GameFormat): RuleCheck` - Format validation
2. `validateCourtDimensions(dimensions: CourtDimensions): RuleCheck` - Court standards
3. `validateEquipmentSpecs(jack: Position, boules: Boule[]): RuleCheck` - Equipment validation

## Integration with Existing System

### Server Actions Integration
```typescript
// Update existing live-scoring.ts actions to use ScoringEngine
export async function submitEndScore(matchId: string, formData: FormData): Promise<ActionResult<Match>> {
  // ... existing validation ...
  
  // Use ScoringEngine for end calculation
  const scoringEngine = new ScoringEngine()
  const endResult = await scoringEngine.calculateEndScore(endData.boules, endData.jackPosition)
  
  // Validate result against Petanque rules
  const ruleValidation = await scoringEngine.validatePetanqueRules(match.score, [...match.ends, endResult])
  
  if (!ruleValidation.valid) {
    return { success: false, error: ruleValidation.errors.join(', ') }
  }
  
  // ... rest of existing logic ...
}
```

### Enhanced Validation Integration
```typescript
// Enhance existing validateMatchScore action
export async function validateMatchScore(matchId: string, score: Score): Promise<ActionResult<ScoreValidationResult>> {
  const scoringEngine = new ScoringEngine()
  const validation = await scoringEngine.validateMatchScore(match)
  
  return {
    success: true,
    data: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions
    }
  }
}
```

## File Structure

```
src/
├── lib/
│   ├── scoring/
│   │   ├── engine.ts            # Main ScoringEngine class
│   │   ├── calculator.ts        # End scoring calculations
│   │   ├── geometry.ts          # Position and distance utilities
│   │   ├── statistics.ts        # Tournament statistics
│   │   ├── validation.ts        # Advanced rule validation  
│   │   ├── rules.ts             # Petanque rule definitions
│   │   └── index.ts             # Export all scoring functions
│   └── actions/
│       ├── live-scoring.ts      # Enhanced with ScoringEngine integration
│       └── matches.ts           # Enhanced with statistical calculations
├── types/
│   ├── scoring.ts               # Scoring-specific types
│   └── index.ts                 # Enhanced with scoring types
└── __tests__/
    └── scoring/
        ├── engine.test.ts       # Core engine tests
        ├── calculator.test.ts   # End calculation tests
        ├── geometry.test.ts     # Distance calculation tests
        ├── statistics.test.ts   # Statistical function tests
        └── validation.test.ts   # Rule validation tests
```

## Core Types to Implement

```typescript
// src/types/scoring.ts
export interface EndScoreResult {
  winner: string           // team ID
  points: number          // points awarded
  winningBoules: Boule[]  // boules that scored
  measurements: EndMeasurement[]
  isCloseCall: boolean    // requires measurement
  confidence: number      // calculation confidence (0-1)
}

export interface EndMeasurement {
  bouleId: string
  distanceFromJack: number  // cm
  isClosest: boolean
  measurementType: 'calculated' | 'measured' | 'estimated'
}

export interface ScoreValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  ruleViolations: RuleViolation[]
}

export interface RuleViolation {
  rule: string
  severity: 'error' | 'warning'
  description: string
  suggestion?: string
}

export interface TeamStatistics {
  matchesPlayed: number
  matchesWon: number
  winPercentage: number
  averagePointsFor: number
  averagePointsAgainst: number
  pointsDifferential: number
  averagePointsDifferential: number
  dominantWins: number      // wins by 8+ points
  closeWins: number         // wins by 1-2 points
  largestWin: number
  largestLoss: number
  currentForm: number[]     // last 5 match results
}

export interface EndAnalysis {
  averageEndDuration: number
  pointsPerEnd: { team1: number; team2: number }
  largestEnd: { points: number; winner: string; endNumber: number }
  momentum: { team1: number[]; team2: number[] }  // points per end
  criticalEnds: number[]    // high-pressure ends (12+ points)
}
```

## Performance Requirements

### Calculation Performance
- **End scoring**: <50ms for complex boule configurations
- **Distance calculations**: <10ms for 12 boules
- **Statistical analysis**: <200ms for tournament-wide stats
- **Validation**: <100ms for comprehensive rule checking

### Accuracy Requirements  
- **Distance precision**: ±0.1cm for boule measurements
- **Score calculations**: 100% accuracy for rule enforcement
- **Statistical precision**: 3 decimal places for percentages

## Testing Strategy

### Unit Tests
- **Geometry calculations**: Distance formulas, coordinate transformations
- **End scoring logic**: All possible boule configurations
- **Statistical functions**: Mathematical accuracy validation
- **Rule validation**: Every Petanque rule scenario
- **Edge cases**: Tie scenarios, measurement edge cases

### Integration Tests
- **End-to-end scoring**: Complete match scoring workflow
- **Server action integration**: Enhanced live-scoring functionality
- **Performance testing**: Large tournament statistical calculations
- **Accuracy testing**: Compare with manual scoring results

### Test Scenarios
```typescript
describe('ScoringEngine', () => {
  test('calculates simple end with clear winner', () => {
    // Team 1 has closest boule, 2 points
  })
  
  test('handles complex measurement scenario', () => {
    // Multiple boules within measurement tolerance
  })
  
  test('validates impossible score progression', () => {
    // Score jumps that violate Petanque rules
  })
  
  test('calculates tournament APD correctly', () => {
    // Statistical accuracy verification
  })
})
```

## Success Criteria

- [ ] ScoringEngine class accurately calculates end scores
- [ ] Distance calculations work with court coordinate system
- [ ] End winner determination handles all edge cases
- [ ] Points calculation correctly counts scoring boules
- [ ] Statistical functions produce accurate APD and Delta calculations
- [ ] Advanced validation catches all rule violations
- [ ] Performance meets requirements (<50ms end scoring)
- [ ] Integration with existing server actions seamless
- [ ] Complete test coverage for all scoring scenarios
- [ ] Official Petanque rules properly implemented

## Dependencies

**Existing Infrastructure** (✅ Available):
- MatchDB class with scoring operations
- Server actions for live scoring and match management
- Validation schemas for Match, End, Boule, Position
- Real-time SSE broadcasting system
- Form integration with progressive enhancement

**New Development** (❌ To Implement):
- Geometric calculation utilities
- End scoring calculator with business logic
- Statistical analysis engine
- Advanced rule validation system
- Petanque rule definitions and constants

## Implementation Notes

### Mathematical Accuracy
- Use precise floating-point calculations for distances
- Handle measurement tolerance for close calls
- Implement proper rounding for display vs calculation

### Business Logic Priority
- Official Petanque rules take precedence over convenience
- Statistical calculations must match tournament standards
- Edge case handling reflects real-world scenarios

### Integration Strategy
- Enhance existing server actions without breaking changes
- Maintain backward compatibility with current scoring
- Add scoring engine as optional advanced feature initially

This implementation will provide the complete Petanque scoring engine required by Issue #8 while building on the solid infrastructure already established in the codebase.