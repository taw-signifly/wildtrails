# Issue #2: Create TypeScript interfaces and data models

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/2

## Summary

Implement comprehensive Zod validation schemas for the Petanque tournament system. The TypeScript interfaces are already complete and comprehensive in `src/types/index.ts`, but the issue requires Zod validation schemas for data validation.

## Current State Analysis

### ✅ Already Complete
The TypeScript interfaces in `src/types/index.ts` are comprehensive and include:

- **Core Entities**: Tournament, Player, Team, Match, Court, Bracket, Standing
- **API Response Types**: APIResponse, PaginatedResponse, Result<T,E> with tryCatch utility
- **Real-time Event Types**: TournamentUpdateEvent, MatchUpdateEvent, ScoreUpdateData, etc.
- **Form Data Types**: TournamentFormData, PlayerFormData, MatchFormData, EndScore
- **Filter and Search Types**: TournamentFilters, PlayerFilters, MatchFilters
- **Analytics Types**: TournamentAnalytics, PlayerDistributionStats, DurationStats, etc.
- **Utility Types**: Position, Boule, End, Score with proper type unions and enums

All types are properly exported and ready for use across the application.

### 🔲 Missing (To Implement)
- Zod validation schemas in `src/lib/validation/` directory
- Tournament validation (`src/lib/validation/tournament.ts`)
- Player validation (`src/lib/validation/player.ts`)
- Match validation (`src/lib/validation/match.ts`)
- Additional entity validations (Team, Court, etc.)
- Comprehensive test suite for validation schemas

## Implementation Plan

### Phase 1: Directory Setup
1. Create `src/lib/validation/` directory structure
2. Install Zod dependency if not already present

### Phase 2: Core Validation Schemas
3. **Tournament Validation** (`tournament.ts`)
   - TournamentFormData validation
   - Tournament entity validation
   - TournamentSettings validation
   - Nested validation for TournamentStats

4. **Player Validation** (`player.ts`)
   - PlayerFormData validation
   - Player entity validation  
   - PlayerStats and PlayerPreferences validation

5. **Match Validation** (`match.ts`)
   - MatchFormData validation
   - Match entity validation
   - Score validation with Petanque rules
   - End and Boule validation

### Phase 3: Extended Validations
6. **Additional Entity Validations**
   - Team validation schema
   - Court validation schema
   - Bracket validation schema
   - Standing validation schema

7. **API and Event Validations**
   - APIResponse validation
   - Real-time event validations
   - Filter validation schemas

### Phase 4: Integration & Testing
8. **Main Index File** (`src/lib/validation/index.ts`)
   - Export all validation schemas
   - Create utility functions for validation
   - Error handling patterns

9. **Comprehensive Testing**
   - Unit tests for each validation schema
   - Test with valid and invalid sample data
   - Edge case testing (boundary values, malformed data)

10. **Integration Verification**
    - Build passes without errors
    - All validation schemas compile correctly
    - Types are properly inferred from schemas

## Technical Requirements

### Zod Schema Patterns
- Use TypeScript inference: `z.infer<typeof schema>`
- Implement proper error messages
- Support optional/partial validation for updates
- Validate nested objects and arrays
- Custom validation rules for Petanque-specific logic

### Validation Rules
- **Tournament**: Name length, max players (4-200), valid dates, enum validation
- **Player**: Email format, ranking ranges, phone format
- **Match**: Score validation (0-13), end validation, time validation
- **Court**: Dimension validation, proper surface types
- **Data Integrity**: Cross-reference validation (tournamentId exists, etc.)

### Performance Considerations
- Lazy validation schemas where possible
- Efficient error handling
- Minimal runtime overhead
- Tree-shakable exports

## Acceptance Criteria Status

- [x] Complete Tournament interface with all properties ✓ (Already in types/index.ts)
- [x] Complete Player interface with stats and preferences ✓ (Already in types/index.ts)
- [x] Complete Team interface with member management ✓ (Already in types/index.ts)
- [x] Complete Match interface with scoring and timing ✓ (Already in types/index.ts)
- [x] Complete Court interface with specifications ✓ (Already in types/index.ts)
- [x] Complete Bracket and Standing interfaces ✓ (Already in types/index.ts)
- [x] API response types (APIResponse, PaginatedResponse) ✓ (Already in types/index.ts)
- [x] Real-time event types for SSE ✓ (Already in types/index.ts)
- [x] Form data types for user input ✓ (Already in types/index.ts)
- [x] Filter and search types ✓ (Already in types/index.ts)
- [x] Analytics and statistics types ✓ (Already in types/index.ts)
- [ ] Set up Zod validation schemas for data validation 🔲 (To implement)
- [x] Export all types for easy importing across the app ✓ (Already in types/index.ts)

## Files to Create

1. `src/lib/validation/tournament.ts` - Tournament validation schemas
2. `src/lib/validation/player.ts` - Player validation schemas
3. `src/lib/validation/match.ts` - Match validation schemas
4. `src/lib/validation/team.ts` - Team validation schemas  
5. `src/lib/validation/court.ts` - Court validation schemas
6. `src/lib/validation/common.ts` - Common validation utilities
7. `src/lib/validation/index.ts` - Main exports file
8. `__tests__/lib/validation/` - Test files for each validation schema

## Dependencies

- Zod: For runtime validation
- TypeScript: Already configured with strict mode
- Jest: For testing validation schemas

## Success Metrics

- All TypeScript interfaces compile without errors ✅ (Already achieved)
- Types are properly exported from main index file ✅ (Already achieved)
- Validation schemas work correctly with sample data 🔲 (To verify)
- Documentation includes type usage examples 🔲 (To create)
- 100% test coverage for validation schemas 🔲 (To implement)
- Build and lint pass without errors 🔲 (To verify)

## Next Steps

1. Check if Zod is already installed, install if needed
2. Create validation directory structure
3. Implement core validation schemas (tournament, player, match)
4. Create comprehensive test suite
5. Verify integration with existing type system
6. Create branch and submit PR