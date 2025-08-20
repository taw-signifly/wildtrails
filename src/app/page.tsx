import { Suspense } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TournamentList } from "@/components/dashboard/tournament-list";
import { ActiveMatches } from "@/components/dashboard/active-matches";
import { Statistics } from "@/components/dashboard/statistics";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function Home() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Welcome to WildTrails - your comprehensive Petanque tournament management system"
      />

      <div className="grid gap-6">
        {/* Statistics Overview */}
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <Statistics />
        </Suspense>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          {/* Tournament List */}
          <div className="col-span-4">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <TournamentList />
            </Suspense>
          </div>

          {/* Quick Actions */}
          <div className="col-span-3">
            <QuickActions />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Matches */}
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ActiveMatches />
          </Suspense>

          {/* Recent Activity */}
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <RecentActivity />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  );
}
