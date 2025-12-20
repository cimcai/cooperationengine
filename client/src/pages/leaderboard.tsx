import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Droplets, Apple, Clock, TrendingUp, Trash2, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LeaderboardEntry } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LeaderboardPage() {
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/leaderboard");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({
        title: "Leaderboard Cleared",
        description: "All selection and outcome data has been reset.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear the leaderboard.",
      });
    },
  });

  const totalSelections = entries?.reduce((sum, e) => sum + e.selectionCount, 0) || 0;
  const maxSelections = entries?.reduce((max, e) => Math.max(max, e.selectionCount), 0) || 1;

  if (isLoading) {
    return (
      <div className="h-full p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Survival Leaderboard</h1>
          <p className="text-muted-foreground">Loading selection data...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <h1 className="text-2xl font-bold" data-testid="text-leaderboard-title">Survival Leaderboard</h1>
            </div>
            <p className="text-muted-foreground">
              Track which candidates get saved most often and correlate with best survival outcomes
            </p>
          </div>
          
          {entries && entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-clear-leaderboard">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Leaderboard?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all selection counts and outcome data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearMutation.mutate()}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {(!entries || entries.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Run apocalypse scenarios to track which candidates get selected most frequently and which correlate with the best survival outcomes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Candidates</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-total-candidates">
                    {entries.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Selections</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-total-selections">
                    {totalSelections}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Most Selected</CardDescription>
                  <CardTitle className="text-3xl truncate" data-testid="text-most-selected">
                    {entries[0]?.candidateName || "-"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Selection Frequency</h2>
              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <Card key={entry.id} data-testid={`card-leaderboard-entry-${entry.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted font-bold text-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-medium truncate" data-testid={`text-candidate-name-${entry.id}`}>
                              #{entry.candidateNumber} - {entry.candidateName}
                            </span>
                            <Badge variant="secondary" className="shrink-0">
                              {entry.selectionCount} {entry.selectionCount === 1 ? "selection" : "selections"}
                            </Badge>
                          </div>
                          <Progress 
                            value={(entry.selectionCount / maxSelections) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                      
                      {(entry.avgWaterSecurity || entry.avgFoodSecurity || entry.avgPopulation10yr || entry.avgPopulation50yr) && (
                        <div className="flex items-center gap-4 mt-4 pt-3 border-t flex-wrap">
                          {entry.avgWaterSecurity !== undefined && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Droplets className="h-4 w-4 text-blue-500" />
                              <span>Water: {entry.avgWaterSecurity}%</span>
                            </div>
                          )}
                          {entry.avgFoodSecurity !== undefined && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Apple className="h-4 w-4 text-green-500" />
                              <span>Food: {entry.avgFoodSecurity}%</span>
                            </div>
                          )}
                          {entry.avgSelfSustaining !== undefined && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <TrendingUp className="h-4 w-4 text-purple-500" />
                              <span>Sustaining: {entry.avgSelfSustaining}%</span>
                            </div>
                          )}
                          {entry.avgPopulation10yr !== undefined && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-4 w-4 text-orange-500" />
                              <span>10yr Pop: {entry.avgPopulation10yr}</span>
                            </div>
                          )}
                          {entry.avgPopulation50yr !== undefined && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 text-slate-500" />
                              <span>50yr Pop: {entry.avgPopulation50yr}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
