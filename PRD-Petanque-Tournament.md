# Petanque Tournament Management System - Product Requirements Document

## 1. Executive Summary

### 1.1 Project Overview
WildTrails Petanque Tournament Management System is a comprehensive web application built with Next.js 15 that enables tournament organizers to create, manage, and track Petanque tournaments with real-time scoring, player tracking, bracket management, and elimination rounds.

### 1.2 Business Goals
- Digitize and streamline Petanque tournament management
- Provide real-time tournament tracking for players and spectators
- Reduce manual scoring errors and administrative overhead
- Enable remote tournament monitoring and participation tracking

### 1.3 Success Metrics
- Reduce tournament setup time by 70%
- Achieve 95% scoring accuracy
- Support tournaments with up to 200 players
- Enable real-time updates within 2 seconds

## 2. Product Vision

### 2.1 Target Users
- **Tournament Organizers**: Club officials, event coordinators
- **Players**: Registered tournament participants
- **Spectators**: Audience members, family, friends
- **Club Administrators**: Long-term tournament data managers

### 2.2 User Personas

#### Tournament Organizer (Primary)
- Needs: Efficient setup, real-time monitoring, automated bracket generation
- Pain Points: Manual scoring errors, bracket management complexity, player coordination
- Goals: Run smooth tournaments, minimize disputes, maximize participation

#### Player (Primary)
- Needs: Current standings, next match information, historical performance
- Pain Points: Not knowing schedule, missing match calls, unclear standings
- Goals: Track progress, understand tournament structure, prepare for matches

#### Spectator (Secondary)
- Needs: Live tournament updates, player statistics, match results
- Pain Points: Limited visibility into tournament progress
- Goals: Follow favorite players, understand competition flow

## 3. Core Features

### 3.1 Tournament Creation & Setup
- **Tournament Types**: Single/Double Elimination, Swiss System, Round-Robin, Barrage Format, Consolation
- **Player Registration**: Import/manual entry, team formation (singles/doubles/triples)
- **Bracket Generation**: Automated seeding based on rankings or random draw
- **Tournament Configuration**: Scoring rules (to 13 points), match formats (full/6-end games)

### 3.2 Live Scoring System
- **Real-time Score Entry**: Touch-friendly interface for mobile scoring
- **Score Validation**: Automatic validation against Petanque rules
- **End-by-End Tracking**: Detailed scoring breakdown per end
- **Points Differential Calculation**: Automatic APD and Delta calculations

### 3.3 Tournament Management
- **Match Scheduling**: Automatic next-round generation
- **Player Check-in**: Digital attendance tracking
- **Court Assignment**: Automatic court allocation and management
- **Time Tracking**: Match duration monitoring

### 3.4 Brackets & Elimination Tracking
- **Visual Bracket Display**: Interactive tournament trees
- **Elimination Tracking**: Winner's and loser's bracket management
- **Consolation Rounds**: Secondary competition for eliminated players
- **Barrage Matches**: Automatic tie-breaker generation

### 3.5 Player & Team Management
- **Player Profiles**: Stats, rankings, tournament history
- **Team Formation**: Dynamic team creation and management
- **Location Tracking**: Court assignments and player positioning
- **Communication**: Match notifications and announcements

### 3.6 Real-time Dashboard
- **Live Leaderboard**: Current standings and rankings
- **Active Matches**: Ongoing game monitoring
- **Tournament Progress**: Visual completion percentage
- **Statistics**: Real-time tournament analytics

## 4. Technical Requirements

### 4.1 Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: TailwindCSS v4, ShadCN UI components
- **State Management**: React Context/Zustand for global state
- **Data Storage**: Mock JSON files (tournament data, player data, match results)
- **Real-time Updates**: WebSocket/Server-Sent Events simulation
- **Deployment**: Vercel (optimized for Next.js)

### 4.2 Performance Requirements
- **Page Load Time**: < 2 seconds on 3G connection
- **Real-time Updates**: < 2 second latency
- **Offline Support**: Basic functionality without internet
- **Mobile Responsiveness**: Support for tablets and smartphones

### 4.3 Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile: iOS Safari 14+, Chrome Mobile 90+

## 5. User Interface Requirements

### 5.1 Core Pages

#### 5.1.1 Dashboard (Home)
- Active tournaments overview
- Quick tournament creation
- Recent results summary
- Tournament statistics

#### 5.1.2 Tournament Setup
- Tournament type selection
- Player registration interface
- Bracket configuration
- Court setup and mapping

#### 5.1.3 Live Tournament View
- Real-time bracket visualization
- Active matches display
- Live scoring interface
- Player location tracking

#### 5.1.4 Scoring Interface
- Touch-optimized score entry
- End-by-end breakdown
- Score history and corrections
- Match completion confirmation

#### 5.1.5 Player Management
- Player profiles and statistics
- Team assignment interface
- Check-in status tracking
- Historical performance data

#### 5.1.6 Results & Analytics
- Tournament results archive
- Player performance analytics
- Statistical reports
- Export functionality

### 5.2 Design System
- **Color Scheme**: Professional tournament theme (blues, greens)
- **Typography**: Clear, readable fonts optimized for mobile
- **Icons**: Intuitive sports and tournament iconography
- **Layout**: Responsive grid system with mobile-first design

## 6. Data Model Requirements

### 6.1 Core Entities

