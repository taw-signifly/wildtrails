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
- **State Management**: Zustand + React Context for global state
- **Data Storage**: JSON files with Node.js fs operations for mock data
- **Server Actions**: Next.js 15 server actions for all CRUD operations (preferred over API routes)
- **Real-time Updates**: Server-Sent Events (SSE) for live tournament updates
- **Form Integration**: React 19 `useActionState` with progressive enhancement

**Key Configuration**:

- TypeScript path mapping: `@/*` maps to `./src/*`
- ESLint extends `next/core-web-vitals` and `next/typescript`
- Uses Turbopack for fast development builds

**Current Project Structure**:
```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # Dashboard route group (planned)
│   ├── tournament/          # Active tournament views (planned)
│   ├── api/live/            # SSE routes only (real-time events)
│   └── ...
├── components/              # React components
│   └── ui/                  # ShadCN base components
├── lib/                     # Utility libraries
│   ├── actions/             # ✅ Server Actions (preferred over API routes)
│   │   ├── tournaments.ts   # Tournament CRUD & management
│   │   ├── tournament-management.ts # Tournament lifecycle
│   │   └── tournament-utils.ts      # Utility actions
│   ├── api/                 # API utilities for server actions
│   │   ├── response.ts      # Response formatting
│   │   ├── pagination.ts    # Pagination helpers
│   │   ├── validation.ts    # Input validation
│   │   └── middleware.ts    # Security & rate limiting
│   ├── db/                  # JSON database operations
│   │   ├── base.ts          # Base database class
│   │   ├── tournaments.ts   # Tournament data operations
│   │   ├── players.ts       # Player data operations
│   │   ├── matches.ts       # Match data operations
│   │   └── courts.ts        # Court management
│   └── validation/          # Zod schemas for type safety
│       ├── tournament.ts    # Tournament validation
│       ├── player.ts        # Player validation
│       └── match.ts         # Match validation
├── types/                   # TypeScript definitions
│   ├── index.ts             # Core domain types
│   └── actions.ts           # Server action types
└── data/                    # Mock JSON files (development)
```

## Server Actions Architecture

**WildTrails uses Next.js 15 server actions as the primary data layer**, providing type-safe, progressive enhancement and direct database access without traditional API routes.

### Current Implementation Status

✅ **Tournament Management** (Fully Implemented):
- Complete CRUD operations (`tournaments.ts`)
- Tournament lifecycle management (`tournament-management.ts`) 
- Utility actions for filtering and search (`tournament-utils.ts`)
- Form-compatible and programmatic interfaces
- End-to-end type safety with `ActionResult<T>` pattern

🔄 **Ready for Implementation**:
- **Players Management** (Issue #5) - Player CRUD, team formation, statistics
- **Match Management** (Issue #6) - Live scoring, bracket progression, real-time updates
- **Courts Management** - Court assignment, scheduling, availability
- **Real-time Features** - SSE integration, live tournament feeds

### Server Actions Pattern

All server actions follow a consistent pattern:

```typescript
// Form-compatible interface
export const createTournament: ServerAction<Tournament> = async (formData: FormData) => {
  'use server'
  // Form data parsing, validation, database operation
}

// Programmatic interface
export const createTournamentData: TypedAction<TournamentFormData, Tournament> = async (data) => {
  'use server' 
  // Direct data validation, database operation
}

// Standard return type
export type ActionResult<T> = {
  success: true; data: T; message?: string
} | {
  success: false; error: string; fieldErrors?: Record<string, string[]>
}
```

### Key Benefits

- **Zero API Routes Needed** - Direct database access from server components
- **Built-in CSRF Protection** - Automatic security without middleware
- **Progressive Enhancement** - Forms work without JavaScript  
- **Type Safety** - End-to-end types from forms to database
- **React 19 Integration** - Works with `useActionState` for optimistic updates

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

- **Server Actions First**: Use server actions for all CRUD operations, only use API routes for SSE streams
- **Progressive Enhancement**: All forms work without JavaScript using server actions
- **Type Safety**: End-to-end type safety from HTML forms to database with Zod validation
- **Performance**: Support up to 200 players per tournament with real-time updates under 2 seconds
- **Data Storage**: JSON file storage for development with plans for database integration later

### Development Workflow

1. **Database Layer**: Extend existing classes in `/src/lib/db/` for new entities
2. **Validation**: Create Zod schemas in `/src/lib/validation/` for type safety
3. **Server Actions**: Implement in `/src/lib/actions/` following tournament pattern
4. **Types**: Update `/src/types/actions.ts` for new action signatures
5. **Forms**: Use React 19 `useActionState` with server actions for optimal UX

### Key Implementation Files

- **Tournament Actions**: `/src/lib/actions/tournaments.ts` - Reference implementation
- **Action Types**: `/src/types/actions.ts` - Type definitions for all server actions
- **Database Base**: `/src/lib/db/base.ts` - Shared database functionality
- **API Utils**: `/src/lib/api/` - Utilities adapted for server action use

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
