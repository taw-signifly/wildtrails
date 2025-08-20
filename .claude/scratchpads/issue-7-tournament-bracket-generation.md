# Issue #7: Tournament Bracket Generation Logic

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/7

## Analysis Summary

Implementing comprehensive tournament bracket generation algorithms for all supported tournament formats. This builds on existing infrastructure but requires creating a new dedicated tournament logic module with proper algorithms.

## Current State Analysis

### ✅ **Infrastructure Already Available**
- **Basic Bracket Management**: `/src/lib/actions/bracket-management.ts` exists with basic functionality
- **Tournament Infrastructure**: Complete tournament CRUD and management in place
- **Match Infrastructure**: Full match management system implemented
- **Database Layer**: TournamentDB, MatchDB, and other supporting classes ready
- **Validation**: Tournament and match validation schemas complete
- **SSE Integration**: Real-time updates infrastructure in place
- **Testing Framework**: Jest testing established with patterns to follow

### ❌ **Missing Components (Issue #7 Requirements)**
- **Dedicated Tournament Logic Module**: No `/src/lib/tournament/` directory structure
- **Advanced Seeding Algorithms**: Player seeding and randomization not implemented
- **Comprehensive Format Support**: Current implementations are basic stubs
- **Barrage System**: Not implemented at all
- **Proper Bracket Data Structures**: Limited visualization support
- **Standings Calculations**: Basic only, needs comprehensive implementation
- **Edge Case Handling**: Withdrawals, byes, odd player counts
- **Comprehensive Testing**: Format-specific test coverage needed

## Implementation Plan

### Phase 1: Create Tournament Logic Module Structure
**Directory**: `/src/lib/tournament/`

**Files to Create**:
1. `brackets.ts` - Main bracket generator class
2. `seeding.ts` - Player seeding algorithms
3. `progression.ts` - Tournament advancement logic
4. `standings.ts` - Standings calculation
5. `formats/` directory with specialized format handlers:
   - `single-elimination.ts`
   - `double-elimination.ts` 
   - `swiss.ts`
   - `round-robin.ts`
   - `barrage.ts`

### Phase 2: Advanced Seeding Algorithms (`seeding.ts`)
**Seeding Methods**:
1. **Ranked Seeding**: Based on player rankings/ratings
2. **Random Seeding**: Randomized tournament seeding
3. **Club-based Seeding**: Prevent club members from early matchups
4. **Geographic Seeding**: Regional distribution
5. **Balanced Seeding**: Skill-based distribution for fairness

**Key Features**:
- Bye assignment for non-power-of-2 player counts
- Anti-repeat pairing (Swiss system)
- Conflict resolution (avoid same club early rounds)
- Fair distribution algorithms

### Phase 3: Comprehensive Format Implementations

#### Single Elimination (`formats/single-elimination.ts`)
- Proper bracket seeding (1 vs lowest, 2 vs 2nd lowest)
- Bye assignment and placement
- Round naming (Final, Semifinal, Quarterfinal, etc.)
- Winner advancement logic
- Consolation bracket support

#### Double Elimination (`formats/double-elimination.ts`)
- Winner's bracket and loser's bracket management
- Proper bracket crossing rules
- Grand final scenarios (winner vs loser bracket champion)
- Loser bracket progression logic
- Elimination tracking

#### Swiss System (`formats/swiss.ts`)
- Proper Swiss pairing algorithms
- Anti-repeat matchup prevention
- Color assignment and balancing
- Standings calculations with tie-breaking
- Round-by-round pairing generation

#### Round Robin (`formats/round-robin.ts`)
- All-play-all within groups
- Group division for large tournaments
- Cross-group playoff systems
- Points-based standings and rankings
- Head-to-head tie-breaking

#### Barrage System (`formats/barrage.ts`)
- Qualification rounds with 2-win requirement
- Automatic barrage match generation
- Elimination after 2 losses
- Progression tracking
- Final qualification determination

### Phase 4: Advanced Tournament Progression (`progression.ts`)
**Key Features**:
1. Format-specific advancement rules
2. Automatic bracket progression
3. Winner/loser placement logic
4. Tournament completion detection
5. Final rankings generation
6. Prize distribution calculations

### Phase 5: Comprehensive Standings (`standings.ts`)
**Calculation Methods**:
1. **Win/Loss Records**: Basic match outcomes
2. **Points Differential**: Petanque point differences
3. **Head-to-Head Records**: Direct matchup results
4. **Strength of Schedule**: Opponent quality metrics
5. **Buchholz System**: Swiss tournament tie-breaking
6. **Sonneborn-Berger**: Another Swiss tie-breaking method