#### Tournament
```typescript
interface Tournament {
  id: string
  name: string
  type: 'single-elimination' | 'double-elimination' | 'swiss' | 'round-robin' | 'barrage' | 'consolation'
  status: 'setup' | 'active' | 'completed' | 'cancelled'
  format: 'singles' | 'doubles' | 'triples'
  maxPoints: number // typically 13
  shortForm: boolean // 6-end games
  startDate: Date
  endDate?: Date
  players: Player[]
  matches: Match[]
  brackets: Bracket[]
  courts: Court[]
  settings: TournamentSettings
}
```

#### Player
```typescript
interface Player {
  id: string
  name: string
  email: string
  club?: string
  ranking?: number
  stats: PlayerStats
  tournaments: string[] // tournament IDs
  teams: string[] // team IDs
}
```

#### Match
```typescript
interface Match {
  id: string
  tournamentId: string
  round: number
  courtId: string
  team1: Team
  team2: Team
  score: Score
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  startTime?: Date
  endTime?: Date
  ends: End[]
}
```

#### Team
```typescript
interface Team {
  id: string
  name: string
  players: Player[]
  tournamentId: string
  seed?: number
  stats: TeamStats
}
```

## 7. Functional Requirements

### 7.1 Tournament Flow
1. **Setup Phase**
   - Create tournament with type and settings
   - Register players and form teams
   - Generate brackets and initial matches
   - Assign courts and setup logistics

2. **Active Phase**
   - Check-in players and validate attendance
   - Conduct matches with live scoring
   - Advance winners to next rounds
   - Handle eliminations and consolations

3. **Completion Phase**
   - Determine final rankings
   - Generate results and statistics
   - Archive tournament data
   - Prepare reports and exports

### 7.2 Scoring Rules Implementation
- **Game Completion**: First team to 13 points wins
- **End Scoring**: 1-6 points per end based on closest boules
- **Points Differential**: Automatic calculation for tie-breaking
- **Swiss System**: Winners play winners, losers play losers
- **Barrage**: Automatic tie-breaker matches for qualification

### 7.3 Bracket Management
- **Single Elimination**: Standard knockout progression
- **Double Elimination**: Winner's and loser's bracket tracking
- **Swiss System**: Automatic pairing based on record
- **Round-Robin**: All-play-all within groups

## 8. Non-Functional Requirements

### 8.1 Usability
- Intuitive interface requiring minimal training
- Touch-optimized for tablet scoring
- Accessible design following WCAG 2.1 guidelines
- Multi-language support (English, French)

### 8.2 Reliability
- 99.5% uptime during tournaments
- Automatic data backup and recovery
- Graceful error handling and user feedback
- Offline capability for scoring

### 8.3 Security
- Data encryption for player information
- Secure tournament access controls
- Audit trail for all scoring changes
- No sensitive data storage (using mock JSON)

### 8.4 Scalability
- Support up to 200 players per tournament
- Handle 20+ concurrent tournaments
- Efficient rendering of large brackets
- Optimized mobile performance

## 9. Implementation Phases

### Phase 1: Core Foundation (Week 1-2)
- Project setup with Next.js 15 and TypeScript
- Basic routing and page structure
- ShadCN UI component integration
- Mock data structure design

### Phase 2: Tournament Management (Week 3-4)
- Tournament creation and setup
- Player registration system
- Basic bracket generation
- Court and team management

### Phase 3: Live Scoring (Week 5-6)
- Real-time scoring interface
- Score validation and calculation
- Match progression logic
- Live updates system

### Phase 4: Advanced Features (Week 7-8)
- Multiple tournament formats
- Advanced bracket visualization
- Player statistics and analytics
- Results export and reporting

### Phase 5: Polish & Testing (Week 9-10)
- Performance optimization
- Mobile responsive refinements
- Comprehensive testing
- Documentation and deployment

## 10. Success Criteria

### 10.1 MVP Definition
- Create and manage single-elimination tournaments
- Register players and form teams
- Live score entry with automatic progression
- Visual bracket display with real-time updates
- Basic player and match statistics

### 10.2 Acceptance Criteria
- Tournament organizer can set up a 32-player tournament in under 5 minutes
- Live scoring updates appear within 2 seconds across all devices
- Bracket visualization clearly shows tournament progression
- Mobile scoring interface works efficiently on tablets
- All Petanque scoring rules are correctly implemented

## 11. Risk Mitigation

### 11.1 Technical Risks
- **Complex Bracket Logic**: Implement incremental testing with small tournaments
- **Real-time Synchronization**: Use proven WebSocket libraries and fallbacks
- **Mobile Performance**: Optimize with React lazy loading and code splitting

### 11.2 User Adoption Risks
- **Learning Curve**: Provide interactive tutorials and demo tournaments
- **Tournament Disruption**: Ensure robust offline capabilities and backup systems
- **Scoring Disputes**: Implement clear audit trails and correction mechanisms

## 12. Future Enhancements

### 12.1 Advanced Features
- AI-powered tournament seeding recommendations
- Integration with national Petanque federation rankings
- Live streaming integration for major tournaments
- Advanced analytics and performance predictions

### 12.2 Platform Extensions
- Mobile app for iOS and Android
- Integration with club management systems
- Tournament registration and payment processing
- Social features and player networking

---

*This PRD serves as the foundational document for the WildTrails Petanque Tournament Management System development. It should be reviewed and updated as requirements evolve during the development process.*