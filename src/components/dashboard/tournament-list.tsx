import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentTournaments } from "@/lib/actions/dashboard";

export async function TournamentList() {
  const result = await getRecentTournaments();
  
  // Handle potential errors from the action
  if (result.error) {
    throw new Error(`Failed to load recent tournaments: ${result.error.message}`);
  }
  
  const recentTournaments = result.data;

  return (
    <Card>
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
  );
}