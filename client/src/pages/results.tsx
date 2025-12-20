import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  Grid3X3,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import { useState, useMemo, useEffect } from "react";
import type { Session, Run, Chatbot } from "@shared/schema";

interface SessionResults {
  session: Session;
  runs: Run[];
  roundLabels: { round: number; prompt: string }[];
}

const providerIcons: Record<string, JSX.Element> = {
  openai: <SiOpenai className="h-3 w-3" />,
  anthropic: <span className="text-[10px] font-bold">A</span>,
  gemini: <SiGoogle className="h-3 w-3" />,
  xai: <span className="text-[10px] font-bold">X</span>,
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  xai: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);

  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const { data: results, isLoading } = useQuery<SessionResults>({
    queryKey: ["/api/sessions", params.sessionId, "results"],
    enabled: !!params.sessionId,
  });

  // Initialize selected runs when data loads
  useEffect(() => {
    if (results?.runs && results.runs.length > 0 && selectedRuns.length === 0) {
      setSelectedRuns(results.runs.map(r => r.id));
    }
  }, [results?.runs]);

  const toggleRun = (runId: string) => {
    setSelectedRuns(prev => 
      prev.includes(runId) 
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  // Get all unique chatbots from selected runs
  const activeChatbotIds = useMemo(() => {
    if (!results) return [];
    const ids = new Set<string>();
    results.runs
      .filter(r => selectedRuns.includes(r.id))
      .forEach(run => run.chatbotIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [results, selectedRuns]);

  // Build grid data: for each round and chatbot, get responses from selected runs
  const gridData = useMemo(() => {
    if (!results) return [];
    
    const selectedRunsData = results.runs.filter(r => selectedRuns.includes(r.id));
    const roundCount = results.roundLabels.length;
    
    return Array.from({ length: roundCount }, (_, roundIdx) => {
      const roundData: Record<string, { responses: string[]; errors: string[]; latencies: number[] }> = {};
      
      activeChatbotIds.forEach(chatbotId => {
        roundData[chatbotId] = { responses: [], errors: [], latencies: [] };
        
        selectedRunsData.forEach(run => {
          const response = run.responses.find(
            r => r.chatbotId === chatbotId && r.stepOrder === roundIdx
          );
          if (response) {
            if (response.error) {
              roundData[chatbotId].errors.push(response.error);
            } else {
              roundData[chatbotId].responses.push(response.content);
              roundData[chatbotId].latencies.push(response.latencyMs);
            }
          }
        });
      });
      
      return {
        round: roundIdx,
        label: results.roundLabels[roundIdx]?.prompt || `Round ${roundIdx + 1}`,
        data: roundData,
      };
    });
  }, [results, selectedRuns, activeChatbotIds]);

  // Extract decision from response (COOPERATE/DEFECT for game theory)
  const extractDecision = (content: string): string | null => {
    const upper = content.toUpperCase();
    if (upper.includes("COOPERATE")) return "COOPERATE";
    if (upper.includes("DEFECT")) return "DEFECT";
    return null;
  };

  // Escape CSV field (handle quotes and commas)
  const escapeCSV = (str: string): string => {
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Export results as CSV - full content
  const exportCSV = () => {
    if (!results) return;
    
    const lines: string[] = [];
    
    // Header row
    lines.push(["Run", "Round", "Chatbot", "Response", "Latency (ms)", "Error"].map(escapeCSV).join(","));
    
    // Export all runs with full response data
    const runsToExport = results.runs.filter(r => selectedRuns.includes(r.id));
    
    runsToExport.forEach((run, runIdx) => {
      run.responses.forEach(response => {
        const chatbot = chatbots.find(c => c.id === response.chatbotId);
        const roundLabel = results.roundLabels[response.stepOrder]?.prompt || `Round ${response.stepOrder + 1}`;
        
        lines.push([
          escapeCSV(`Run ${runIdx + 1}`),
          escapeCSV(roundLabel),
          escapeCSV(chatbot?.displayName || response.chatbotId),
          escapeCSV(response.content || ""),
          response.latencyMs?.toString() || "",
          escapeCSV(response.error || "")
        ].join(","));
      });
    });
    
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${results.session.title || "results"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportJSON = () => {
    if (!results) return;
    
    const data = {
      session: results.session,
      runs: results.runs.filter(r => selectedRuns.includes(r.id)),
      roundLabels: results.roundLabels,
      gridData,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${results.session.title || "results"}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Session not found</p>
        <Link href="/">
          <Button variant="outline" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{results.session.title}</h1>
            <p className="text-xs text-muted-foreground">
              {results.runs.length} run{results.runs.length !== 1 ? "s" : ""} | {results.roundLabels.length} rounds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportCSV} 
            disabled={selectedRuns.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportJSON} 
            disabled={selectedRuns.length === 0}
            data-testid="button-export-json"
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="w-64 border-r p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Runs
            </h3>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {results.runs.map((run, idx) => (
                  <div
                    key={run.id}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer hover-elevate ${
                      selectedRuns.includes(run.id) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => toggleRun(run.id)}
                    data-testid={`checkbox-run-${run.id}`}
                  >
                    <Checkbox checked={selectedRuns.includes(run.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">Run #{results.runs.length - idx}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(run.startedAt).toLocaleString()}
                      </p>
                    </div>
                    {run.status === "completed" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-3 w-3 text-destructive" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Chatbots in View
            </h3>
            <div className="space-y-1">
              {activeChatbotIds.map(id => {
                const bot = chatbots.find(c => c.id === id);
                return (
                  <div key={id} className="flex items-center gap-2 text-xs">
                    <div className={`flex h-5 w-5 items-center justify-center rounded ${providerColors[bot?.provider || "openai"]}`}>
                      {providerIcons[bot?.provider || "openai"]}
                    </div>
                    <span className="truncate">{bot?.displayName || id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selectedRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Grid3X3 className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Select runs to view results</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border bg-muted/50 p-2 text-left text-xs font-medium sticky left-0 z-10">
                      Round
                    </th>
                    {activeChatbotIds.map(id => {
                      const bot = chatbots.find(c => c.id === id);
                      return (
                        <th key={id} className="border bg-muted/50 p-2 text-center min-w-[180px]">
                          <div className="flex items-center justify-center gap-2">
                            <div className={`flex h-5 w-5 items-center justify-center rounded ${providerColors[bot?.provider || "openai"]}`}>
                              {providerIcons[bot?.provider || "openai"]}
                            </div>
                            <span className="text-xs font-medium">{bot?.displayName || id}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {gridData.map((row) => (
                    <tr key={row.round}>
                      <td className="border p-2 bg-muted/30 sticky left-0 z-10">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <p className="text-xs font-medium">Round {row.round + 1}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {row.label.substring(0, 30)}...
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs">{row.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {activeChatbotIds.map(chatbotId => {
                        const cellData = row.data[chatbotId];
                        const hasErrors = cellData.errors.length > 0;
                        const responseCount = cellData.responses.length;
                        
                        // Extract decisions for aggregation
                        const decisions = cellData.responses.map(r => extractDecision(r)).filter(Boolean);
                        const decisionCounts: Record<string, number> = {};
                        decisions.forEach(d => { decisionCounts[d!] = (decisionCounts[d!] || 0) + 1; });
                        
                        const avgLatency = cellData.latencies.length > 0
                          ? Math.round(cellData.latencies.reduce((a, b) => a + b, 0) / cellData.latencies.length)
                          : null;

                        return (
                          <td key={chatbotId} className="border p-2 align-top">
                            {hasErrors ? (
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                            ) : responseCount === 0 ? (
                              <span className="text-xs text-muted-foreground italic">No data</span>
                            ) : (
                              <div className="space-y-1">
                                {Object.keys(decisionCounts).length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(decisionCounts).map(([decision, count]) => (
                                      <Badge 
                                        key={decision} 
                                        variant={decision === "COOPERATE" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {decision}: {count}/{responseCount}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-xs line-clamp-3 cursor-help">
                                        {cellData.responses[0]?.substring(0, 100)}...
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-md max-h-64 overflow-auto">
                                      <pre className="text-xs whitespace-pre-wrap">{cellData.responses[0]}</pre>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {avgLatency && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {avgLatency}ms avg
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
