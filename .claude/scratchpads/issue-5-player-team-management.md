# Issue #5: Player and Team Management Server Actions

**Issue Link**: https://github.com/[repo]/issues/5

## Analysis Summary

Implementing comprehensive server actions for player registration, profile management, team creation, and player statistics tracking following the established tournament actions pattern in Next.js 15.

## Prior Art Analysis

### Existing Tournament Actions Pattern (`/src/lib/actions/tournaments.ts`)

✅ **Key Patterns Identified:**
- `ActionResult<T>` return type for consistent error handling
- Dual interfaces: Form-compatible (`ServerAction<T>`) and programmatic (`TypedAction<TInput, TOutput>`)
- Zod validation with `formatZodErrors()` for field-level feedback
- `revalidatePath()` for cache invalidation after mutations
- `resultToActionResult()` helper for database result conversion
- Comprehensive error handling with try-catch and meaningful messages

✅ **Existing Infrastructure:**
- PlayerDB class fully implemented with comprehensive methods
- Player validation schemas complete in `/src/lib/validation/player.ts`
- Types well-defined in `/src/types/index.ts` and `/src/types/actions.ts`
- Test patterns established using Jest with mocks

❌ **Missing Components:**
- Player server actions implementation
- Team management (TeamDB class and server actions)
- Team validation schemas (partial implementation exists)

## Implementation Plan

### Phase 1: Player Server Actions

**File**: `/src/lib/actions/players.ts`

**Actions to Implement:**
1. **CRUD Operations**
   - `createPlayer(formData: FormData)` - Form-compatible
   - `createPlayerData(data: PlayerFormData)` - Programmatic
   - `getPlayers(filters?)` - With pagination support
   - `getPlayerById(id: string)`
   - `updatePlayer(id: string, formData: FormData)`
   - `updatePlayerData(id: string, data: Partial<PlayerFormData>)`
   - `deletePlayer(id: string)` - Soft delete/archive
   - `searchPlayers(query: string, filters?)`

2. **Statistics Management**
   - `updatePlayerStats(playerId: string, stats: Partial<PlayerStats>)`
   - `getPlayerTournamentHistory(playerId: string, limit?)`
   - `getPlayerPerformanceStats(playerId: string)`

**Key Business Rules:**
- Email uniqueness validation
- Ranking constraints (1-10000)
- Statistics calculation and validation
- Proper error handling with field-level feedback

### Phase 2: Team Management

**File**: `/src/lib/db/teams.ts` (TeamDB class)
- Extend BaseDB following PlayerDB pattern
- Team creation, validation, and member management
- Integration with tournament and player systems

**File**: `/src/lib/actions/teams.ts`

**Actions to Implement:**
1. **Team CRUD**
   - `createTeam(formData: FormData)`
   - `createTeamData(data: TeamFormData)`
   - `getTeams(filters?)`
   - `getTeamById(id: string)`
   - `updateTeam(id: string, formData: FormData)`
   - `updateTeamData(id: string, data: Partial<TeamFormData>)`
   - `deleteTeam(id: string)`

2. **Team Member Management**
   - `addPlayerToTeam(teamId: string, playerId: string)`
   - `removePlayerFromTeam(teamId: string, playerId: string)`
   - `validateTeamFormation(players: string[], format: GameFormat)`
   - `getTeamsByTournament(tournamentId: string)`

**Key Business Rules:**
- Team format validation (singles/doubles/triples = 1/2/3 players)
- No duplicate player memberships per tournament
- Team naming conventions and uniqueness
- Proper tournament integration

### Phase 3: Type Integration

**File**: `/src/types/actions.ts`
- Add player and team action type definitions
- Follow existing tournament pattern
- Export all new action types

**Files**: `/src/lib/actions/index.ts`
- Export all new player and team actions
- Maintain consistent API surface

### Phase 4: Testing

**Files**: 
- `/src/lib/db/__tests__/teams.test.ts` (new)
- `/__tests__/actions/players/players.test.ts` (new)
- `/__tests__/actions/teams/teams.test.ts` (new)

**Test Coverage:**
- All CRUD operations with success/error cases
- Validation error handling
- Business rule enforcement
- Database error handling
- Form data conversion
- Mock database with comprehensive scenarios

## Technical Standards

### Form Data Conversion Pattern
```typescript
function formDataToPlayerData(formData: FormData): Partial<PlayerFormData> {
  // Following tournament pattern with parseFormDataField helpers
  // Type-safe conversion with validation
}
```

### Error Handling Pattern
```typescript
export async function createPlayer(formData: FormData): Promise<ActionResult<Player>> {
  try {
    const playerData = formDataToPlayerData(formData)
    const validation = PlayerFormDataSchema.safeParse(playerData)
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    // Business rule: Email uniqueness
    const existingPlayer = await playerDB.findByEmail(validation.data.email)
    if (existingPlayer.data) {
      return {
        success: false,
        error: 'Email already exists',
        fieldErrors: { email: ['A player with this email already exists'] }
      }
    }
    
    const result = await playerDB.create(validation.data)
    const actionResult = resultToActionResult(result, 'Player created successfully')
    
    if (actionResult.success) {
      revalidatePath('/players')
    }
    
    return actionResult
  } catch (error) {
    return {
      success: false,
      error: 'An unexpected error occurred while creating the player'
    }
  }
}
```

### Validation Integration
- Reuse existing PlayerFormDataSchema and PlayerSchema
- Implement new TeamFormDataSchema and TeamSchema
- Ensure end-to-end type safety from forms to database

### Performance Considerations
- Implement pagination for large player lists (200+ players)
- Efficient search with indexing on key fields
- Proper cache invalidation strategies

## Dependencies

**External:**
- Existing PlayerDB class (✅ Complete)
- Player validation schemas (✅ Complete)
- Action utilities (✅ Complete)

**Internal:**
- TeamDB class implementation (❌ New)
- Team validation schemas (🔄 Extend existing)
- Team-related types (🔄 Extend existing)

## Success Criteria

- [ ] All player CRUD operations work with forms and programmatic calls
- [ ] Email uniqueness enforced with clear error messages  
- [ ] Player search by name, club, ranking range functional
- [ ] Statistics calculation and caching working
- [ ] Team formation with format validation (1/2/3 players)
- [ ] Team member management prevents duplicate memberships
- [ ] Integration with existing tournament and match systems
- [ ] Comprehensive error handling with user-friendly messages
- [ ] All actions follow ActionResult<T> pattern
- [ ] Performance tested with 200+ players
- [ ] Complete test coverage for all actions and edge cases
- [ ] Type-safe end-to-end from forms to database

## Implementation Notes

**Form Integration Strategy:**
- HTML forms work without JavaScript (progressive enhancement)
- React 19 `useActionState` integration for optimal UX
- Clear field-level validation errors

**Database Strategy:**
- JSON file storage for development (as per existing pattern)
- Extend existing BaseDB class for consistency
- Business logic in database layer where appropriate

**Error Handling Strategy:**
- Consistent ActionResult<T> return type
- Field-level errors for form validation
- Business rule violations with clear messages
- Graceful handling of database errors

This implementation will provide a robust foundation for player and team management while maintaining consistency with the existing tournament management architecture.