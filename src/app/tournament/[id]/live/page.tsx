import { notFound } from 'next/navigation'
import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesByTournament } from '@/lib/actions/matches'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScoringInterface } from '@/components/scoring/scoring-interface'
import { CourtAssignmentPanel } from '@/components/scoring/court-assignment'
import { RealTimeUpdates } from '@/components/scoring/real-time-updates'

interface LiveScoringPageProps {
  params: {
    id: string
  }
}

export default async function LiveScoringPage({ params }: LiveScoringPageProps) {
  const { id } = params

  // Fetch tournament and matches data in parallel
  const [tournamentResult, matchesResult] = await Promise.all([
    getTournamentById(id),
    getMatchesByTournament(id)
  ])

  if (!tournamentResult.success) {
    notFound()
  }

  if (!matchesResult.success) {
    console.error('Failed to fetch tournament matches:', matchesResult.error)
    throw new Error('Failed to load tournament matches')
  }

  const tournament = tournamentResult.data
  const matches = matchesResult.data

  // Filter active and upcoming matches for live scoring
  const activeMatches = matches.filter(match => match.status === 'active')
  const upcomingMatches = matches.filter(match => match.status === 'scheduled')
  const availableMatches = [...activeMatches, ...upcomingMatches]

  // Generate page title with match count
  const pageTitle = `Live Scoring - ${tournament.name}`
  const pageDescription = `${activeMatches.length} active, ${upcomingMatches.length} scheduled matches`

  return (
    <PageContainer>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex items-center gap-2">
            <Badge 
              variant={tournament.status === 'active' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {tournament.status}
            </Badge>
            <Badge 
              variant={activeMatches.length > 0 ? 'destructive' : 'secondary'}
              className="text-sm"
            >
              {activeMatches.length} active
            </Badge>
          </div>
        }
      />

      <RealTimeUpdates tournamentId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Court Assignment Panel - Left sidebar on desktop, top on mobile */}
        <div className="lg:col-span-1 order-1 lg:order-1">
          <CourtAssignmentPanel 
            tournamentId={id}
            matches={availableMatches}
            courts={tournament.settings?.courts || []}
          />
        </div>

        {/* Main Scoring Interface - Takes most space */}
        <div className="lg:col-span-3 order-2 lg:order-2">
          {activeMatches.length === 0 && upcomingMatches.length === 0 ? (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No matches available for scoring
              </h3>
              <p className="text-gray-600 mb-4">
                All matches in this tournament have been completed or are not yet scheduled.
              </p>
              <Button
                onClick={() => window.history.back()}
                variant="outline"
              >
                Return to Tournament
              </Button>
            </Card>
          ) : (
            <ScoringInterface 
              tournamentId={id}
              matches={availableMatches}
              initialMatchId={activeMatches[0]?.id || upcomingMatches[0]?.id}
            />
          )}
        </div>
      </div>

      {/* Match Statistics and Summary - Full width at bottom */}
      <div className="mt-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tournament Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {matches.filter(m => m.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {activeMatches.length}
              </div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {upcomingMatches.length}
              </div>
              <div className="text-sm text-gray-600">Scheduled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {matches.length}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}

// Enable static generation for performance
export const dynamic = 'force-dynamic' // Required for real-time features

// Metadata for the page
export async function generateMetadata({ params }: LiveScoringPageProps) {
  const { id } = params
  
  const result = await getTournamentById(id)
  
  if (!result.success) {
    return {
      title: 'Tournament Not Found',
      description: 'The requested tournament could not be found.'
    }
  }

  const tournament = result.data

  return {
    title: `Live Scoring - ${tournament.name}`,
    description: `Real-time scoring for ${tournament.name}. Track active matches and enter scores as they happen.`,
    keywords: ['petanque', 'tournament', 'live scoring', 'real-time', tournament.name],
  }
}