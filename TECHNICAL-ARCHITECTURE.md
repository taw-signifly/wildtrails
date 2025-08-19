# Petanque Tournament System - Technical Architecture

## 1. Architecture Overview

### 1.1 System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Next.js API   │    │   JSON Data     │
│   (React/Next)  │◄──►│     Routes      │◄──►│     Store       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   Server State  │    │   File System   │
│   (Real-time)   │    │   Management    │    │   Operations    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 Technology Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19 with Server Components
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS v4 + PostCSS
- **UI Components**: ShadCN/UI
- **State Management**: Zustand + React Context
- **Data Storage**: JSON files with Node.js fs operations
- **Real-time**: Server-Sent Events (SSE)
- **Testing**: Jest + Testing Library
- **Deployment**: Vercel

## 2. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Dashboard route group
│   │   ├── page.tsx            # Main dashboard
│   │   └── tournaments/        # Tournament management
│   ├── tournament/             # Active tournament views
│   │   ├── [id]/              # Tournament detail pages
│   │   └── live/              # Live tournament interface
│   ├── api/                    # API routes
│   │   ├── tournaments/       # Tournament CRUD operations
│   │   ├── matches/           # Match management
│   │   ├── players/           # Player operations
│   │   └── live/              # Real-time updates
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/                 # React components
│   ├── ui/                    # ShadCN base components
│   ├── tournament/            # Tournament-specific components
│   ├── scoring/               # Scoring interface components
│   ├── brackets/              # Bracket visualization
│   └── shared/                # Shared components
├── lib/                       # Utility libraries
│   ├── db/                    # JSON data operations
│   ├── tournament/            # Tournament logic
│   ├── scoring/               # Scoring algorithms
│   ├── brackets/              # Bracket generation
│   └── utils.ts               # General utilities
├── types/                     # TypeScript definitions
├── hooks/                     # Custom React hooks
├── stores/                    # Zustand stores
└── data/                      # Mock JSON files
    ├── tournaments.json
    ├── players.json
    ├── matches.json
    └── courts.json
```

## 3. Data Architecture

### 3.1 JSON Data Store Structure
```
data/
├── tournaments/               # Tournament data
│   ├── active/               # Currently running tournaments
│   ├── completed/            # Historical tournaments
│   └── templates/            # Tournament templates
├── players/                  # Player profiles and stats
├── matches/                  # Match records and scores
├── courts/                   # Court information
└── system/                   # System configuration
    ├── settings.json         # Global settings
    └── backup/               # Data backups
```

### 3.2 Data Flow
1. **Create**: API routes write to JSON files
2. **Read**: Server components read from JSON, client hydrates
3. **Update**: API mutations trigger file updates + SSE events
4. **Real-time**: SSE streams push updates to connected clients
5. **Backup**: Automatic snapshots before major operations

## 4. API Design

### 4.1 REST API Endpoints

#### Tournaments
```typescript
GET    /api/tournaments              # List tournaments
POST   /api/tournaments              # Create tournament
GET    /api/tournaments/[id]         # Get tournament
PUT    /api/tournaments/[id]         # Update tournament
DELETE /api/tournaments/[id]         # Delete tournament
```

#### Players
```typescript
GET    /api/players                  # List players
POST   /api/players                  # Create player
GET    /api/players/[id]             # Get player
PUT    /api/players/[id]             # Update player
DELETE /api/players/[id]             # Delete player
```

#### Matches
```typescript
GET    /api/matches                  # List matches
POST   /api/matches                  # Create match
GET    /api/matches/[id]             # Get match
PUT    /api/matches/[id]             # Update match score
POST   /api/matches/[id]/complete    # Complete match
```

#### Live Updates
```typescript
GET    /api/live/tournament/[id]     # SSE stream for tournament
GET    /api/live/match/[id]          # SSE stream for match
POST   /api/live/score               # Submit score update
```

### 4.2 API Response Format
```typescript
interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}
```

## 5. Component Architecture

### 5.1 Component Hierarchy
```
App
├── Layout
│   ├── Header
│   ├── Navigation
│   └── Footer
├── Dashboard
│   ├── TournamentList
│   ├── QuickActions
│   └── Statistics
├── Tournament
│   ├── TournamentSetup
│   ├── BracketView
│   ├── LiveScoring
│   └── Results
└── Shared
    ├── LoadingSpinner
    ├── ErrorBoundary
    └── Modal
