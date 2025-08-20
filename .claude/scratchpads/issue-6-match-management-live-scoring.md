# Issue #6: Match Management and Live Scoring Server Actions

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/6

## Analysis Summary

Implementing comprehensive server actions for match management, live scoring, and real-time features with Server-Sent Events (SSE). This is a complex implementation building on existing infrastructure.

## Current State Analysis

### ✅ **Infrastructure Already Complete**
- **MatchDB class**: Fully implemented in `/src/lib/db/matches.ts` with comprehensive match operations including:
  - Complete CRUD operations with tournament integration
  - Live scoring with end-by-end tracking
  - Score validation with Petanque rules (13-point games)
  - Match lifecycle (scheduled → active → completed)
  - Court assignment and schedule management
  - Bulk operations for bracket generation
  - Advanced statistics and filtering
- **CourtDB class**: Fully implemented in `/src/lib/db/courts.ts` with:
  - Court status management (available, in-use, maintenance, reserved)
  - Match assignment with conflict prevention
  - Utilization statistics and availability tracking
- **Match validation schemas**: Complete in `/src/lib/validation/match.ts` with:
  - Comprehensive Petanque rule validation
  - Score, End, and Boule schemas with business logic
  - Real-time event schemas (ScoreUpdateData, MatchCompleteData)
  - Form data validation for score input
- **Tournament Actions Pattern**: Established pattern from `/src/lib/actions/tournaments.ts` to follow
- **Testing Infrastructure**: Jest tests established for database operations

### ❌ **Missing Components**
- **Match Server Actions**: No server actions exist yet for match operations
- **Live Scoring Actions**: No server actions for real-time scoring
- **SSE Implementation**: No Server-Sent Events routes for real-time updates
- **Court Assignment Actions**: No server actions for court management in match context
- **Bracket Management Actions**: No server actions for tournament progression

## Implementation Plan

### Phase 1: Core Match Server Actions
**File**: `/src/lib/actions/matches.ts`

**Core CRUD Actions** (following tournament pattern):
1. `createMatch(formData: FormData)` - Form-compatible match creation
2. `createMatchData(data: MatchFormData)` - Programmatic match creation
3. `getMatches(filters?: MatchFilters & PaginationParams)` - List matches with filtering
4. `getMatchById(id: string)` - Get single match
5. `updateMatch(id: string, formData: FormData)` - Form-compatible match updates
6. `updateMatchData(id: string, data: Partial<Match>)` - Programmatic updates
7. `deleteMatch(id: string)` - Archive match (soft delete)
8. `searchMatches(query: string, filters?: MatchFilters)` - Search matches

**Match Lifecycle Actions**:
1. `startMatch(matchId: string, courtId?: string)` - Change status to active
2. `completeMatch(matchId: string, finalScore: Score, winnerId: string)` - Complete match
3. `cancelMatch(matchId: string, reason?: string)` - Cancel match
4. `pauseMatch(matchId: string)` - Pause active match
5. `resumeMatch(matchId: string)` - Resume paused match

### Phase 2: Live Scoring Server Actions  
**File**: `/src/lib/actions/live-scoring.ts`

**Real-time Scoring Actions**:
1. `updateMatchScore(matchId: string, scoreUpdate: Partial<Score>)` - Update match score
2. `addEndToMatch(matchId: string, endData: Omit<End, 'id' | 'createdAt'>)` - Add scoring end
3. `submitEndScore(matchId: string, formData: FormData)` - Form-compatible end scoring
4. `updateEndScore(matchId: string, endId: string, endUpdate: Partial<End>)` - Update existing end
5. `undoLastEnd(matchId: string)` - Undo last end for corrections
6. `validateMatchScore(matchId: string, score: Score)` - Validate score against Petanque rules
7. `getMatchProgress(matchId: string)` - Get current match progress and stats
8. `getMatchHistory(matchId: string)` - Get complete scoring history
9. `getEndByEndDetails(matchId: string)` - Get detailed end-by-end breakdown

**Key Business Rules to Implement**:
- Petanque scoring validation (13-point games, max 6 points per end)
- Score consistency with end-by-end tracking
- Real-time validation during score entry
- Automatic match completion when 13 points reached
- Score history tracking for dispute resolution

### Phase 3: Court Management Actions
**File**: `/src/lib/actions/courts.ts`

**Court Assignment Actions**:
1. `assignMatchToCourt(matchId: string, courtId: string)` - Assign match to court
2. `releaseCourtAssignment(matchId: string)` - Release court from match
3. `findAvailableCourt(tournamentId: string, timeSlot?: TimeSlot)` - Find available court
4. `getCourtAvailability(courtId: string, dateRange?: DateRange)` - Check court availability
5. `getCourtSchedule(courtId: string, dateRange?: DateRange)` - Get court schedule
6. `reserveCourtForMatch(courtId: string, matchId: string)` - Reserve court for match

