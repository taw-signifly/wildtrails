# Issue #9: Create Main Layout and Navigation Components

**GitHub Issue**: https://github.com/taw-signifly/wildtrails/issues/9

## Summary

Implement the core layout structure for the Petanque tournament application including header, navigation, footer, and responsive design patterns using ShadCN/UI components.

## Current State Analysis

### ✅ Already Implemented
- **RootLayout**: Basic Next.js 15 layout with Geist fonts and proper metadata
- **ShadCN/UI Setup**: Button component available, utilities configured
- **TailwindCSS v4**: Configured with PostCSS
- **TypeScript**: Strict mode enabled with path mapping (@/*)

### ❌ Missing Components (To Implement)
- Header with navigation and branding
- Main navigation component with route highlighting
- Footer with app information
- Page layout components (PageHeader, PageContainer)
- Loading spinner component
- Error boundary component
- Mobile responsive navigation (hamburger menu)

## Implementation Plan

### Phase 1: Install Required ShadCN/UI Components
```bash
npx shadcn@latest add sheet badge separator
```
**Components Needed:**
- `Sheet` - For mobile menu overlay
- `Badge` - For status indicators
- `Separator` - For visual divisions

### Phase 2: Core Layout Components

#### 1. Header Component (`src/components/layout/header.tsx`)
- **Branding**: WildTrails logo and title area
- **Main Navigation**: Desktop navigation links
- **Mobile Menu**: Hamburger button for mobile
- **User Section**: Placeholder for future authentication
- **Tournament Quick Access**: Dropdown for active tournaments

#### 2. Navigation Component (`src/components/layout/navigation.tsx`)
- **Route Structure**: 
  - Dashboard - Main overview page
  - Tournaments - Tournament management and listing
  - Players - Player profiles and management
  - Live - Active tournament monitoring  
  - Statistics - Tournament analytics and reports
  - Settings - Application configuration
- **Active State**: Highlight current route
- **Responsive**: Collapsible on mobile
- **Keyboard Navigation**: Full a11y support

#### 3. Footer Component (`src/components/layout/footer.tsx`)
- **App Information**: Version and branding
- **Links**: Documentation and support links
- **Copyright**: Legal information
- **Minimal Design**: Clean, unobtrusive

#### 4. Page Layout Components
- **PageHeader** (`src/components/layout/page-header.tsx`):
  - Consistent page title styling
  - Action buttons area (Create Tournament, etc.)
  - Breadcrumb integration
  - Responsive layout
  
- **PageContainer** (`src/components/layout/page-container.tsx`):
  - Maximum width constraints
  - Consistent padding and margins
  - Responsive grid system

#### 5. Shared Components
- **LoadingSpinner** (`src/components/shared/loading-spinner.tsx`):
  - Multiple size variants (sm, md, lg)
  - Accessible ARIA labels
  - Integration with Suspense

- **ErrorBoundary** (`src/components/shared/error-boundary.tsx`):
  - Application-wide error catching
  - User-friendly error messages
  - Recovery options

### Phase 3: Layout Integration

#### Update RootLayout (`src/app/layout.tsx`)
- Add Header and Footer to layout
- Maintain existing metadata and font configuration
- Add error boundary wrapper
- Configure proper semantic HTML structure

#### Update Homepage (`src/app/page.tsx`)
- Replace default Next.js content
- Use new PageContainer and PageHeader components
- Create dashboard-style layout
- Add navigation to main sections

### Phase 4: Responsive Design

#### Breakpoints (TailwindCSS)
- **Mobile**: < 768px (sm:)
  - Stack navigation
  - Hamburger menu
  - Compact header
- **Tablet**: 768px - 1024px (md:)
  - Horizontal navigation
  - Condensed layout
- **Desktop**: > 1024px (lg:)
  - Full navigation
  - Expanded layout

#### Navigation Behavior
- **Mobile**: Sheet overlay with touch-friendly targets
- **Desktop**: Horizontal menu with hover states
- **Keyboard**: Full tab navigation and Enter/Space activation

### Phase 5: Accessibility

#### ARIA Implementation
- Navigation landmarks (`nav`, `main`, `header`, `footer`)
- Screen reader labels (`aria-label`, `aria-current`)
- Focus management for mobile menu
- Semantic HTML structure

#### Keyboard Navigation
- Tab order optimization
- Enter/Space activation
- Escape key for mobile menu
- Focus indicators

## Technical Specifications

### Component Architecture
```typescript
// Layout Components
Header (Server Component)
├── Navigation (Client Component - for interactivity)
├── MobileMenuButton (Client Component)
└── Logo (Server Component)

Footer (Server Component)

PageHeader (Server Component)
PageContainer (Server Component)

// Shared Components  
LoadingSpinner (Server Component)
ErrorBoundary (Client Component - for error handling)
```

### Route Structure
```typescript
const routes = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tournaments', href: '/tournaments', icon: Trophy },
  { name: 'Players', href: '/players', icon: Users },
  { name: 'Live', href: '/live', icon: Activity },
  { name: 'Statistics', href: '/statistics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]
```

### Styling Approach
- **TailwindCSS v4**: Utility-first approach
- **ShadCN/UI**: Consistent design system
- **CSS Variables**: Theme support ready
- **Mobile-First**: Responsive design from smallest breakpoint up

## Implementation Strategy

### 1. **Progressive Enhancement**
- Server Components by default
- Client Components only for interactivity
- Works without JavaScript (navigation links)
- Enhanced with JavaScript (mobile menu, active states)

### 2. **Performance Optimization**
- Minimal JavaScript bundle
- Server-side rendering for layout
- Efficient CSS with Tailwind
- Lazy loading where appropriate

### 3. **Type Safety**
- TypeScript interfaces for all components
- Proper prop typing
- Route type definitions
- Navigation state management

## Files to Create

```
src/
├── components/
│   ├── layout/
│   │   ├── header.tsx           # Main site header
│   │   ├── navigation.tsx       # Navigation component
│   │   ├── footer.tsx          # Site footer
│   │   ├── page-header.tsx     # Page header component
│   │   └── page-container.tsx  # Page layout wrapper
│   └── shared/
│       ├── loading-spinner.tsx # Loading component
│       └── error-boundary.tsx  # Error boundary
├── types/
│   └── navigation.ts           # Navigation type definitions
└── app/
    ├── layout.tsx              # Updated root layout
    └── page.tsx                # Updated homepage
```

## Acceptance Criteria Checklist

- [ ] RootLayout provides proper HTML document structure
- [ ] Header contains branding and main navigation  
- [ ] Navigation component supports all main routes
- [ ] Footer provides essential site information
- [ ] All components are fully responsive (mobile, tablet, desktop)
- [ ] Keyboard navigation works throughout interface
- [ ] Loading states are consistent and accessible
- [ ] Error boundaries catch and display errors gracefully
- [ ] Active navigation states are clearly indicated
- [ ] Mobile menu functions properly on touch devices
- [ ] Components follow ShadCN/UI design system
- [ ] ARIA labels and semantic HTML for accessibility

## Integration Notes

### Existing Codebase Compatibility
- **Server Actions**: Layout works with existing tournament/player actions
- **Database**: No database dependencies for layout components
- **API Routes**: Compatible with existing SSE routes (/api/live/*)
- **Styling**: Uses existing TailwindCSS v4 configuration

### Future Integration Points
- **Authentication**: User profile section in header ready
- **Real-time Updates**: SSE integration points identified
- **Tournament Context**: Quick access dropdown prepared
- **Theme System**: CSS variables structure in place

## Performance Targets

- **First Paint**: <100ms for layout rendering
- **Interaction Ready**: <200ms for navigation functionality  
- **Mobile Menu**: <50ms animation duration
- **Bundle Size**: <10KB additional JavaScript

## Testing Strategy

- **Visual Testing**: Responsive design across breakpoints
- **Interaction Testing**: Navigation and mobile menu
- **Accessibility Testing**: Screen reader and keyboard navigation
- **Performance Testing**: Bundle size and render times
- **Integration Testing**: Works with existing server actions

## Definition of Done

- [ ] All layout components render properly across device sizes
- [ ] Navigation works smoothly with Next.js routing
- [ ] Components are accessible with proper ARIA attributes
- [ ] Loading and error states provide good user experience
- [ ] Code follows TypeScript best practices
- [ ] Components are properly typed with interfaces
- [ ] Build passes without errors
- [ ] Tests confirm responsive behavior
- [ ] Mobile navigation functions correctly
- [ ] Ready for integration with future features

## Next Steps After Implementation

1. **Page-Specific Layouts**: Extend layout for tournament/player pages
2. **Authentication Integration**: Add user profile to header
3. **Theme System**: Implement light/dark mode toggle
4. **Advanced Navigation**: Breadcrumbs and contextual menus
5. **Real-time Integration**: Live tournament status in header