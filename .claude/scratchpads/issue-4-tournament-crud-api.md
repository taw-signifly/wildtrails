# Issue #4: Create Tournament CRUD Operations (Server Actions)

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/4

## Overview

Implement comprehensive Next.js 15 Server Actions for tournament management with proper TypeScript typing, Zod validation, and error handling. Server Actions are the modern, recommended approach for mutations in Next.js 15.

## Current State Analysis

✅ **Existing Infrastructure**:
- `TournamentDB` class with full CRUD operations (`src/lib/db/tournaments.ts`)
- Complete Zod validation schemas (`src/lib/validation/tournament.ts`)
- TypeScript type definitions (`src/types/index.ts`)
- `Result<T,E>` error handling pattern
- API utilities for consistent response handling
- Tests exist for database operations

❌ **Missing**:
- Server Actions for tournament CRUD operations
- Server Action tests
- Form action integration patterns

## Updated Implementation Plan - Server Actions Approach

### Phase 1: Core Tournament Server Actions
1. **Create main tournament actions file** (`src/lib/actions/tournaments.ts`)
   - `getTournaments()` - List tournaments with filtering and pagination
   - `getTournamentById()` - Get single tournament
   - `createTournament()` - Create new tournament
   - `updateTournament()` - Update existing tournament
   - `deleteTournament()` - Archive tournament (soft delete)

### Phase 2: Tournament Management Actions
2. **Create tournament management actions** (`src/lib/actions/tournament-management.ts`)
   - `startTournament()` - Change status from 'setup' to 'active'
   - `registerPlayerForTournament()` - Register player for tournament
   - `removePlayerFromTournament()` - Remove player from tournament
   - `cancelTournament()` - Cancel tournament

### Phase 3: Utility Actions
3. **Create tournament utility actions** (`src/lib/actions/tournament-utils.ts`)
   - `searchTournaments()` - Search tournaments by name/description
   - `getTournamentStats()` - Get tournament statistics
   - `duplicateTournament()` - Create tournament from template

### Phase 4: Testing & Integration
4. **Create comprehensive tests**
   - Unit tests for each server action
   - Integration tests with database operations
   - Form integration tests
   - Error handling scenarios

## Server Actions Architecture

### Benefits of Server Actions over API Routes:
- ✅ Type-safe form handling without API boilerplate
- ✅ Direct database access without HTTP overhead
- ✅ Built-in revalidation and cache invalidation
- ✅ Better integration with React 19 features
- ✅ Simplified error handling with form states
- ✅ Progressive enhancement support

### Server Action Specifications

#### Tournament Listing & Retrieval
```typescript
// Get tournaments with filtering
async function getTournaments(filters?: TournamentFilters & PaginationParams): Promise<Result<PaginatedResponse<Tournament>, Error>>

// Get single tournament
async function getTournamentById(id: string): Promise<Result<Tournament, Error>>

// Search tournaments
async function searchTournaments(query: string, filters?: TournamentFilters): Promise<Result<Tournament[], Error>>
```

#### Tournament CRUD Operations
```typescript
// Create tournament (form action)
async function createTournament(formData: FormData): Promise<ActionResult<Tournament>>
async function createTournamentData(data: TournamentFormData): Promise<Result<Tournament, Error>>

// Update tournament (form action)  
async function updateTournament(id: string, formData: FormData): Promise<ActionResult<Tournament>>
async function updateTournamentData(id: string, data: Partial<TournamentFormData>): Promise<Result<Tournament, Error>>

// Delete tournament
async function deleteTournament(id: string): Promise<Result<{id: string, archived: boolean}, Error>>
```

#### Tournament Management
```typescript
// Start tournament
async function startTournament(id: string): Promise<Result<Tournament, Error>>

// Player registration
async function registerPlayerForTournament(tournamentId: string, playerId: string): Promise<Result<Tournament, Error>>

// Cancel tournament
async function cancelTournament(id: string): Promise<Result<Tournament, Error>>
```

## File Structure Created

```
src/
├── lib/
│   ├── actions/
│   │   ├── tournaments.ts                   # Main CRUD actions
│   │   ├── tournament-management.ts         # Start, register, cancel actions
│   │   ├── tournament-utils.ts              # Search, stats, utilities
│   │   └── index.ts                         # Export all actions
│   ├── api/                                 # Keep utilities for response handling
│   │   ├── response.ts                      # Response utilities (adapted for actions)
│   │   ├── pagination.ts                    # Pagination utilities
│   │   ├── validation.ts                    # Validation utilities
│   │   └── index.ts                         # Centralized exports
├── types/
│   └── actions.ts                           # Action-specific types
└── __tests__/
    └── actions/
        └── tournaments/
            ├── tournaments.test.ts          # Main CRUD tests
            ├── tournament-management.test.ts # Management action tests
            └── tournament-utils.test.ts     # Utility action tests
```

## Action Types & Error Handling

```typescript
// Action result type for form handling
export type ActionResult<T> = {
  success: true
  data: T
  message?: string
} | {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
}

// Server action with form data
export type ServerAction<T> = (formData: FormData) => Promise<ActionResult<T>>

// Server action with typed data
export type TypedAction<TInput, TOutput> = (input: TInput) => Promise<Result<TOutput, Error>>
```

## Key Implementation Details

1. **Form Integration**: Actions work directly with FormData for seamless form handling
2. **Validation**: Use existing Zod schemas for both FormData and typed data validation
3. **Error Handling**: Return ActionResult for forms, Result<T,E> for programmatic use
4. **Revalidation**: Use Next.js revalidation APIs to update cached data
5. **Database Integration**: Direct use of existing TournamentDB methods
6. **Type Safety**: Full TypeScript support with proper typing throughout

## Usage Examples

### In Components:
```typescript
// Form action usage
<form action={createTournament}>
  <input name="name" required />
  <input name="type" required />
  <button type="submit">Create Tournament</button>
</form>

// Programmatic usage
const result = await getTournamentById('123')
if (result.error) {
  // handle error
} else {
  // use result.data
}
```

### Error Handling:
```typescript
// Server action returns ActionResult for forms
export async function createTournament(formData: FormData): Promise<ActionResult<Tournament>> {
  try {
    const validation = TournamentFormDataSchema.safeParse(Object.fromEntries(formData))
    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: formatZodErrors(validation.error)
      }
    }
    
    const result = await tournamentDB.create(validation.data)
    if (result.error) {
      return { success: false, error: result.error.message }
    }
    
    revalidatePath('/tournaments')
    return { success: true, data: result.data, message: 'Tournament created successfully' }
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' }
  }
}
```

## Success Criteria  

- [ ] All tournament CRUD operations implemented as Server Actions
- [ ] Form integration working correctly  
- [ ] Comprehensive test coverage (>90%)
- [ ] All tests passing
- [ ] Build passes without errors
- [ ] Proper error handling with ActionResult pattern
- [ ] Integration with existing TournamentDB operations
- [ ] Validation working correctly with existing schemas
- [ ] Revalidation working for cache invalidation