**Court Management Actions**:
1. `updateCourtStatus(courtId: string, status: CourtStatus)` - Update court status
2. `setCourtMaintenance(courtId: string, reason?: string)` - Set maintenance mode
3. `getCourtUtilization(dateRange?: DateRange)` - Get utilization statistics

### Phase 4: Bracket Management Actions
**File**: `/src/lib/actions/bracket-management.ts`

**Tournament Progression Actions**:
1. `generateBracketMatches(tournamentId: string, bracketType: BracketType)` - Generate tournament bracket
2. `updateBracketProgression(tournamentId: string, matchId: string)` - Update bracket after match completion  
3. `getActiveTournamentMatches(tournamentId: string)` - Get all active tournament matches
4. `getBracketStructure(tournamentId: string)` - Get current bracket structure
5. `advanceWinnerToBracket(matchId: string, winnerId: string)` - Advance winner to next round
6. `getBracketResults(tournamentId: string, round: number, bracketType: BracketType)` - Get round results

### Phase 5: Server-Sent Events (Real-time)
**Files**: `/src/app/api/live/[...route]/route.ts`

**SSE Event Streams**:
1. `GET /api/live/match/[id]` - Match-specific updates (score, status, ends)
2. `GET /api/live/tournament/[id]` - Tournament-wide match updates
3. `GET /api/live/bracket/[id]` - Bracket progression updates
4. `GET /api/live/court/[id]` - Court assignment and status updates

**Event Broadcasting Integration**:
- Integrate with server actions to broadcast events after database updates
- Event batching for performance optimization
- Connection management with automatic cleanup
- Client reconnection handling

### Phase 6: Integration & Testing
**Files**: 
- `/__tests__/actions/matches/` - Comprehensive test suite
- `/__tests__/actions/live-scoring/` - Live scoring tests
- `/__tests__/actions/courts/` - Court management tests
- `/__tests__/actions/bracket-management/` - Bracket tests

## Technical Implementation Details

### Server Actions Pattern (Following Tournament Pattern)

```typescript
// Form-compatible interface
export const updateMatchScore: ServerAction<Match> = async (matchId: string, formData: FormData) => {
  'use server'
  
  try {
    const scoreData = formDataToScoreData(formData)
    const validation = ScoreSchema.safeParse(scoreData)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid score data',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Validate Petanque rules
    const ruleValidation = validatePetanqueScore(validation.data.team1, validation.data.team2)
    if (!ruleValidation.valid) {
      return {
        success: false,
        error: ruleValidation.error,
        fieldErrors: { score: [ruleValidation.error] }
      }
    }
    
    const result = await matchDB.updateScore(matchId, validation.data)
    const actionResult = resultToActionResult(result, 'Score updated successfully')
    
    if (actionResult.success) {
      // Broadcast real-time update
      await broadcastMatchUpdate(matchId, actionResult.data)
      revalidatePath(`/tournaments/${actionResult.data.tournamentId}`)
      revalidatePath(`/matches/${matchId}`)
    }
    
    return actionResult
  } catch (error) {
    return {
      success: false,
      error: 'An unexpected error occurred while updating the score'
    }
  }
}

// Programmatic interface
export const updateMatchScoreData: TypedAction<{matchId: string, score: Partial<Score>}, Match> = async (input) => {
  'use server'
  return resultToActionResult(await matchDB.updateScore(input.matchId, input.score))
}
```

### Real-time Event Broadcasting Pattern

```typescript
// Event broadcasting helper
async function broadcastMatchUpdate(matchId: string, match: Match) {
  const eventData = {
    type: 'MATCH_UPDATE',
    matchId,
    data: match,
    timestamp: new Date().toISOString()
  }
  
  // Broadcast to match-specific listeners
  await publishSSEEvent(`match:${matchId}`, eventData)
  
  // Broadcast to tournament-wide listeners
  await publishSSEEvent(`tournament:${match.tournamentId}`, eventData)
  
  // Broadcast bracket updates if match completed
  if (match.status === 'completed') {
    await publishSSEEvent(`bracket:${match.tournamentId}`, {
      type: 'BRACKET_UPDATE',
      tournamentId: match.tournamentId,
      matchId,
      winner: match.winner,
      timestamp: new Date().toISOString()
    })
  }
}
```

### Form Integration for Progressive Enhancement

