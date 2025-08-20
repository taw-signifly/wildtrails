# Issue #10: Create Dashboard and Tournament Overview Components

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/10

## Summary

Build comprehensive dashboard interface with tournament overview, quick actions, statistics, and real-time monitoring using ShadCN/UI components.

## Current State Analysis

### ✅ Already Implemented
- **Basic Dashboard**: `src/app/page.tsx` has basic dashboard with stats cards and recent tournaments
- **Dashboard Actions**: `src/lib/actions/dashboard.ts` provides `getDashboardStats()` and `getRecentTournaments()`
- **Layout Components**: Header, PageContainer, PageHeader from Issue #9 implementation
- **ShadCN/UI Components**: Card, Badge, Button, Sheet, Separator available
- **Server Actions Architecture**: Full tournament CRUD, matches, players, courts actions
- **SSE Routes**: `/api/live/*` routes for real-time updates

### ❌ Missing Components (To Implement)
- **Route Group Structure**: `(dashboard)` route group for organization
- **ActiveMatches Component**: Real-time live matches display with SSE
- **Statistics Component**: Enhanced stats with charts and metrics
- **RecentActivity Component**: Activity timeline with match/tournament events
- **Real-time Dashboard Hook**: SSE integration for live updates
- **Component Extraction**: Break down monolithic page.tsx into components

## Implementation Plan

### Phase 1: Route Structure Setup
Create `(dashboard)` route group to organize dashboard-related pages:
```
src/app/(dashboard)/
├── page.tsx                    # Main dashboard (move from root)
├── tournaments/page.tsx        # Tournament list view
├── statistics/page.tsx         # Statistics overview
└── live/page.tsx              # Live tournament monitoring
```

### Phase 2: Component Extraction & Enhancement

#### 1. TournamentList Component (`src/components/dashboard/tournament-list.tsx`)
- Extract existing recent tournaments display
- Add filtering and sorting capabilities
- Pagination for large tournament lists
- Action buttons (View, Edit, Join)
- Enhanced status indicators

#### 2. QuickActions Component (`src/components/dashboard/quick-actions.tsx`)
- Extract existing quick actions from page.tsx
- Add tournament templates
- Recent actions shortcuts
- Import players functionality
- Prominent CTA styling

#### 3. TournamentCard Component (`src/components/dashboard/tournament-card.tsx`)
- Individual tournament display
- Progress indicators (matches completed)
- Key metrics display
- Action buttons integration
- Responsive card layout

#### 4. ActiveMatches Component (`src/components/dashboard/active-matches.tsx`)
**New Component - Real-time SSE Integration**
- Display currently ongoing matches
- Live score updates via SSE streams
- Court assignments and timing
- Quick navigation to live scoring
- Auto-refresh match status

#### 5. Statistics Component (`src/components/dashboard/statistics.tsx`)
**Enhanced Version**
- Tournament summary statistics
- Player participation metrics
- Match completion rates
- Performance charts (using Recharts)
- Export functionality

#### 6. RecentActivity Component (`src/components/dashboard/recent-activity.tsx`)
**New Component**
- Timeline of recent activities
- Match completions and score updates
- Player registrations/withdrawals
- Tournament state changes
- Activity filtering and search

### Phase 3: Real-time Integration

#### Real-time Dashboard Hook (`src/hooks/use-real-time-dashboard.tsx`)
```typescript
interface DashboardUpdate {
  type: 'match_update' | 'tournament_status' | 'player_action'
  data: any
  timestamp: string
}

export function useRealTimeDashboard() {
  // SSE connection to /api/live/dashboard
  // Handle live updates for stats, matches, activities
  // Return real-time data and connection status
}
```

#### SSE Dashboard Route (`src/app/api/live/dashboard/route.ts`)
- Aggregate SSE stream for dashboard updates
- Match status changes
- Tournament progression
- Player activities
- Statistics updates

### Phase 4: Enhanced Data Actions

#### Extended Dashboard Actions (`src/lib/actions/dashboard.ts`)
```typescript
export async function getActiveMatches(): Promise<ActiveMatch[]>
export async function getRecentActivity(): Promise<ActivityEvent[]>
export async function getTournamentProgress(): Promise<TournamentProgress[]>
export async function getDashboardMetrics(): Promise<EnhancedMetrics>
```

## Technical Specifications

### Component Architecture
```typescript
// Dashboard Page Structure
Dashboard (Server Component)
├── QuickStats (Server Component)
├── TournamentList (Server Component)
│   └── TournamentCard (Server Component)
├── QuickActions (Server Component)
├── ActiveMatches (Client Component - SSE)
├── Statistics (Client Component - charts)
└── RecentActivity (Client Component - SSE)
```

### Real-time Data Flow
```
SSE Streams → useRealTimeDashboard → Component State → UI Updates
     ↓
/api/live/dashboard → Dashboard components → Real-time dashboard
/api/live/match/[id] → ActiveMatches → Live match updates
/api/live/tournament/[id] → TournamentList → Status changes
```

