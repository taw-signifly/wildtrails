# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WildTrails is a Next.js 15 application built with React 19, TypeScript, and TailwindCSS v4. The project is a **Petanque Tournament Management System** - a comprehensive web application that enables tournament organizers to create, manage, and track Petanque tournaments with real-time scoring, player tracking, bracket management, and elimination rounds.

### Business Goals
- Digitize and streamline Petanque tournament management
- Provide real-time tournament tracking for players and spectators
- Reduce manual scoring errors and administrative overhead
- Support tournaments with up to 200 players with real-time updates

### Target Users
- **Tournament Organizers**: Club officials, event coordinators
- **Players**: Registered tournament participants
- **Spectators**: Audience members, family, friends
- **Club Administrators**: Long-term tournament data managers

## Agent Usage

**Always use specialized agents proactively when applicable:**

- **react-nextjs-expert**: For Next.js development, App Router, SSR/SSG, server components, and optimization
- **debug-specialist**: For errors, test failures, unexpected behavior, build issues, or technical problems
- **sql-pro**: For complex SQL queries, database optimization, schema design, and database migrations and operations
- **code-reviewer**: For comprehensive code quality assessment after completing coding tasks

Use the Task tool to launch these agents proactively when their expertise matches the work being done.

## Development Commands

- `npm run dev` - Start development server with Turbopack (opens at http://localhost:3000)
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint with Next.js configuration

## Architecture & Structure

**Framework**: Next.js 15 with App Router

- Uses the `/src/app` directory structure for routing
- TypeScript with strict mode enabled
- TailwindCSS v4 for styling with PostCSS + ShadCN UI components
- Geist font family (sans and mono) preloaded from Google Fonts
- **State Management**: Zustand stores with real-time subscriptions and persistence
- **Database**: Supabase PostgreSQL with real-time subscriptions and Row Level Security
- **Server Actions**: Next.js 15 server actions with Supabase backend (preferred over API routes)
- **Real-time Updates**: Supabase real-time subscriptions integrated with Zustand stores
- **Form Integration**: React 19 `useActionState` with progressive enhancement

**Key Configuration**:

- TypeScript path mapping: `@/*` maps to `./src/*`
- ESLint extends `next/core-web-vitals` and `next/typescript`
- Uses Turbopack for fast development builds

**Current Project Structure**:
```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # Dashboard route group
│   ├── tournament/          # Active tournament views
│   └── ...
├── components/              # React components
│   └── ui/                  # ShadCN base components
├── lib/                     # Utility libraries
│   ├── actions/             # ✅ Server Actions with Supabase backend
│   │   ├── tournaments.ts   # Tournament CRUD & management
│   │   ├── players.ts       # Player management actions
│   │   ├── matches.ts       # Match scoring actions
│   │   └── teams.ts         # Team formation actions
│   ├── db/                  # ✅ Supabase Database Layer
│   │   ├── supabase.ts      # Supabase client configuration
│   │   ├── supabase-base.ts # Base Supabase database class
│   │   ├── tournaments-supabase.ts # Tournament operations
│   │   ├── players-supabase.ts     # Player operations
│   │   ├── matches-supabase.ts     # Match operations
│   │   ├── teams-supabase.ts       # Team operations
│   │   └── courts-supabase.ts      # Court management
│   └── validation/          # Zod schemas for type safety
│       ├── tournament.ts    # Tournament validation
│       ├── player.ts        # Player validation
│       └── match.ts         # Match validation
├── stores/                  # ✅ Zustand Global State
│   ├── tournament-store.ts  # Tournament state with real-time updates
│   ├── player-store.ts      # Player management state
│   ├── match-store.ts       # Match scoring state
│   └── index.ts             # Store exports
├── types/                   # TypeScript definitions
│   ├── index.ts             # Core domain types
│   └── actions.ts           # Server action types
└── supabase/                # Database schema and migrations
```

## Database & State Architecture

**WildTrails uses Supabase PostgreSQL as the primary database** with Next.js 15 server actions providing type-safe, progressive enhancement and real-time capabilities through Zustand stores.

### Current Implementation Status

✅ **Database Layer** (Fully Implemented):
- Supabase PostgreSQL database with complete schema
- Base Supabase database class with CRUD operations
- Tournament, Player, Match, Team, and Court database classes
- Real-time subscription support with Row Level Security
- Type-safe database operations with comprehensive error handling

✅ **Tournament Management** (Fully Implemented):
- Complete CRUD operations with Supabase backend
- Zustand store with real-time updates and persistence
- Server actions with optimistic updates and rollback
- Form-compatible and programmatic interfaces
- End-to-end type safety with `ActionResult<T>` pattern

🔄 **In Progress**:
- **Player Management** - Player store and real-time features
- **Match Management** - Live scoring with real-time updates
- **Team Management** - Team formation and management
- **Court Management** - Court assignment and scheduling

### Database Architecture Pattern

**Supabase Database Layer**:

```typescript
// Supabase database class extending base functionality
export class TournamentSupabaseDB extends SupabaseDB<Tournament> {
  constructor() {
    super('Tournament', { tableName: 'tournaments', enableRealtime: true }, tournamentSchema)
  }

  // Custom methods for complex operations
  async findPaginated(page: number, limit: number, filters?: TournamentFilter) {
    // Complex filtering and pagination logic
  }
}
```

**Server Actions with Supabase**:

```typescript
// Server action using Supabase database class
export const createTournament: ServerAction<Tournament> = async (formData: FormData) => {
  'use server'
  const db = new TournamentSupabaseDB()
  const result = await db.create(validatedData)
  return result.error ? { success: false, error: result.error.message } : { success: true, data: result.data }
}

// Standard return type
export type ActionResult<T> = {
  success: true; data: T; message?: string
} | {
  success: false; error: string; fieldErrors?: Record<string, string[]>
}
```

**Zustand Store with Real-time**:

```typescript
// Zustand store with Supabase real-time subscriptions
export const useTournamentStore = create<TournamentStore>()((
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State management with optimistic updates
        startRealTimeUpdates: () => {
          supabase.channel('tournaments_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, (payload) => {
              // Handle real-time updates
            })
            .subscribe()
        }
      })
    )
  )
))
```

### Key Benefits

**Database & Performance**:
- **PostgreSQL Power** - ACID transactions, foreign keys, and complex queries
- **Real-time Updates** - Instant UI updates via Supabase subscriptions
- **Optimistic Updates** - Zustand stores with rollback capabilities
- **Row Level Security** - Built-in data security and access control
- **Connection Pooling** - Efficient database connection management

**Developer Experience**:
- **Type Safety** - Generated TypeScript types from Supabase schema
- **Progressive Enhancement** - Forms work without JavaScript via server actions
- **Built-in CSRF Protection** - Automatic security without middleware
- **State Persistence** - Zustand persistence with selective caching
- **Error Handling** - Comprehensive error boundaries and validation

## Core Features to Implement

### Tournament Management
- **Tournament Types**: Single/Double Elimination, Swiss System, Round-Robin, Barrage Format
- **Player Registration**: Import/manual entry, team formation (singles/doubles/triples)
- **Bracket Generation**: Automated seeding and bracket creation
- **Live Scoring**: Real-time score entry with Petanque rule validation

### Key Components
- **TournamentBracket**: Interactive bracket visualization
- **ScoringInterface**: Touch-optimized scoring for mobile/tablet
- **PlayerManagement**: Player profiles, team creation, check-in
- **LiveDashboard**: Real-time tournament monitoring

### Data Models
Key entities include Tournament, Player, Match, Team with specific Petanque scoring rules (games to 13 points, end-by-end scoring, points differential calculations).

## Development Notes

This is a **Petanque tournament management system** with complex tournament logic, real-time scoring, and bracket management. The application uses Next.js App Router with **Server Actions as the primary data layer** instead of traditional API routes.

### Architecture Principles

- **Supabase First**: Use Supabase database classes for all data operations with server actions as the interface
- **Real-time by Design**: Zustand stores subscribe to Supabase real-time events for instant updates
- **Progressive Enhancement**: All forms work without JavaScript using server actions with database backend
- **Type Safety**: End-to-end type safety from HTML forms to PostgreSQL with generated types and Zod validation
- **Performance**: Support up to 200 players per tournament with real-time updates under 1 second via database subscriptions
- **Optimistic UX**: Zustand stores provide immediate UI feedback with automatic rollback on errors

### Development Workflow

1. **Database Schema**: Design PostgreSQL schema in Supabase with proper relationships and RLS
2. **Database Layer**: Create Supabase database classes extending `SupabaseDB` base class
3. **Validation**: Create Zod schemas in `/src/lib/validation/` matching database types
4. **Server Actions**: Implement in `/src/lib/actions/` using Supabase database classes
5. **Zustand Store**: Create stores with real-time subscriptions and optimistic updates
6. **Components**: Use React 19 `useActionState` with Zustand selectors for optimal UX

### Key Implementation Files

**Database Layer**:
- **Supabase Client**: `/src/lib/db/supabase.ts` - Database client configuration and type definitions
- **Base Class**: `/src/lib/db/supabase-base.ts` - Abstract base class for all database operations
- **Tournament DB**: `/src/lib/db/tournaments-supabase.ts` - Tournament database operations (reference implementation)

**State Management**:
- **Tournament Store**: `/src/stores/tournament-store.ts` - Complete Zustand store with real-time subscriptions
- **Store Index**: `/src/stores/index.ts` - Centralized store exports and configuration

**Server Actions**:
- **Tournament Actions**: `/src/lib/actions/tournaments.ts` - Server actions using Supabase backend
- **Action Types**: `/src/types/actions.ts` - Type definitions for all server actions

**Dependencies**:
- `@supabase/supabase-js` - Supabase JavaScript client
- `@supabase/ssr` - Next.js SSR support for Supabase
- `zustand` - Lightweight state management with subscriptions and persistence

### Testing Infrastructure

The project uses **Jest** for unit and integration testing:

- **Database Tests**: `/src/lib/db/__tests__/` - Test database operations and business logic
- **Existing Coverage**: Tournament and base database functionality tested
- **Test Pattern**: Each database class has comprehensive test coverage
- **Mock Data**: Tests use realistic tournament scenarios with proper validation

**Test Commands**:
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Environment Setup

**Required Environment Variables**:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Database Schema**:
- All database tables include proper foreign key relationships
- Row Level Security (RLS) enabled for secure data access
- Real-time subscriptions enabled on all tables
- Automatic timestamp management with `created_at` and `updated_at`
- UUID primary keys with PostgreSQL `gen_random_uuid()`