```

### 5.2 Key Components

#### TournamentBracket
```typescript
interface TournamentBracketProps {
  tournament: Tournament
  matches: Match[]
  onMatchClick: (match: Match) => void
  interactive?: boolean
}
```

#### ScoringInterface
```typescript
interface ScoringInterfaceProps {
  match: Match
  onScoreUpdate: (score: Score) => void
  onMatchComplete: () => void
  realTime?: boolean
}
```

#### PlayerManagement
```typescript
interface PlayerManagementProps {
  players: Player[]
  tournament: Tournament
  onPlayerAdd: (player: Player) => void
  onTeamCreate: (team: Team) => void
}
```

## 6. State Management

### 6.1 Zustand Stores

#### Tournament Store
```typescript
interface TournamentStore {
  tournaments: Tournament[]
  currentTournament: Tournament | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchTournaments: () => Promise<void>
  createTournament: (data: TournamentData) => Promise<Tournament>
  updateTournament: (id: string, data: Partial<Tournament>) => Promise<void>
  deleteTournament: (id: string) => Promise<void>
  setCurrentTournament: (tournament: Tournament) => void
}
```

#### Match Store
```typescript
interface MatchStore {
  matches: Match[]
  activeMatches: Match[]
  
  // Actions
  fetchMatches: (tournamentId: string) => Promise<void>
  updateMatchScore: (matchId: string, score: Score) => Promise<void>
  completeMatch: (matchId: string) => Promise<void>
  subscribeToMatch: (matchId: string) => void
}
```

### 6.2 React Context
- **Theme Context**: UI theme and preferences
- **User Context**: Current user and permissions
- **Notification Context**: Toast notifications and alerts

## 7. Real-time Features

### 7.1 Server-Sent Events Implementation
```typescript
// API Route: /api/live/tournament/[id]
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Tournament subscription logic
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### 7.2 Client-side Event Handling
```typescript
// Custom hook for real-time updates
export function useRealTimeTournament(tournamentId: string) {
  const [data, setData] = useState<Tournament | null>(null)
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/live/tournament/${tournamentId}`)
    
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data)
      setData(update)
    }
    
    return () => eventSource.close()
  }, [tournamentId])
  
  return data
}
```

## 8. Data Operations

### 8.1 JSON File Management
```typescript
// lib/db/tournaments.ts
export class TournamentDB {
  private static dataPath = path.join(process.cwd(), 'data', 'tournaments')
  
  static async create(tournament: Tournament): Promise<Tournament> {
    const filepath = path.join(this.dataPath, 'active', `${tournament.id}.json`)
    await fs.writeFile(filepath, JSON.stringify(tournament, null, 2))
    return tournament
  }
  
  static async findById(id: string): Promise<Tournament | null> {
    try {
      const filepath = path.join(this.dataPath, 'active', `${id}.json`)
      const data = await fs.readFile(filepath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  
  static async update(id: string, data: Partial<Tournament>): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Tournament not found')
    
    const updated = { ...existing, ...data, updatedAt: new Date() }
    const filepath = path.join(this.dataPath, 'active', `${id}.json`)
    await fs.writeFile(filepath, JSON.stringify(updated, null, 2))
    
    // Trigger real-time update
    EventEmitter.emit(`tournament:${id}`, updated)
  }
}
```

### 8.2 Backup Strategy
```typescript
// Automatic backup before destructive operations
export async function backupTournament(tournamentId: string): Promise<void> {
  const tournament = await TournamentDB.findById(tournamentId)
  if (tournament) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join('data', 'system', 'backup', `${tournamentId}-${timestamp}.json`)
    await fs.writeFile(backupPath, JSON.stringify(tournament, null, 2))
  }
}
```

## 9. Tournament Logic

### 9.1 Bracket Generation
```typescript
// lib/tournament/brackets.ts
export class BracketGenerator {
  static generateSingleElimination(players: Player[]): Match[] {
    const shuffled = this.shufflePlayers(players)
    const matches: Match[] = []
    
    // Create first round matches
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push(this.createMatch(shuffled[i], shuffled[i + 1], 1))
    }
    
    return matches
  }
  