### Data Types
```typescript
interface ActiveMatch {
  id: string
  tournamentId: string
  tournamentName: string
  teams: [Team, Team]
  currentScore: [number, number]
  court: string
  status: 'active' | 'paused'
  duration: number
}

interface ActivityEvent {
  id: string
  type: 'match_completed' | 'tournament_started' | 'player_registered'
  title: string
  description: string
  timestamp: string
  relatedId: string
  entityType: 'tournament' | 'match' | 'player'
}

interface TournamentProgress {
  id: string
  name: string
  totalMatches: number
  completedMatches: number
  progressPercentage: number
  estimatedCompletion: string
}
```

## Implementation Strategy

### 1. **Incremental Migration**
- Keep existing dashboard functional during development
- Move components one at a time to avoid breaking changes
- Test each component extraction before proceeding

### 2. **SSE Integration Pattern**
- Use existing SSE infrastructure (`/api/live/*`)
- Implement graceful degradation without real-time updates
- Handle connection failures and reconnection logic

### 3. **Performance Optimization**
- Server Components for static content
- Client Components only for real-time features
- Efficient SSE event filtering
- Debounced updates for high-frequency events

## Files to Create/Modify

### New Files
```
src/
├── app/
│   └── (dashboard)/
│       ├── page.tsx                    # Moved from root page.tsx
│       ├── tournaments/page.tsx        # Tournament list view
│       ├── statistics/page.tsx         # Statistics overview
│       └── live/page.tsx              # Live monitoring
├── components/
│   └── dashboard/
│       ├── tournament-list.tsx         # Tournament listing
│       ├── quick-actions.tsx          # Action buttons
│       ├── tournament-card.tsx        # Individual tournament
│       ├── active-matches.tsx         # Live matches
│       ├── statistics.tsx             # Stats display
│       └── recent-activity.tsx        # Activity timeline
├── hooks/
│   └── use-real-time-dashboard.tsx    # Real-time updates
└── app/api/live/dashboard/
    └── route.ts                       # SSE dashboard stream
```

### Modified Files
```
src/
├── app/
│   └── page.tsx                       # Simplified root page or redirect
└── lib/actions/
    └── dashboard.ts                   # Extended with new functions
```

## Integration with Existing Features

### Server Actions Integration
- Use existing tournament, match, player actions
- Extend dashboard actions for new data needs
- Maintain consistent ActionResult<T> pattern

### Database Integration
- Leverage existing JSON database classes
- No new database operations needed
- Use existing tournament/match/player data

### SSE Infrastructure
- Build on existing `/api/live/*` routes
- Use established SSE patterns from match scoring
- Consistent event structure and handling

## Testing Strategy

### Component Testing
- Jest tests for each dashboard component
- Mock SSE connections for testing
- Test error states and loading states
- Responsive behavior testing

### Integration Testing
- End-to-end dashboard flow
- Real-time update scenarios
- SSE connection handling
- API integration validation

### Performance Testing
- Dashboard load times
- SSE event handling performance
- Memory usage with long-running connections
- Mobile performance optimization

## Acceptance Criteria Checklist

- [ ] Dashboard organized into logical component structure
- [ ] Real-time updates work without page refresh
- [ ] Tournament list displays with proper status indicators
- [ ] Active matches show live score updates
- [ ] Statistics display accurate calculations
- [ ] Recent activity timeline shows chronological events
- [ ] All components handle loading and error states
- [ ] Responsive design works on all screen sizes
- [ ] SSE connections gracefully handle failures
- [ ] Navigation between dashboard and detail pages works
- [ ] TypeScript types properly defined for all components
- [ ] Build passes without errors
- [ ] Tests confirm component behavior

## Performance Targets

- **Initial Dashboard Load**: <500ms for complete render
- **Real-time Update Latency**: <100ms from event to UI update
- **SSE Connection Time**: <200ms to establish connection
- **Component Bundle Size**: <15KB additional JavaScript
- **Memory Usage**: <50MB for long-running dashboard sessions

## Definition of Done

- [ ] All dashboard components render accurately with proper data
- [ ] Real-time features work smoothly with SSE connections
- [ ] Components handle all loading and error scenarios
- [ ] Mobile and desktop responsive behavior confirmed
- [ ] TypeScript compilation passes with strict mode
- [ ] Jest tests cover component behavior and edge cases
- [ ] Build completes successfully without warnings
- [ ] Performance targets met in development environment
- [ ] Integration with existing server actions confirmed
- [ ] Ready for tournament creation and management workflows

## Next Steps After Implementation

1. **Advanced Analytics**: Add performance charts and tournament insights
2. **User Preferences**: Remember dashboard layout and filter preferences
3. **Export Features**: CSV/PDF export for tournament and statistics data
4. **Mobile App**: PWA features for mobile tournament management
5. **Integration APIs**: External tournament management system integration