### Phase 6: Integration & Testing
**Test Coverage**:
- Unit tests for each format algorithm
- Edge case testing (odd players, withdrawals, byes)
- Integration tests with existing match/tournament systems
- Performance testing for large tournaments (200+ players)
- Real-world scenario testing

## Technical Implementation Details

### Main Bracket Generator Class (`brackets.ts`)

```typescript
export class BracketGenerator {
  private seeder: Seeder
  private formatHandlers: Map<TournamentType, FormatHandler>
  
  constructor() {
    this.seeder = new Seeder()
    this.formatHandlers = new Map([
      ['single-elimination', new SingleEliminationHandler()],
      ['double-elimination', new DoubleEliminationHandler()],
      ['swiss', new SwissSystemHandler()],
      ['round-robin', new RoundRobinHandler()],
      ['barrage', new BarrageHandler()]
    ])
  }
  
  async generateBracket(tournament: Tournament, teams: Team[]): Promise<BracketResult> {
    // 1. Validate inputs
    // 2. Apply seeding algorithm
    // 3. Delegate to format-specific handler
    // 4. Generate bracket structure and matches
    // 5. Return comprehensive bracket data
  }
  
  async updateProgression(match: Match): Promise<ProgressionUpdate> {
    // Handle match completion and bracket advancement
  }
}
```

### Seeding Algorithm Interface (`seeding.ts`)

```typescript
export interface SeedingOptions {
  method: 'ranked' | 'random' | 'club-balanced' | 'geographic' | 'skill-balanced'
  avoidSameClub?: boolean
  regionalBalance?: boolean
  skillDistribution?: 'even' | 'snake' | 'random'
}

export class Seeder {
  seedTeams(teams: Team[], options: SeedingOptions): Team[] {
    switch (options.method) {
      case 'ranked': return this.rankedSeeding(teams, options)
      case 'random': return this.randomSeeding(teams, options)
      case 'club-balanced': return this.clubBalancedSeeding(teams, options)
      // ... other methods
    }
  }
  
  assignByes(teams: Team[], bracketSize: number): { teams: Team[]; byes: Team[] } {
    // Calculate optimal bye placement
  }
}
```

### Format Handler Interface

```typescript
export interface FormatHandler {
  generateMatches(teams: Team[], tournament: Tournament): FormatResult
  updateProgression(match: Match, allMatches: Match[]): ProgressionResult
  calculateStandings(matches: Match[]): Standings
  isComplete(matches: Match[]): boolean
}

export interface FormatResult {
  matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]
  bracketStructure: BracketNode[]
  metadata: FormatMetadata
}
```

## Integration with Existing Systems

### Server Actions Integration
- Update existing `bracket-management.ts` to use new tournament logic module
- Maintain backward compatibility with current API
- Add new actions for advanced features (seeding options, format-specific operations)

### Database Integration
- Leverage existing MatchDB bulk operations
- Add bracket structure persistence
- Tournament metadata storage for complex formats

### Real-time Updates
- Integrate with existing SSE system
- Broadcast seeding changes
- Live bracket progression updates
- Standings updates in real-time

## File Structure Plan

```
src/
├── lib/
│   ├── tournament/           # NEW - Dedicated tournament logic
│   │   ├── brackets.ts       # Main bracket generator
│   │   ├── seeding.ts        # Seeding algorithms
│   │   ├── progression.ts    # Tournament advancement
│   │   ├── standings.ts      # Standings calculation
│   │   ├── formats/          # Format-specific handlers
│   │   │   ├── index.ts      # Export all handlers
│   │   │   ├── base.ts       # Base format handler
│   │   │   ├── single-elimination.ts
│   │   │   ├── double-elimination.ts
│   │   │   ├── swiss.ts
│   │   │   ├── round-robin.ts
│   │   │   └── barrage.ts
│   │   └── __tests__/        # Comprehensive test suite
│   │       ├── brackets.test.ts
│   │       ├── seeding.test.ts
│   │       ├── progression.test.ts
│   │       ├── standings.test.ts
│   │       └── formats/
│   │           ├── single-elimination.test.ts
│   │           ├── double-elimination.test.ts
│   │           ├── swiss.test.ts
│   │           ├── round-robin.test.ts
│   │           └── barrage.test.ts
│   └── actions/
│       └── bracket-management.ts  # Updated to use new tournament module
```

