import Link from "next/link";
import { Activity, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveMatches } from "@/lib/actions/dashboard";

export async function ActiveMatches() {
  const result = await getActiveMatches();
  
  // Handle potential errors from the action
  if (result.error) {
    throw new Error(`Failed to load active matches: ${result.error.message}`);
  }
  
  const activeMatches = result.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Matches
        </CardTitle>
        <CardDescription>
          Currently active matches across all tournaments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeMatches.length > 0 ? activeMatches.map((match) => (
            <div key={match.id} className="flex items-center justify-between space-y-0 p-3 border rounded-lg">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium leading-none text-sm">
                    {match.tournamentName}
                  </p>
                  <Badge variant={match.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {match.status === 'active' ? 'LIVE' : 'PAUSED'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {match.team1.join(', ')}
                      </span>
                      <span className="font-bold">{match.currentScore[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {match.team2.join(', ')}
                      </span>
                      <span className="font-bold">{match.currentScore[1]}</span>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-1">
                    {match.court && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        Court {match.court}
                      </div>
                    )}
                    {match.duration && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {match.duration}m
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="ml-4">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/matches/${match.id}/scoring`}>
                    View Live
                  </Link>
                </Button>
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No live matches at the moment.</p>
              <p className="text-sm mt-1">Active matches will appear here in real-time.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}