```typescript
// HTML form for live scoring
<form action={submitEndScore.bind(null, matchId)}>
  <input name="team1Points" type="number" min="0" max="6" required />
  <input name="team2Points" type="number" min="0" max="6" required />
  <input name="jackPositionX" type="number" step="0.1" />
  <input name="jackPositionY" type="number" step="0.1" />
  <button type="submit">Submit End Score</button>
</form>

// React 19 optimistic updates
const [formState, formAction] = useActionState(submitEndScore, {
  optimisticData: null
})
```

## File Structure Plan

```
src/
├── lib/
│   ├── actions/
│   │   ├── matches.ts              # Core match CRUD operations
│   │   ├── live-scoring.ts         # Real-time scoring actions
│   │   ├── courts.ts               # Court management actions
│   │   ├── bracket-management.ts   # Tournament progression actions
│   │   └── index.ts                # Export all actions
│   ├── api/
│   │   └── sse.ts                  # SSE broadcasting utilities
├── app/
│   └── api/
│       └── live/
│           ├── match/
│           │   └── [id]/
│           │       └── route.ts    # Match-specific SSE stream
│           ├── tournament/
│           │   └── [id]/
│           │       └── route.ts    # Tournament-wide SSE stream
│           ├── bracket/
│           │   └── [id]/
│           │       └── route.ts    # Bracket progression SSE stream
│           └── court/
│               └── [id]/
│                   └── route.ts    # Court status SSE stream
└── __tests__/
    └── actions/
        ├── matches/
        │   ├── matches.test.ts     # Core match operations
        │   ├── live-scoring.test.ts # Live scoring tests
        │   ├── courts.test.ts      # Court management tests
        │   └── bracket-management.test.ts # Bracket tests
        └── api/
            └── sse.test.ts         # SSE integration tests
```

## Performance & Real-time Requirements

### Performance Targets
- **Scoring latency**: <500ms from input to UI update
- **SSE event delivery**: <2s for real-time updates  
- **Concurrent matches**: Support 50+ simultaneous games
- **Score validation**: <100ms for rule checking
- **Bracket updates**: <1s for progression calculation

### Real-time Architecture
- **Connection pooling** for SSE clients
- **Event batching** to reduce update frequency
- **Selective broadcasting** based on subscription topics
- **Automatic reconnection** with exponential backoff
- **Event persistence** for missed updates during disconnects

## Testing Strategy

### Unit Tests
- All server actions with success/error scenarios
- Form data validation and conversion
- Business rule enforcement (Petanque rules)
- Database error handling
- SSE event broadcasting

### Integration Tests  
- End-to-end scoring workflows
- Real-time event propagation
- Multiple concurrent matches
- Bracket progression logic
- Court assignment conflicts

### Performance Tests
- Concurrent scoring load testing
- SSE connection scaling
- Database operation benchmarks
- Event broadcasting performance

## Success Criteria

- [ ] All match CRUD operations implemented following ActionResult<T> pattern
- [ ] Live scoring with real-time Petanque rule validation working
- [ ] End-by-end scoring with detailed tracking and history
- [ ] Match lifecycle management (start, pause, complete, cancel)
- [ ] Court assignment with conflict prevention
- [ ] Tournament bracket progression logic integrated
- [ ] Server-Sent Events working for real-time updates
- [ ] Form-compatible interfaces work without JavaScript
- [ ] Optimistic updates provide immediate UI feedback
- [ ] Performance requirements met (scoring <500ms, updates <2s)
- [ ] Comprehensive error handling with user-friendly messages
- [ ] Complete test coverage for all actions and edge cases
- [ ] Integration with existing tournament and player systems
- [ ] Multi-device synchronization working correctly

## Dependencies

**Existing Infrastructure** (✅ Complete):
- MatchDB class with comprehensive operations
- CourtDB class with status management  
- Match validation schemas with Petanque rules
- Tournament server actions pattern
- Testing infrastructure with Jest

**New Development** (❌ To Implement):
- Server actions for match, scoring, court, bracket management
- SSE routes and broadcasting system
- Real-time event schemas and validation
- Integration tests for end-to-end workflows

## Implementation Notes

### Form Data Conversion Strategy
- Use existing `parseFormDataField` helpers from tournament actions
- Type-safe conversion with comprehensive validation
- Field-level error messages for scoring forms

### Real-time Strategy
- SSE for real-time updates (not WebSocket due to Next.js constraints)
- Event-driven architecture with publish/subscribe pattern
- Connection management with cleanup on disconnect

### Database Strategy  
- Leverage existing MatchDB and CourtDB classes
- Transaction-like operations for score consistency
- Bulk operations for tournament bracket generation

### Error Handling Strategy
- ActionResult<T> pattern for consistent error responses
- Business rule violations with clear messages
- Graceful degradation when real-time features fail

This implementation will provide a comprehensive match management and live scoring system with real-time capabilities while maintaining consistency with the existing server actions architecture.