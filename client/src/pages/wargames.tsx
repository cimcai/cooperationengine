import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Play, Clock, Loader2, Trash2, RefreshCw, Download, Shield, AlertTriangle, ChevronDown, ChevronRight, Zap, CheckCircle2, XCircle } from "lucide-react";
import type { Chatbot, Wargame, WargameTurn } from "@shared/schema";

const SCENARIO_INFO: Record<string, { label: string; description: string }> = {
  "standoff": { label: "Symmetric Standoff", description: "Neither side has clear advantage — tests security dilemma dynamics" },
  "alliance-credibility": { label: "Alliance Credibility", description: "Backing down risks cascading defections from allies" },
  "resource-competition": { label: "Resource Competition", description: "Strategic resource dispute with hard deadline pressure" },
  "first-strike-fears": { label: "First-Strike Fears", description: "Spiral dynamics — defensive modernization misread as offensive" },
  "regime-survival": { label: "Regime Survival", description: "Existential stakes — both leaders face regime-threatening consequences" },
  "power-transition": { label: "Power Transition", description: "Rising power challenges established hegemon — Thucydides Trap" },
  "self-play": { label: "Self-Play Control", description: "Symmetric profiles — control for personality vs strategic adaptation" },
};

export default function WargamesPage() {
  const { toast } = useToast();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const { data: chatbots = [], isLoading: loadingChatbots } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const { data: games = [], isLoading: loadingGames } = useQuery<Wargame[]>({
    queryKey: ["/api/wargames"],
    refetchInterval: 5000,
  });

  const enabledChatbots = chatbots.filter(c => c.enabled);

  const [formData, setFormData] = useState({
    alphaModelId: "",
    betaModelId: "",
    scenarioType: "standoff" as string,
    hasDeadline: false,
  });

  useEffect(() => {
    if (enabledChatbots.length >= 2 && !formData.alphaModelId && !formData.betaModelId) {
      setFormData(prev => ({
        ...prev,
        alphaModelId: enabledChatbots[0]?.id || "",
        betaModelId: enabledChatbots[1]?.id || "",
      }));
    }
  }, [enabledChatbots]);

  const createGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wargames", {
        ...formData,
        totalTurns: 8,
      });
      return res.json() as Promise<Wargame>;
    },
    onSuccess: (game: Wargame) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wargames"] });
      setSelectedGame(game.id);
      toast({ title: "Wargame Started", description: "The nuclear crisis simulation has begun." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to start wargame", description: error.message });
    },
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const modelIds = enabledChatbots.map(c => c.id);
      const res = await apiRequest("POST", "/api/wargames/batch", {
        modelIds,
        scenarioType: formData.scenarioType,
        totalTurns: 8,
        hasDeadline: formData.hasDeadline,
      });
      return res.json() as Promise<Wargame[]>;
    },
    onSuccess: (newGames: Wargame[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wargames"] });
      if (newGames.length > 0) setSelectedGame(newGames[0].id);
      toast({ title: "Batch Started", description: `${newGames.length} wargames launched across all model pairs.` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Batch failed", description: error.message });
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/wargames/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wargames"] });
      setSelectedGame(null);
    },
  });

  const currentGame = games.find(g => g.id === selectedGame);

  const getChatbotName = (id: string) => chatbots.find(c => c.id === id)?.displayName || id;

  const getStatusBadge = (game: Wargame) => {
    switch (game.status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "running": return (
        <Badge className="bg-blue-500 text-white gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Turn {Math.min(game.currentTurn + 1, game.totalTurns)}/{game.totalTurns}
        </Badge>
      );
      case "completed": return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{game.status}</Badge>;
    }
  };

  const exportGamesAsJSON = () => {
    const exportData = games.map(g => ({
      ...g,
      alphaModelName: getChatbotName(g.alphaModelId),
      betaModelName: getChatbotName(g.betaModelId),
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wargames-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-wargames-title">Wargames</h1>
          <p className="text-sm text-muted-foreground">Nuclear crisis simulations — AI models play against each other using the three-phase cognitive architecture</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportGamesAsJSON}
            disabled={games.length === 0}
            data-testid="button-export-wargames"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold mb-4">New Wargame</h2>

            <div className="space-y-4">
              <div>
                <Label>Nation Alpha</Label>
                <Select
                  value={formData.alphaModelId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, alphaModelId: v }))}
                >
                  <SelectTrigger data-testid="select-alpha">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledChatbots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Tech superior, conventionally weaker</p>
              </div>

              <div>
                <Label>Nation Beta</Label>
                <Select
                  value={formData.betaModelId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, betaModelId: v }))}
                >
                  <SelectTrigger data-testid="select-beta">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledChatbots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Conventionally dominant, risk-tolerant</p>
              </div>

              <div>
                <Label>Scenario</Label>
                <Select value={formData.scenarioType} onValueChange={(v) => setFormData(prev => ({ ...prev, scenarioType: v }))}>
                  <SelectTrigger data-testid="select-scenario">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCENARIO_INFO).map(([key, info]) => (
                      <SelectItem key={key} value={key}>{info.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{SCENARIO_INFO[formData.scenarioType]?.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.hasDeadline}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, hasDeadline: v }))}
                  data-testid="switch-deadline"
                />
                <Label>Deadline pressure (defeat at Turn 8 is final)</Label>
              </div>

              <Button
                className="w-full"
                onClick={() => createGameMutation.mutate()}
                disabled={createGameMutation.isPending || !formData.alphaModelId || !formData.betaModelId}
                data-testid="button-start-wargame"
              >
                {createGameMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Wargame
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => batchMutation.mutate()}
                disabled={batchMutation.isPending || enabledChatbots.length < 2}
                data-testid="button-run-all-combinations"
              >
                {batchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Run All Combinations ({enabledChatbots.length > 1 ? (enabledChatbots.length * (enabledChatbots.length - 1)) / 2 : 0} games)
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <h2 className="font-semibold">Wargames</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/wargames"] })}
                data-testid="button-refresh-wargames"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {loadingGames ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : games.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">No wargames yet</p>
                ) : (
                  games.map(game => (
                    <Card
                      key={game.id}
                      className={`cursor-pointer transition-colors ${selectedGame === game.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedGame(game.id)}
                      data-testid={`card-wargame-${game.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          {getStatusBadge(game)}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteGameMutation.mutate(game.id);
                            }}
                            data-testid={`button-delete-wargame-${game.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-sm font-medium">
                          {getChatbotName(game.alphaModelId)} vs {getChatbotName(game.betaModelId)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {SCENARIO_INFO[game.scenarioType]?.label || game.scenarioType}
                          {game.hasDeadline && <span className="ml-1 text-orange-500">(deadline)</span>}
                        </div>
                        {game.status === "running" && (
                          <Progress
                            value={(game.currentTurn / game.totalTurns) * 100}
                            className="mt-2 h-1"
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {!currentGame ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a wargame to view details</h3>
                <p className="text-sm text-muted-foreground mt-1">Or start a new simulation, or run all model combinations</p>
              </div>
            </div>
          ) : (
            <WargameViewer game={currentGame} chatbots={chatbots} />
          )}
        </div>
      </div>
    </div>
  );
}

function WargameViewer({ game, chatbots }: { game: Wargame; chatbots: Chatbot[] }) {
  const getChatbotName = (id: string) => chatbots.find(c => c.id === id)?.displayName || id;
  const alphaName = getChatbotName(game.alphaModelId);
  const betaName = getChatbotName(game.betaModelId);
  const scenarioLabel = SCENARIO_INFO[game.scenarioType]?.label || game.scenarioType;

  // SSE connection for live progress when game is running
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (game.status !== "running") {
      sseRef.current?.close();
      sseRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      return;
    }

    const connect = () => {
      if (sseRef.current) sseRef.current.close();
      const es = new EventSource(`/api/wargames/${game.id}/events`);
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === "turn_start" ||
            data.type === "turn_complete" ||
            data.type === "game_complete" ||
            data.type === "game_failed"
          ) {
            queryClient.invalidateQueries({ queryKey: ["/api/wargames"] });
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        // Reconnect after 3 s if game still expected to be running
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      sseRef.current?.close();
      sseRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [game.id, game.status]);

  // Infer which turn is currently being processed (clamped to totalTurns)
  const processingTurn = game.status === "running"
    ? Math.min(game.currentTurn + 1, game.totalTurns)
    : null;
  const progressPct = (game.currentTurn / game.totalTurns) * 100;

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      {/* Header card: match-up + status */}
      <Card className="mb-4 flex-shrink-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1">
              <div className="text-xs text-muted-foreground mb-1">Nation Alpha</div>
              <div className="text-xl font-bold">{alphaName}</div>
              <div className="text-xs text-muted-foreground">Tech superior, conventionally weaker</div>
            </div>
            <div className="text-center min-w-[140px]">
              <div className="text-xs text-muted-foreground mb-1">
                {scenarioLabel}{game.hasDeadline ? " (deadline)" : ""}
              </div>
              {game.status === "running" ? (
                <>
                  <div className="text-sm font-semibold mb-1 flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    Turn {processingTurn} of {game.totalTurns}
                  </div>
                  <Progress value={progressPct} className="h-2 w-32 mx-auto" />
                  <div className="text-xs text-muted-foreground mt-1">
                    {game.currentTurn} completed
                  </div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground text-sm mb-1">
                    Turn {game.currentTurn} / {game.totalTurns}
                  </div>
                  <Badge variant={game.status === "completed" ? "default" : "secondary"}>
                    {game.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {game.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                    {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                  </Badge>
                  {game.status === "completed" && (
                    <Progress value={100} className="h-2 w-32 mx-auto mt-2" />
                  )}
                </>
              )}
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-muted-foreground mb-1">Nation Beta</div>
              <div className="text-xl font-bold">{betaName}</div>
              <div className="text-xs text-muted-foreground">Conventionally dominant, risk-tolerant</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Turn step indicators */}
      {(game.status === "running" || game.status === "completed") && (
        <div className="flex gap-1 mb-3 flex-shrink-0 flex-wrap">
          {Array.from({ length: game.totalTurns }, (_, i) => {
            const turnNum = i + 1;
            const completed = turnNum <= game.currentTurn;
            const active = turnNum === processingTurn;
            const turn = game.turns.find(t => t.turnNumber === turnNum);
            const hasError = turn?.alphaError || turn?.betaError;

            return (
              <div
                key={turnNum}
                className={`flex items-center justify-center rounded text-xs font-medium h-7 w-12 transition-colors ${
                  hasError
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                    : active
                    ? "bg-blue-500 text-white animate-pulse"
                    : completed
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
                title={active ? `Processing Turn ${turnNum}` : completed ? `Turn ${turnNum} complete` : `Turn ${turnNum} pending`}
                data-testid={`step-turn-${turnNum}`}
              >
                {hasError ? <AlertTriangle className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : `T${turnNum}`}
              </div>
            );
          })}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {game.turns.length === 0 && game.status === "running" ? (
            <ProcessingTurnCard turnNumber={1} alphaName={alphaName} betaName={betaName} />
          ) : game.turns.length === 0 && game.status === "failed" ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <span>Simulation failed before any turns completed</span>
              </div>
            </div>
          ) : game.turns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No turns yet</p>
          ) : (
            <>
              {game.turns.map((turn) => (
                <TurnCard
                  key={turn.turnNumber}
                  turn={turn}
                  alphaName={alphaName}
                  betaName={betaName}
                />
              ))}
              {/* Show processing placeholder for next turn if still running */}
              {game.status === "running" && processingTurn && processingTurn <= game.totalTurns && (
                <ProcessingTurnCard
                  turnNumber={processingTurn}
                  alphaName={alphaName}
                  betaName={betaName}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProcessingTurnCard({ turnNumber, alphaName, betaName }: {
  turnNumber: number;
  alphaName: string;
  betaName: string;
}) {
  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" data-testid={`card-turn-processing-${turnNumber}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="font-medium text-sm">Turn {turnNumber} — Querying models...</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {alphaName} thinking...
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {betaName} thinking...
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TurnCard({ turn, alphaName, betaName }: {
  turn: WargameTurn;
  alphaName: string;
  betaName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isFogOfWar = /fog of war/i.test(turn.situationDescription);
  const hasAlphaError = Boolean(turn.alphaError);
  const hasBetaError = Boolean(turn.betaError);
  const hasAnyError = hasAlphaError || hasBetaError;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-turn-${turn.turnNumber}`} className={hasAnyError ? "border-orange-200 dark:border-orange-800" : ""}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Turn {turn.turnNumber}
                    {isFogOfWar && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fog of War
                      </Badge>
                    )}
                    {hasAnyError && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Model Error
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className={`flex items-center gap-1 ${hasAlphaError ? "text-orange-500" : ""}`}>
                  {hasAlphaError ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {alphaName}: {hasAlphaError ? "failed" : `${(turn.alphaLatencyMs / 1000).toFixed(1)}s`}
                </div>
                <div className={`flex items-center gap-1 ${hasBetaError ? "text-orange-500" : ""}`}>
                  {hasBetaError ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {betaName}: {hasBetaError ? "failed" : `${(turn.betaLatencyMs / 1000).toFixed(1)}s`}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 ml-7">
              <div>
                <p className="text-xs text-muted-foreground">{alphaName} — Public Signal:</p>
                <p className={`text-xs font-medium truncate ${hasAlphaError ? "text-orange-500 italic" : ""}`}>
                  {turn.alphaPublicSignal}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{betaName} — Public Signal:</p>
                <p className={`text-xs font-medium truncate ${hasBetaError ? "text-orange-500 italic" : ""}`}>
                  {turn.betaPublicSignal}
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {/* Error banners */}
            {hasAlphaError && (
              <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400">
                <span className="font-semibold">{alphaName} error:</span> {turn.alphaError}
              </div>
            )}
            {hasBetaError && (
              <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400">
                <span className="font-semibold">{betaName} error:</span> {turn.betaError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-primary">{alphaName} (Nation Alpha)</div>
                {hasAlphaError ? (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded text-xs text-orange-700 dark:text-orange-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    Model failed this turn: {turn.alphaError}
                  </div>
                ) : (
                  <>
                    <div>
                      <Badge variant="outline" className="mb-1 text-green-600 dark:text-green-400">Public Signal</Badge>
                      <p className="text-sm bg-green-50 dark:bg-green-950/30 p-2 rounded">{turn.alphaPublicSignal}</p>
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-1 text-red-600 dark:text-red-400">Private Action</Badge>
                      <p className="text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded">{turn.alphaPrivateAction}</p>
                    </div>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs" data-testid={`button-alpha-full-${turn.turnNumber}`}>
                          <ChevronRight className="h-3 w-3 mr-1" />
                          Full Response
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="text-xs bg-muted p-3 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {turn.alphaResponse}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-primary">{betaName} (Nation Beta)</div>
                {hasBetaError ? (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded text-xs text-orange-700 dark:text-orange-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    Model failed this turn: {turn.betaError}
                  </div>
                ) : (
                  <>
                    <div>
                      <Badge variant="outline" className="mb-1 text-green-600 dark:text-green-400">Public Signal</Badge>
                      <p className="text-sm bg-green-50 dark:bg-green-950/30 p-2 rounded">{turn.betaPublicSignal}</p>
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-1 text-red-600 dark:text-red-400">Private Action</Badge>
                      <p className="text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded">{turn.betaPrivateAction}</p>
                    </div>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs" data-testid={`button-beta-full-${turn.turnNumber}`}>
                          <ChevronRight className="h-3 w-3 mr-1" />
                          Full Response
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="text-xs bg-muted p-3 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {turn.betaResponse}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
