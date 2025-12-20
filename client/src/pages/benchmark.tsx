import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Run, ChatbotResponse } from "@shared/schema";

interface AIScore {
  chatbotId: string;
  displayName: string;
  cooperateCount: number;
  defectCount: number;
  totalResponses: number;
  cooperationRate: number;
}

function extractDecision(content: string): "COOPERATE" | "DEFECT" | null {
  const upper = content.toUpperCase();
  if (upper.includes("COOPERATE")) return "COOPERATE";
  if (upper.includes("DEFECT")) return "DEFECT";
  return null;
}

export default function BenchmarkPage() {
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
  });

  const scores: AIScore[] = [];
  const chatbotMap = new Map<string, AIScore>();

  runs.forEach((run) => {
    if (run.status !== "completed" || !run.responses) return;
    
    run.responses.forEach((response: ChatbotResponse) => {
      if (response.error || !response.content) return;
      
      const decision = extractDecision(response.content);
      if (!decision) return;

      if (!chatbotMap.has(response.chatbotId)) {
        chatbotMap.set(response.chatbotId, {
          chatbotId: response.chatbotId,
          displayName: response.chatbotId.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          cooperateCount: 0,
          defectCount: 0,
          totalResponses: 0,
          cooperationRate: 0,
        });
      }

      const score = chatbotMap.get(response.chatbotId)!;
      score.totalResponses++;
      if (decision === "COOPERATE") {
        score.cooperateCount++;
      } else {
        score.defectCount++;
      }
      score.cooperationRate = score.cooperateCount / score.totalResponses;
    });
  });

  chatbotMap.forEach((score) => scores.push(score));
  scores.sort((a, b) => b.cooperationRate - a.cooperationRate);

  const maxCount = Math.max(...scores.map((s) => Math.max(s.cooperateCount, s.defectCount)), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-benchmark-title">AI Cooperation Benchmark</h1>
          <p className="text-muted-foreground">Comparing cooperative vs parasitic behaviors across AI models</p>
        </div>
        <Badge variant="secondary" data-testid="badge-total-responses">
          {scores.reduce((sum, s) => sum + s.totalResponses, 0)} total decisions analyzed
        </Badge>
      </div>

      {scores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No cooperation data yet.</p>
            <p className="text-sm mt-2">Run some Prisoner's Dilemma experiments to see the benchmark.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span>Cooperation Leaderboard</span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-zinc-800 dark:bg-zinc-300 rounded-sm" />
                  <span className="text-muted-foreground">Defect (Parasitic)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-pink-500 rounded-sm" />
                  <span className="text-muted-foreground">Cooperate</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scores.map((score) => (
              <div key={score.chatbotId} className="space-y-1" data-testid={`row-ai-${score.chatbotId}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{score.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {(score.cooperationRate * 100).toFixed(0)}% cooperative
                  </span>
                </div>
                <div className="flex items-center h-8">
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-6 bg-zinc-800 dark:bg-zinc-300 rounded-l-sm transition-all"
                      style={{
                        width: `${(score.defectCount / maxCount) * 100}%`,
                        minWidth: score.defectCount > 0 ? "4px" : "0",
                      }}
                      title={`${score.defectCount} defections`}
                    />
                  </div>
                  <div className="w-px h-8 bg-border mx-1" />
                  <div className="flex-1">
                    <div
                      className="h-6 bg-pink-500 rounded-r-sm transition-all"
                      style={{
                        width: `${(score.cooperateCount / maxCount) * 100}%`,
                        minWidth: score.cooperateCount > 0 ? "4px" : "0",
                      }}
                      title={`${score.cooperateCount} cooperations`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{score.defectCount} defect</span>
                  <span>{score.cooperateCount} cooperate</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Model</th>
                  <th className="text-right py-2 px-4">Cooperate</th>
                  <th className="text-right py-2 px-4">Defect</th>
                  <th className="text-right py-2 px-4">Total</th>
                  <th className="text-right py-2 pl-4">Rate</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => (
                  <tr key={score.chatbotId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{score.displayName}</td>
                    <td className="text-right py-2 px-4 text-pink-600 dark:text-pink-400">{score.cooperateCount}</td>
                    <td className="text-right py-2 px-4">{score.defectCount}</td>
                    <td className="text-right py-2 px-4 text-muted-foreground">{score.totalResponses}</td>
                    <td className="text-right py-2 pl-4">
                      <Badge variant={score.cooperationRate >= 0.5 ? "default" : "secondary"}>
                        {(score.cooperationRate * 100).toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
