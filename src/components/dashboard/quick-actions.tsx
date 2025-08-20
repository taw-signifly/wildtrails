import Link from "next/link";
import { Trophy, Users, Activity, BarChart3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common tasks and navigation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start">
          <Link href="/tournaments/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Tournament
          </Link>
        </Button>

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
  );
}