# Issue #3: Implement JSON data operations and database classes

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/3

## Summary

Implement comprehensive JSON-based database operations for the WildTrails Petanque Tournament Management System. This includes creating database classes for all core entities (Tournament, Player, Match, Court) with CRUD operations, backup functionality, and proper error handling.

## Current State Analysis

### ✅ Foundation Already Complete
- **TypeScript Interfaces**: Comprehensive types in `src/types/index.ts` (from Issue #2)
- **Zod Validation Schemas**: Complete validation in `src/lib/validation/` (from Issue #2)
- **Data Directory Structure**: Already created in `/data/` with proper subdirectories:
  - `data/tournaments/active/`
  - `data/tournaments/completed/` 
  - `data/tournaments/templates/`
  - `data/players/`
  - `data/matches/`
  - `data/courts/`
  - `data/system/backup/`

### 🔲 Missing (To Implement)
- Base database class with common CRUD operations
- Entity-specific database classes (Tournament, Player, Match, Court)
- Backup and restore functionality
- Error handling for file operations
- Database index and exports

## Technical Architecture

### Base Database Class Pattern
```typescript
abstract class BaseDB<T> {
  // Common CRUD operations
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  abstract findById(id: string): Promise<T | null>
  abstract findAll(filters?: Record<string, unknown>): Promise<T[]>
  abstract update(id: string, data: Partial<T>): Promise<T>
  abstract delete(id: string): Promise<void>
  abstract backup(id: string): Promise<void>
  
  // Utility methods
  protected generateId(): string
  protected getFilePath(id: string): string
  protected ensureDirectoryExists(): Promise<void>
  protected validateData(data: unknown): T
  protected addTimestamps(data: unknown): T
}
```

### Entity-Specific Classes
- **TournamentDB**: Tournament-specific operations, bracket generation support
- **PlayerDB**: Player operations, stats tracking, team assignments
- **MatchDB**: Match operations, scoring validation, tournament linkage
- **CourtDB**: Court management, availability tracking

### Validation Integration
Each database class will use the existing Zod schemas from `src/lib/validation/`:
- `schemas.tournament.entity` for Tournament validation
- `schemas.player.entity` for Player validation  
- `schemas.match.entity` for Match validation
- `schemas.court.entity` for Court validation

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Base Database Class** (`src/lib/db/base.ts`)
   - Abstract class with common CRUD operations
   - File system utilities (fs/promises)
   - Error handling patterns
   - ID generation (UUID v4)
   - Timestamp management (createdAt, updatedAt)
   - Directory management

2. **Backup Utilities** (`src/lib/db/backup.ts`)
   - Timestamped backup creation
   - Restore functionality
   - Backup cleanup (retain last N backups)
   - Automatic backup before destructive operations

### Phase 2: Entity Database Classes
3. **Tournament Database** (`src/lib/db/tournaments.ts`)
   ```typescript
   class TournamentDB extends BaseDB<Tournament> {
     async create(data: TournamentFormData): Promise<Tournament>
     async findByStatus(status: TournamentStatus): Promise<Tournament[]>
     async findByType(type: TournamentType): Promise<Tournament[]>
     async addPlayer(tournamentId: string, playerId: string): Promise<void>
     async removePlayer(tournamentId: string, playerId: string): Promise<void>
     async updateStats(id: string, stats: TournamentStats): Promise<Tournament>
   }
   ```

4. **Player Database** (`src/lib/db/players.ts`)
   ```typescript
   class PlayerDB extends BaseDB<Player> {
     async create(data: PlayerFormData): Promise<Player>
     async findByEmail(email: string): Promise<Player | null>
     async findByTournament(tournamentId: string): Promise<Player[]>
     async updateStats(id: string, stats: PlayerStats): Promise<Player>
     async updateRanking(id: string, ranking: number): Promise<Player>
   }
   ```

5. **Match Database** (`src/lib/db/matches.ts`)
   ```typescript
   class MatchDB extends BaseDB<Match> {
     async create(data: MatchFormData): Promise<Match>
     async findByTournament(tournamentId: string): Promise<Match[]>
     async findByPlayer(playerId: string): Promise<Match[]>
     async updateScore(id: string, score: Score): Promise<Match>
     async completeMatch(id: string, finalScore: Score): Promise<Match>
   }
   ```

6. **Court Database** (`src/lib/db/courts.ts`)
   ```typescript
   class CourtDB extends BaseDB<Court> {
     async create(data: Omit<Court, 'id' | 'createdAt' | 'updatedAt'>): Promise<Court>
     async findAvailable(): Promise<Court[]>
     async updateAvailability(id: string, available: boolean): Promise<Court>
     async assignMatch(id: string, matchId: string): Promise<Court>
   }
   ```

### Phase 3: Integration & Testing
7. **Database Index** (`src/lib/db/index.ts`)
   - Export all database classes
   - Create database manager/factory
   - Type definitions for database operations

8. **Comprehensive Testing**
   - Unit tests for each database class
   - Integration tests with sample data
   - Error handling tests
   - Performance tests with large datasets

## File Operations & Error Handling

### Directory Structure Management
```typescript
// Automatic directory creation
await ensureDirectoryExists('data/tournaments/active')
await ensureDirectoryExists('data/system/backup')
```

### Error Handling Patterns
- **FileNotFoundError**: When record doesn't exist
- **ValidationError**: When data doesn't pass Zod validation
- **PermissionError**: When file system access is denied
- **BackupError**: When backup operations fail

### Backup Strategy
- Automatic backup before update/delete operations
- Timestamped backup files: `{entity-id}-{timestamp}.json`
- Retention policy: Keep last 10 backups per entity
- Manual backup/restore functions

## Data Validation Flow

1. **Input Validation**: Use Zod schemas to validate input data
2. **Business Rules**: Apply Petanque-specific validation rules
3. **File Operations**: Safely read/write JSON with error handling
4. **Response Validation**: Validate data being returned

## Performance Considerations

### File System Operations
- Use `fs/promises` for async operations
- Implement file locking for concurrent access
- Cache frequently accessed data
- Batch operations where possible

### Data Indexing
- Simple in-memory indexes for common queries
- File-based indexes for complex filtering
- Lazy loading for large datasets

## Testing Strategy

### Unit Tests Structure
```
__tests__/lib/db/
├── base.test.ts           # Base class functionality
├── tournaments.test.ts    # Tournament-specific operations
├── players.test.ts        # Player-specific operations  
├── matches.test.ts        # Match-specific operations
├── courts.test.ts         # Court-specific operations
└── backup.test.ts         # Backup utilities
```

### Test Data
- Create sample JSON files for testing
- Mock file system operations where needed
- Test with invalid data to verify error handling
- Performance tests with 200+ players

## Acceptance Criteria Mapping

- [x] TypeScript interfaces available ✅ (from Issue #2)
- [x] Zod validation schemas available ✅ (from Issue #2)  
- [x] Data directory structure created ✅ (already exists)
- [ ] Create TournamentDB class with CRUD operations 🔲
- [ ] Create PlayerDB class with CRUD operations 🔲
- [ ] Create MatchDB class with CRUD operations 🔲
- [ ] Create CourtDB class with CRUD operations 🔲
- [ ] Implement automatic backup functionality 🔲
- [ ] Add error handling for file operations 🔲
- [ ] Implement data validation before write operations 🔲
- [ ] Create utility functions for JSON operations 🔲
- [ ] Add timestamp tracking (createdAt, updatedAt) 🔲
- [ ] Implement soft delete functionality 🔲
- [ ] Create data migration utilities 🔲

## Files to Create

1. `src/lib/db/base.ts` - Abstract base database class
2. `src/lib/db/tournaments.ts` - Tournament database operations
3. `src/lib/db/players.ts` - Player database operations  
4. `src/lib/db/matches.ts` - Match database operations
5. `src/lib/db/courts.ts` - Court database operations
6. `src/lib/db/backup.ts` - Backup utilities
7. `src/lib/db/index.ts` - Database exports and factory
8. `__tests__/lib/db/*.test.ts` - Comprehensive test suite

## Dependencies to Install

- `uuid` - For generating unique IDs
- `@types/uuid` - TypeScript definitions for uuid

## Success Metrics

- All database classes implement required CRUD operations
- Backup system creates timestamped copies before destructive operations
- Error handling covers file not found, permission errors, validation failures
- All operations are type-safe using existing interfaces and validation schemas
- Test coverage > 90% for all database operations
- Performance supports 200+ players with <2s response times
- Build and lint pass without errors

## Next Steps

1. Create feature branch: `feature/issue-3-json-database-operations`
2. Install required dependencies (uuid)
3. Implement base database class with common patterns
4. Implement entity-specific database classes
5. Create comprehensive test suite
6. Verify integration with existing validation schemas
7. Run build/lint verification
8. Create pull request with detailed testing results

## Integration Notes

### With Issue #2 Validation Schemas
- Use `schemas.tournament.entity` for Tournament validation
- Use `validators.tournament.entity()` for validation functions
- Apply `createValidationResult()` for standardized error handling

### With Future Issues
- Database classes will be used by API routes (Issue #4+)
- Real-time updates will publish database changes via SSE
- Tournament bracket generation will use TournamentDB and MatchDB
- Scoring interfaces will interact with MatchDB for live updates

## Risk Mitigation

### Data Loss Prevention
- Automatic backups before destructive operations
- Soft delete with restore capability
- Transaction-like operations (backup -> modify -> verify)

### Performance Risks
- File locking to prevent concurrent access issues
- Caching strategies for frequently accessed data
- Pagination for large result sets

### Development Risks
- Comprehensive test coverage before implementation
- Integration tests with real data scenarios
- Error handling for edge cases and malformed data