## Performance Requirements (from Issue)

### Scalability Targets
- **Large Tournaments**: Support 200+ players efficiently
- **Bracket Generation**: <2s for complex tournaments
- **Progression Updates**: <500ms for match completion
- **Real-time Updates**: <1s latency for bracket changes
- **Concurrent Access**: Multiple tournament organizers simultaneously

### Algorithm Complexity
- **Single Elimination**: O(n) generation, O(log n) progression
- **Double Elimination**: O(n) generation, O(log n) progression  
- **Swiss System**: O(n²) worst case for pairing, optimized implementations
- **Round Robin**: O(n²) for match generation
- **Barrage**: O(n) for generation, O(1) for progression

## Success Criteria (from Issue)

### Core Requirements
- [ ] BracketGenerator class with format-specific methods ✅
- [ ] Player seeding algorithms (by ranking or random) ✅
- [ ] Bye assignment for odd player counts ✅
- [ ] Match scheduling with round progression ✅
- [ ] Winner advancement logic for each format ✅
- [ ] Bracket validation and error checking ✅
- [ ] Support for different team formats (singles/doubles/triples) ✅
- [ ] Bracket visualization data generation ✅
- [ ] Tournament progression tracking ✅
- [ ] Handle player withdrawals and forfeits ✅
- [ ] Automatic bracket adjustment for dropouts ✅
- [ ] Integration with Match and Tournament APIs ✅

### Algorithm Implementation
- [ ] `generateSingleElimination(players)` - Create knockout bracket ✅
- [ ] `generateDoubleElimination(players)` - Create double elimination ✅
- [ ] `generateSwissSystem(players, rounds)` - Swiss tournament ✅
- [ ] `generateRoundRobin(players)` - Round-robin matches ✅
- [ ] `generateBarrage(players)` - Barrage qualification ✅
- [ ] `advanceBracket(match, winnerId)` - Progress tournament ✅
- [ ] `calculateStandings(matches)` - Current standings ✅

### Testing & Quality
- [ ] Unit tests cover all algorithms and edge cases ✅
- [ ] Integration tests with existing systems ✅
- [ ] Performance benchmarks for large tournaments ✅
- [ ] Edge case handling (withdrawals, byes, odd counts) ✅
- [ ] Real-world tournament scenario testing ✅

## Implementation Steps

1. **Setup Phase** (Current)
   - Create plan and scratchpad ✅
   - Analyze existing infrastructure ✅
   - Define file structure and interfaces ✅

2. **Foundation Phase**
   - Create `/src/lib/tournament/` directory structure
   - Implement base interfaces and types
   - Create base format handler

3. **Core Algorithms Phase**
   - Implement seeding algorithms (`seeding.ts`)
   - Create bracket generator (`brackets.ts`)
   - Implement progression logic (`progression.ts`)
   - Implement standings calculations (`standings.ts`)

4. **Format Handlers Phase**
   - Single elimination format handler
   - Double elimination format handler
   - Swiss system format handler
   - Round-robin format handler
   - Barrage system format handler

5. **Integration Phase**
   - Update existing `bracket-management.ts` actions
   - Add comprehensive error handling
   - Integrate with SSE for real-time updates
   - Add validation and security measures

6. **Testing Phase**
   - Unit tests for all components
   - Integration tests with existing systems
   - Performance testing for large tournaments
   - Edge case and error scenario testing

7. **Documentation & Finalization**
   - Update existing documentation
   - Create usage examples
   - Performance optimization
   - Final code review and cleanup

## Dependencies & Constraints

### Existing Infrastructure (Available)
- Tournament, Match, Team, Player data models ✅
- Database operations (TournamentDB, MatchDB, etc.) ✅
- Server actions architecture and patterns ✅
- Validation schemas (Zod) for all entities ✅
- Real-time updates (SSE) infrastructure ✅
- Testing framework (Jest) and patterns ✅

### New Development Required
- Tournament logic module structure
- Advanced seeding and bracket algorithms
- Format-specific tournament handlers
- Comprehensive standings calculations
- Enhanced error handling for complex scenarios
- Performance optimizations for large tournaments

This implementation will provide a robust, scalable tournament bracket generation system that supports all major tournament formats with advanced features like proper seeding, bracket progression, and real-time updates while maintaining integration with the existing WildTrails architecture.