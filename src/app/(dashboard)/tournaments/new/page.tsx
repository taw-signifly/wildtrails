import { Suspense } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TournamentSetupWizard } from "@/components/tournament/setup-wizard";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function NewTournamentPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Create Tournament"
        description="Set up a new Petanque tournament with customizable settings and player registration"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Create Tournament" }
        ]}
      />

      <div className="mx-auto max-w-4xl">
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <TournamentSetupWizard />
        </Suspense>
      </div>
    </PageContainer>
  );
}