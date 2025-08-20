import Link from "next/link";
import { Trophy, Users, Activity, BarChart3, Plus } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats, getRecentTournaments } from "@/lib/actions/dashboard";

export default async function Home() {
  const [stats, recentTournaments] = await Promise.all([
    getDashboardStats(),
    getRecentTournaments()
  ]);
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Welcome to WildTrails - your comprehensive Petanque tournament management system"
      >
        <Button asChild>
          <Link href="/tournaments/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Tournament
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Quick Stats Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Tournaments
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTournaments}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registered Players
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.registeredPlayers}</div>
            <p className="text-xs text-muted-foreground">
              Total registered
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Live Matches
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.liveMatches}</div>
            <p className="text-xs text-muted-foreground">
              Currently playing
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Matches
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-6">
        {/* Recent Tournaments */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Tournaments</CardTitle>
            <CardDescription>
              Your most recent tournament activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTournaments.length > 0 ? recentTournaments.map((tournament) => (
                <div key={tournament.id} className="flex items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{tournament.name}</p>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{tournament.participants} max participants</span>
                      <span>•</span>
                      <span>{tournament.date}</span>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      tournament.status === "active" ? "default" :
                      tournament.status === "setup" ? "secondary" :
                      "outline"
                    }
                  >
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </Badge>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tournaments created yet.</p>
                  <p className="text-sm mt-1">Create your first tournament to get started!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and navigation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/tournaments" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                View All Tournaments
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/players" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Manage Players
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/live" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Live Tournament View
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/statistics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                View Statistics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
