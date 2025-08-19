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
- **Real-time Updates**: Server-Sent Events (SSE) for live tournament updates

**Key Configuration**:

- TypeScript path mapping: `@/*` maps to `./src/*`
- ESLint extends `next/core-web-vitals` and `next/typescript`
- Uses Turbopack for fast development builds

**Planned Project Structure**:
```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # Dashboard route group  
│   ├── tournament/          # Active tournament views
│   ├── api/                 # API routes (tournaments, matches, players, live)
│   └── ...
├── components/              # React components
│   ├── ui/                  # ShadCN base components
│   ├── tournament/          # Tournament-specific components
│   ├── scoring/             # Scoring interface components
│   └── brackets/            # Bracket visualization
├── lib/                     # Utility libraries
│   ├── db/                  # JSON data operations
│   ├── tournament/          # Tournament logic & bracket generation
│   └── scoring/             # Scoring algorithms
├── types/                   # TypeScript definitions
├── stores/                  # Zustand stores
└── data/                    # Mock JSON files
```

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

This is a **Petanque tournament management system** with complex tournament logic, real-time scoring, and bracket management. The application uses Next.js App Router with Server Components for data fetching and Client Components for interactive tournament features. 

**Performance Requirements**: Support up to 200 players per tournament with real-time updates under 2 seconds. Uses JSON file storage for development with plans for database integration later.
