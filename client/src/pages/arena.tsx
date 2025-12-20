import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Play, Trophy, Clock, Loader2, Trash2, RefreshCw, Download } from "lucide-react";
import type { Chatbot, ArenaMatch } from "@shared/schema";

export default function ArenaPage() {
  const { toast } = useToast();
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const { data: chatbots = [], isLoading: loadingChatbots } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery<ArenaMatch[]>({
    queryKey: ["/api/arena/matches"],
    refetchInterval: 3000,
  });

  const enabledChatbots = chatbots.filter(c => c.enabled);

  const [formData, setFormData] = useState({
    player1Id: "",
    player2Id: "",
    gameType: "prisoners-dilemma" as "prisoners-dilemma" | "stag-hunt" | "apple-tree",
    totalRounds: 10,
    temptationPayoff: 5,
    hiddenLength: false,
  });

  useEffect(() => {
    if (enabledChatbots.length >= 2 && !formData.player1Id && !formData.player2Id) {
      setFormData(prev => ({
        ...prev,
        player1Id: enabledChatbots[0]?.id || "",
        player2Id: enabledChatbots[1]?.id || "",
      }));
    }
  }, [enabledChatbots]);

  const createMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/arena/matches", formData);
      return res.json() as Promise<ArenaMatch>;
    },
    onSuccess: (match: ArenaMatch) => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena/matches"] });
      setSelectedMatch(match.id);
      toast({
        title: "Match Started",
        description: "The AI arena match has begun!",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to start match",
        description: error.message,
      });
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/arena/matches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena/matches"] });
      setSelectedMatch(null);
    },
  });

  const currentMatch = matches.find(m => m.id === selectedMatch);

  const getChatbotName = (id: string) => {
    return chatbots.find(c => c.id === id)?.displayName || id;
  };

  const exportMatchesAsJSON = () => {
    const exportData = matches.map(match => ({
      ...match,
      player1Name: getChatbotName(match.player1Id),
      player2Name: getChatbotName(match.player2Id),
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arena-matches-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMatchesAsCSV = () => {
    const headers = ["Match ID", "Player 1", "Player 2", "Game Type", "Rounds", "P1 Score", "P2 Score", "Status", "Created", "Rounds Data"];
    const rows = matches.map(match => [
      match.id,
      getChatbotName(match.player1Id),
      getChatbotName(match.player2Id),
      match.gameType,
      match.totalRounds,
      match.player1Score,
      match.player2Score,
      match.status,
      match.createdAt,
      match.rounds.map(r => `R${r.roundNumber}:${r.player1Move}/${r.player2Move}`).join(";")
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arena-matches-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getGameTypeName = (type: string) => {
    const names: Record<string, string> = {
      "prisoners-dilemma": "Prisoner's Dilemma",
      "stag-hunt": "Stag Hunt",
      "apple-tree": "Apple Tree Game",
    };
    return names[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "running":
        return <Badge className="bg-blue-500 text-white">Running</Badge>;
      case "completed":
        return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-arena-title">AI Arena</h1>
          <p className="text-sm text-muted-foreground">Watch AI models compete in game theory battles</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportMatchesAsJSON}
            disabled={matches.length === 0}
            data-testid="button-export-json"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMatchesAsCSV}
            disabled={matches.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold mb-4">New Match</h2>
            
            <div className="space-y-4">
              <div>
                <Label>Player 1</Label>
                <Select
                  value={formData.player1Id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, player1Id: v }))}
                >
                  <SelectTrigger data-testid="select-player1">
                    <SelectValue placeholder="Select AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledChatbots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Player 2</Label>
                <Select
                  value={formData.player2Id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, player2Id: v }))}
                >
                  <SelectTrigger data-testid="select-player2">
                    <SelectValue placeholder="Select AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledChatbots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Game Type</Label>
                <Select
                  value={formData.gameType}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, gameType: v as typeof formData.gameType }))}
                >
                  <SelectTrigger data-testid="select-game-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prisoners-dilemma">Prisoner's Dilemma</SelectItem>
                    <SelectItem value="stag-hunt">Stag Hunt</SelectItem>
                    <SelectItem value="apple-tree">Apple Tree Game</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Rounds</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.totalRounds}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalRounds: parseInt(e.target.value) || 10 }))}
                    data-testid="input-rounds"
                  />
                </div>
                <div className="flex-1">
                  <Label>Temptation (T)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.temptationPayoff}
                    onChange={(e) => setFormData(prev => ({ ...prev, temptationPayoff: parseInt(e.target.value) || 5 }))}
                    data-testid="input-temptation"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.hiddenLength}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, hiddenLength: v }))}
                  data-testid="switch-hidden-length"
                />
                <Label>Hide game length from players</Label>
              </div>

              <Button
                className="w-full"
                onClick={() => createMatchMutation.mutate()}
                disabled={createMatchMutation.isPending || !formData.player1Id || !formData.player2Id}
                data-testid="button-start-match"
              >
                {createMatchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Match
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <h2 className="font-semibold">Recent Matches</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/arena/matches"] })}
                data-testid="button-refresh-matches"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {loadingMatches ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">No matches yet</p>
                ) : (
                  matches.map(match => (
                    <Card
                      key={match.id}
                      className={`cursor-pointer transition-colors ${selectedMatch === match.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedMatch(match.id)}
                      data-testid={`card-match-${match.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          {getStatusBadge(match.status)}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMatchMutation.mutate(match.id);
                            }}
                            data-testid={`button-delete-match-${match.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-sm font-medium">
                          {getChatbotName(match.player1Id)} vs {getChatbotName(match.player2Id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getGameTypeName(match.gameType)} - Round {match.currentRound}/{match.totalRounds}
                        </div>
                        <div className="text-xs mt-1">
                          Score: {match.player1Score} - {match.player2Score}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {!currentMatch ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a match to view details</h3>
                <p className="text-sm text-muted-foreground">Or start a new match using the panel on the left</p>
              </div>
            </div>
          ) : (
            <MatchViewer match={currentMatch} chatbots={chatbots} />
          )}
        </div>
      </div>
    </div>
  );
}

function MatchViewer({ match, chatbots }: { match: ArenaMatch; chatbots: Chatbot[] }) {
  const getChatbotName = (id: string) => {
    return chatbots.find(c => c.id === id)?.displayName || id;
  };

  const player1Name = getChatbotName(match.player1Id);
  const player2Name = getChatbotName(match.player2Id);

  const getMoveColor = (move: string) => {
    const cooperative = ["COOPERATE", "STAG", "WORK"];
    return cooperative.includes(move) ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold">{player1Name}</div>
              <div className="text-4xl font-bold text-primary">{match.player1Score}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-sm mb-1">Round {match.currentRound} / {match.totalRounds}</div>
              <Badge variant={match.status === "running" ? "default" : "secondary"}>
                {match.status === "running" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
              </Badge>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold">{player2Name}</div>
              <div className="text-4xl font-bold text-primary">{match.player2Score}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rounds" className="flex-1 flex flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="rounds" data-testid="tab-rounds">Round History</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="rounds" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-4">
              {match.rounds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {match.status === "running" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Waiting for first round...</span>
                    </div>
                  ) : (
                    "No rounds played yet"
                  )}
                </div>
              ) : (
                match.rounds.map((round) => (
                  <Card key={round.roundNumber} data-testid={`card-round-${round.roundNumber}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <Badge variant="outline">Round {round.roundNumber}</Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {round.player1LatencyMs}ms / {round.player2LatencyMs}ms
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-medium">{player1Name}</span>
                            <Badge className={getMoveColor(round.player1Move)}>{round.player1Move}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            +{round.player1Points} points
                          </div>
                          {round.player1Reasoning && (
                            <div className="mt-2 text-xs bg-muted p-2 rounded">
                              {round.player1Reasoning}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-medium">{player2Name}</span>
                            <Badge className={getMoveColor(round.player2Move)}>{round.player2Move}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            +{round.player2Points} points
                          </div>
                          {round.player2Reasoning && (
                            <div className="mt-2 text-xs bg-muted p-2 rounded">
                              {round.player2Reasoning}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="stats" className="flex-1 overflow-hidden mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{player1Name}</CardTitle>
              </CardHeader>
              <CardContent>
                <StatsDisplay rounds={match.rounds} playerNum={1} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{player2Name}</CardTitle>
              </CardHeader>
              <CardContent>
                <StatsDisplay rounds={match.rounds} playerNum={2} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsDisplay({ rounds, playerNum }: { rounds: ArenaMatch["rounds"]; playerNum: 1 | 2 }) {
  const moves = rounds.map(r => playerNum === 1 ? r.player1Move : r.player2Move);
  const points = rounds.map(r => playerNum === 1 ? r.player1Points : r.player2Points);
  const latencies = rounds.map(r => playerNum === 1 ? r.player1LatencyMs : r.player2LatencyMs);

  const cooperativeMoves = ["COOPERATE", "STAG", "WORK"];
  const coopCount = moves.filter(m => cooperativeMoves.includes(m)).length;
  const defectCount = moves.length - coopCount;
  const coopRate = moves.length > 0 ? ((coopCount / moves.length) * 100).toFixed(1) : "0";

  const totalPoints = points.reduce((a, b) => a + b, 0);
  const avgPoints = moves.length > 0 ? (totalPoints / moves.length).toFixed(2) : "0";
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total Points</span>
        <span className="font-bold">{totalPoints}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Cooperation Rate</span>
        <span className="font-medium">{coopRate}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Cooperative Moves</span>
        <span>{coopCount}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Defecting Moves</span>
        <span>{defectCount}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Avg Points/Round</span>
        <span>{avgPoints}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Avg Response Time</span>
        <span>{avgLatency}ms</span>
      </div>
    </div>
  );
}
