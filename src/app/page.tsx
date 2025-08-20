import { Suspense } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TournamentList } from "@/components/dashboard/tournament-list";
import { ActiveMatches } from "@/components/dashboard/active-matches";
import { Statistics } from "@/components/dashboard/statistics";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { DashboardErrorBoundary } from "@/components/ui/error-boundary";

export default function Home() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Welcome to WildTrails - your comprehensive Petanque tournament management system"
      />

      <div className="grid gap-6">
        {/* Statistics Overview */}
        <DashboardErrorBoundary section="Statistics">
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Statistics />
          </Suspense>
        </DashboardErrorBoundary>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          {/* Tournament List */}
          <div className="col-span-4">
            <DashboardErrorBoundary section="Tournament List">
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <TournamentList />
              </Suspense>
            </DashboardErrorBoundary>
          </div>

          {/* Quick Actions */}
          <div className="col-span-3">
            <QuickActions />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Matches */}
          <DashboardErrorBoundary section="Active Matches">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <ActiveMatches />
            </Suspense>
          </DashboardErrorBoundary>

          {/* Recent Activity */}
          <DashboardErrorBoundary section="Recent Activity">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <RecentActivity />
            </Suspense>
          </DashboardErrorBoundary>
        </div>
      </div>
    </PageContainer>
  );
}
