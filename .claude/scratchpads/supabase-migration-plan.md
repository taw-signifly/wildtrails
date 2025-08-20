# Supabase Migration Plan

**Issue**: Migrate from JSON file storage to Supabase PostgreSQL database  
**Goal**: Replace current JSON-based data layer with Supabase for better scalability, real-time updates, and data integrity  
**Related to**: Issue #14 (Zustand State Management) - Perfect timing for data layer abstraction

## Current State Analysis

### Existing JSON Database Classes
- `src/lib/db/base.ts` - Base database operations
- `src/lib/db/tournaments.ts` - Tournament CRUD operations  
- `src/lib/db/players.ts` - Player management
- `src/lib/db/matches.ts` - Match operations
- `src/lib/db/courts.ts` - Court management
- `src/lib/db/teams.ts` - Team operations

### Server Actions (Keep Interface)
- `src/lib/actions/tournaments.ts` - Tournament server actions
- `src/lib/actions/players.ts` - Player server actions
- `src/lib/actions/matches.ts` - Match server actions
- `src/lib/actions/courts.ts` - Court server actions
- `src/lib/actions/teams.ts` - Team server actions

### Data Types (Already Defined)
- `src/types/index.ts` - Core domain types
- `src/lib/validation/*.ts` - Zod validation schemas

## Migration Strategy

### Phase 1: Setup & Schema Design
1. **Supabase Project Setup**
   - Create new Supabase project
   - Configure environment variables
   - Install dependencies (`@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`)

2. **Database Schema Design**
   - Design PostgreSQL tables based on existing TypeScript types
   - Add proper relationships, constraints, and indexes
   - Include audit fields (created_at, updated_at)
   - Set up Row Level Security (RLS) policies

### Phase 2: Database Layer Migration  
3. **Replace Database Classes**
   - Create new Supabase client wrapper
   - Replace JSON file operations with SQL queries
   - Maintain same interface as existing database classes
   - Add transaction support for complex operations

4. **Server Actions Update**
   - Update server actions to use new Supabase database classes
   - Keep existing server action interfaces unchanged
   - Add proper error handling for database operations

### Phase 3: Real-time & State Management
5. **Real-time Subscriptions**
   - Set up Supabase real-time subscriptions
   - Create SSE endpoints that listen to database changes
   - Replace current manual SSE with database-driven events

6. **Zustand Integration**
   - Create Zustand stores that subscribe to real-time updates
   - Implement optimistic updates with rollback capability
   - Add state persistence for offline functionality

## Database Schema Design

### Core Tables

```sql
-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  format tournament_format NOT NULL,
  status tournament_status NOT NULL DEFAULT 'draft',
  max_players INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table  
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  club VARCHAR(255),
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type team_type NOT NULL,
  status team_status NOT NULL DEFAULT 'registered',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  role player_role NOT NULL DEFAULT 'player',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  team1_id UUID REFERENCES teams(id),
  team2_id UUID REFERENCES teams(id),
  court_id UUID,
  status match_status NOT NULL DEFAULT 'pending',
  score JSONB DEFAULT '{}',
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courts table
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status court_status NOT NULL DEFAULT 'available',
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Enums & Types
```sql
CREATE TYPE tournament_format AS ENUM ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'barrage');
CREATE TYPE tournament_status AS ENUM ('draft', 'registration', 'in_progress', 'completed', 'cancelled');
CREATE TYPE team_type AS ENUM ('singles', 'doubles', 'triples');
CREATE TYPE team_status AS ENUM ('registered', 'checked_in', 'active', 'eliminated');
CREATE TYPE match_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE court_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE player_role AS ENUM ('player', 'captain', 'substitute');
```

## Implementation Plan

### Step 1: Environment Setup
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Step 2: Database Client
```typescript
// src/lib/db/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### Step 3: Migration Sequence
1. Replace `base.ts` with Supabase client wrapper
2. Migrate `tournaments.ts` database class
3. Update tournament server actions  
4. Test tournament functionality
5. Repeat for players, matches, teams, courts
6. Add real-time subscriptions
7. Implement Zustand stores with real-time integration

## Benefits After Migration

### Performance & Scalability
- **Concurrent Access**: Multiple users can safely edit tournaments
- **Query Optimization**: PostgreSQL indexes and query planning
- **Connection Pooling**: Efficient database connection management

### Real-time Capabilities  
- **Live Updates**: Automatic UI updates when data changes
- **Tournament Broadcasting**: Real-time bracket and score updates
- **Multi-user Collaboration**: Live tournament management

### Data Integrity
- **ACID Transactions**: Consistent tournament state changes
- **Foreign Key Constraints**: Referential integrity between entities
- **Row Level Security**: Secure data access patterns

### Developer Experience
- **Type Safety**: Generated TypeScript types from schema
- **Better Testing**: Dedicated test database environment
- **Debugging**: PostgreSQL query logs and performance insights

## Migration Checklist

- [ ] Set up Supabase project and get credentials
- [ ] Install required dependencies  
- [ ] Create database schema and migrations
- [ ] Implement Supabase client wrapper
- [ ] Migrate database classes one by one
- [ ] Update server actions to use new database layer
- [ ] Set up real-time subscriptions
- [ ] Implement Zustand stores with real-time integration
- [ ] Migrate existing test data
- [ ] Update all tests to use test database
- [ ] Performance testing with larger datasets
- [ ] Documentation updates

## Risk Mitigation

### Data Loss Prevention
- Export existing JSON data before migration
- Test migration with sample data first
- Keep JSON backup system temporarily

### Performance Monitoring
- Monitor query performance during development
- Set up database monitoring and alerting
- Load test with realistic tournament data

### Rollback Plan
- Keep current JSON system functional during migration
- Feature flags to switch between data sources
- Gradual rollout strategy