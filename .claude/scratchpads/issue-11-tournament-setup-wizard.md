# Issue #11: Tournament Setup and Configuration Components

**GitHub Issue:** https://github.com/taw-signifly/wildtrails/issues/11

## Overview
Implement comprehensive tournament setup interface allowing organizers to create tournaments, configure settings, register players, and generate initial brackets.

## Current State Analysis
- ✅ Backend tournament infrastructure complete (server actions, validation, DB)
- ✅ TypeScript types and Zod schemas fully defined
- ✅ Database operations implemented with comprehensive testing
- ❌ Frontend tournament setup components missing
- ❌ Multi-step wizard UI not implemented
- ❌ Player registration interface not built

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **Page Setup**: Create `/src/app/(dashboard)/tournaments/new/page.tsx`
2. **Wizard Component**: Multi-step form with progress indicators
3. **State Management**: Custom hook for wizard state persistence

### Phase 2: Step Components
1. **BasicInformation**: Name, type, format, scheduling
2. **TournamentSettings**: Scoring, limits, court management
3. **PlayerRegistration**: Manual entry, bulk import, team formation
4. **BracketConfiguration**: Seeding, preview, scheduling
5. **ReviewAndCreate**: Final summary and validation

### Phase 3: Supporting Components
1. **TournamentTypeSelector**: Visual format explanations
2. **TeamFormationInterface**: Dynamic team builder
3. **BracketPreview**: Visual bracket representation

## Technical Implementation

### File Structure
```
src/
├── app/(dashboard)/tournaments/new/page.tsx
├── components/tournament/
│   ├── setup-wizard.tsx
│   ├── steps/
│   │   ├── basic-information.tsx
│   │   ├── tournament-settings.tsx
│   │   ├── player-registration.tsx
│   │   ├── bracket-configuration.tsx
│   │   └── review-and-create.tsx
│   ├── tournament-type-selector.tsx
│   ├── team-formation.tsx
│   └── bracket-preview.tsx
├── hooks/use-tournament-setup.tsx
└── lib/validation/tournament-setup.ts
```

### State Management Pattern
- Use `useState` for wizard navigation
- `useReducer` for complex form state
- Local storage persistence between steps
- Server action integration for final submission

### Validation Strategy
- Step-by-step validation before progression
- Final validation before tournament creation
- Integration with existing Zod schemas
- Real-time field validation with user feedback

### Integration Points
- Leverage existing tournament server actions
- Use established validation schemas
- Integrate with player and team management (future issues)
- Connect to bracket generation algorithms

## Key Features

### Multi-Step Wizard
- Progress indicator with step navigation
- Form persistence across steps
- Validation gates between steps
- Back/forward navigation with state preservation

### Tournament Type Selection
- Visual format explanations (Single/Double Elimination, Swiss, etc.)
- Player count recommendations
- Expected duration estimates
- Format-specific rule explanations

### Dynamic Player Registration
- Manual player entry with validation
- Bulk import functionality (CSV/JSON)
- Player search with autocomplete
- Team formation based on tournament format

### Bracket Configuration
- Seeding options (ranked, random, manual)
- Bye assignment for odd player counts
- Initial match scheduling
- Court assignment integration

### Form Validation Rules
- Tournament names must be unique
- Player counts must meet format requirements
- Teams must have correct number of players
- Dates must be in future
- Email uniqueness validation

## Testing Strategy
- Unit tests for each step component
- Integration tests for wizard flow
- Validation testing for all form inputs
- Error handling scenarios
- Responsive design testing

## Success Criteria
- ✅ Complete multi-step tournament creation process
- ✅ All tournament formats properly supported
- ✅ Player registration with validation
- ✅ Team formation follows format requirements
- ✅ Bracket generation integration
- ✅ Error handling for API failures
- ✅ Responsive design across devices
- ✅ Progress saving and restoration
- ✅ Final tournament creation and redirect

## Next Steps
1. Create tournament setup page structure
2. Implement core wizard component
3. Build individual step components
4. Add state management hook
5. Integrate with existing server actions
6. Write comprehensive tests
7. Verify build and deployment