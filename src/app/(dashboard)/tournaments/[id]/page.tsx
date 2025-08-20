import { Suspense } from "react"
import { notFound } from "next/navigation"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { TournamentErrorBoundary } from "@/components/error-boundary"
import { getTournamentById } from "@/lib/actions/tournaments"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TournamentDetailPageProps {
  params: {
    id: string
  }
}

export default async function TournamentDetailPage({ 
  params 
}: TournamentDetailPageProps) {
  const result = await getTournamentById(params.id)

  if (!result.success) {
    notFound()
  }

  const tournament = result.data

  return (
    <PageContainer>
      <PageHeader
        title={tournament.name}
        description={tournament.description || "Tournament details and management"}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Tournaments", href: "/tournaments" },
          { label: tournament.name }
        ]}
      />

      <div className="mx-auto max-w-4xl space-y-6">
        <TournamentErrorBoundary>
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            {/* Tournament Overview */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Tournament Overview</h2>
                  <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                    {tournament.status}
                  </Badge>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Tournament Type</div>
                    <div className="font-medium capitalize">
                      {tournament.type.replace('-', ' ')}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Game Format</div>
                    <div className="font-medium capitalize">{tournament.format}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Max Points</div>
                    <div className="font-medium">{tournament.maxPoints}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Players</div>
                    <div className="font-medium">
                      {tournament.currentPlayers} / {tournament.maxPlayers}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Start Date</div>
                    <div className="font-medium">
                      {new Date(tournament.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Organizer</div>
                    <div className="font-medium">{tournament.organizer}</div>
                  </div>
                </div>

                {tournament.location && (
                  <div>
                    <div className="text-sm text-muted-foreground">Location</div>
                    <div className="font-medium">{tournament.location}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Tournament Stats */}
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Statistics</h2>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{tournament.stats.totalMatches}</div>
                    <div className="text-sm text-muted-foreground">Total Matches</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold">{tournament.stats.completedMatches}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {tournament.stats.totalMatches - tournament.stats.completedMatches}
                    </div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {tournament.stats.totalMatches > 0 
                        ? Math.round((tournament.stats.completedMatches / tournament.stats.totalMatches) * 100)
                        : 0
                      }%
                    </div>
                    <div className="text-sm text-muted-foreground">Progress</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tournament Settings */}
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Settings</h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Late Registration</span>
                      <Badge variant={tournament.settings.allowLateRegistration ? 'default' : 'secondary'}>
                        {tournament.settings.allowLateRegistration ? 'Allowed' : 'Disabled'}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Check-in Required</span>
                      <Badge variant={tournament.settings.requireCheckin ? 'default' : 'secondary'}>
                        {tournament.settings.requireCheckin ? 'Required' : 'Optional'}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Real-time Updates</span>
                      <Badge variant={tournament.settings.realTimeUpdates ? 'default' : 'secondary'}>
                        {tournament.settings.realTimeUpdates ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Court Assignment</span>
                      <Badge variant="outline" className="capitalize">
                        {tournament.settings.courtAssignmentMode}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Scoring Mode</span>
                      <Badge variant="outline" className="capitalize">
                        {tournament.settings.scoringMode.replace('-', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Spectators</span>
                      <Badge variant={tournament.settings.allowSpectators ? 'default' : 'secondary'}>
                        {tournament.settings.allowSpectators ? 'Allowed' : 'Restricted'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Placeholder sections for future features */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Players & Teams</h3>
                  <div className="p-4 bg-muted/30 border border-dashed rounded-md text-center">
                    <p className="text-sm text-muted-foreground">
                      Player and team management coming soon
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Bracket & Matches</h3>
                  <div className="p-4 bg-muted/30 border border-dashed rounded-md text-center">
                    <p className="text-sm text-muted-foreground">
                      Bracket visualization and match management coming soon
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </Suspense>
        </TournamentErrorBoundary>
      </div>
    </PageContainer>
  )
}