  static generateSwissSystem(players: Player[], rounds: number): Match[] {
    // Swiss system pairing algorithm
    return this.swissPairing(players, rounds)
  }
  
  static generateRoundRobin(players: Player[]): Match[] {
    // Round-robin tournament generation
    return this.roundRobinPairing(players)
  }
}
```

### 9.2 Scoring Engine
```typescript
// lib/scoring/engine.ts
export class ScoringEngine {
  static calculateEndScore(boules: Boule[], jack: Position): EndResult {
    const distances = boules.map(boule => ({
      ...boule,
      distance: this.calculateDistance(boule.position, jack)
    }))
    
    const closest = distances.reduce((min, current) => 
      current.distance < min.distance ? current : min
    )
    
    const winningTeam = closest.teamId
    const points = distances.filter(b => 
      b.teamId === winningTeam && 
      b.distance < this.getOpponentClosest(distances, winningTeam).distance
    ).length
    
    return { teamId: winningTeam, points, details: distances }
  }
  
  static validateScore(match: Match, newScore: Score): boolean {
    // Petanque scoring rule validation
    return newScore.team1 <= 13 && newScore.team2 <= 13 && 
           (newScore.team1 === 13 || newScore.team2 === 13 || 
            newScore.team1 + newScore.team2 < 26)
  }
}
```

## 10. Performance Optimizations

### 10.1 Next.js Optimizations
- **Server Components**: Use for data fetching and static content
- **Client Components**: Only for interactive elements
- **Streaming**: Implement loading states with Suspense
- **Code Splitting**: Dynamic imports for tournament-specific features

### 10.2 React Optimizations
```typescript
// Memoized bracket component
const BracketView = memo(({ tournament, matches }: BracketViewProps) => {
  const memoizedMatches = useMemo(() => 
    matches.filter(m => m.tournamentId === tournament.id), 
    [matches, tournament.id]
  )
  
  return <BracketRenderer matches={memoizedMatches} />
})
```

### 10.3 Data Loading Strategies
```typescript
// Optimistic updates for scoring
export function useOptimisticScoring(matchId: string) {
  const [optimisticMatch, setOptimisticMatch] = useOptimisticState(
    match,
    (state, newScore) => ({ ...state, score: newScore })
  )
  
  const updateScore = async (newScore: Score) => {
    setOptimisticMatch(newScore)
    await api.updateMatchScore(matchId, newScore)
  }
  
  return { match: optimisticMatch, updateScore }
}
```

## 11. Testing Strategy

### 11.1 Unit Tests
```typescript
// __tests__/lib/scoring/engine.test.ts
describe('ScoringEngine', () => {
  it('calculates end scores correctly', () => {
    const boules = [/* test data */]
    const jack = { x: 10, y: 15 }
    
    const result = ScoringEngine.calculateEndScore(boules, jack)
    
    expect(result.teamId).toBe('team1')
    expect(result.points).toBe(2)
  })
})
```

### 11.2 Integration Tests
```typescript
// __tests__/api/tournaments.test.ts
describe('/api/tournaments', () => {
  it('creates tournament with valid data', async () => {
    const response = await fetch('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify(mockTournament)
    })
    
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.success).toBe(true)
  })
})
```

## 12. Deployment & DevOps

### 12.1 Vercel Configuration
```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### 12.2 Environment Management
```typescript
// lib/config.ts
export const config = {
  isDevelopment: process.env.NODE_ENV === 'development',
  dataPath: process.env.DATA_PATH || path.join(process.cwd(), 'data'),
  maxTournaments: parseInt(process.env.MAX_TOURNAMENTS || '50'),
  realTimeEnabled: process.env.REALTIME_ENABLED !== 'false'
}
```

## 13. Security Considerations

### 13.1 Data Validation
```typescript
// lib/validation/tournament.ts
export const tournamentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['single-elimination', 'double-elimination', 'swiss', 'round-robin']),
  maxPlayers: z.number().min(4).max(200),
  startDate: z.date().min(new Date())
})
```

### 13.2 Rate Limiting
```typescript
// middleware.ts
import { rateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResult = await rateLimit(request)
    if (!rateLimitResult.success) {
      return new Response('Too Many Requests', { status: 429 })
    }
  }
}
```

This technical architecture provides a solid foundation for building the Petanque tournament management system while maintaining scalability, performance, and maintainability.