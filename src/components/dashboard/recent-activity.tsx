import Link from "next/link";
import { Clock, Trophy, Activity as ActivityIcon, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivity } from "@/lib/actions/dashboard";
import { formatRelativeDate } from "@/lib/utils/date";

export async function RecentActivity() {
  const result = await getRecentActivity();
  
  // Handle potential errors from the action
  if (result.error) {
    throw new Error(`Failed to load recent activity: ${result.error.message}`);
  }
  
  const activities = result.data;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'tournament_started':
      case 'tournament_created':
        return <Trophy className="h-4 w-4" />;
      case 'match_completed':
      case 'match_started':
        return <ActivityIcon className="h-4 w-4" />;
      case 'player_registered':
        return <Users className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'tournament_started':
        return 'text-green-600';
      case 'tournament_created':
        return 'text-blue-600';
      case 'match_completed':
        return 'text-purple-600';
      case 'match_started':
        return 'text-orange-600';
      case 'player_registered':
        return 'text-cyan-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getActivityLink = (activity: { entityType: string; relatedId: string }) => {
    switch (activity.entityType) {
      case 'tournament':
        return `/tournaments/${activity.relatedId}`;
      case 'match':
        return `/matches/${activity.relatedId}`;
      case 'player':
        return `/players/${activity.relatedId}`;
      default:
        return '#';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest events and updates across tournaments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.length > 0 ? activities.map((activity) => (
            <Link 
              key={activity.id} 
              href={getActivityLink(activity)}
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(activity.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                  
                  <Badge variant="outline" className="text-xs w-fit">
                    {activity.entityType}
                  </Badge>
                </div>
              </div>
            </Link>
          )) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity.</p>
              <p className="text-sm mt-1">Tournament and match activities will appear here.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}