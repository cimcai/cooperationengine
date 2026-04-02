import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Zap, Info, Scale, RotateCcw, Download, DollarSign, Activity, TrendingUp } from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Chatbot, BenchmarkWeight } from "@shared/schema";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-5 w-5" />,
  anthropic: <span className="text-sm font-bold">A</span>,
  gemini: <SiGoogle className="h-5 w-5" />,
  xai: <span className="text-sm font-bold">X</span>,
  openrouter: <span className="text-sm font-bold">OR</span>,
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  xai: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  openrouter: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const MODEL_CHART_COLORS: Record<string, string> = {
  "openai-gpt5": "#10b981",
  "openai-gpt4o": "#34d399",
  "anthropic-sonnet": "#f97316",
  "anthropic-opus": "#ea580c",
  "gemini-flash": "#3b82f6",
  "gemini-pro": "#1d4ed8",
  "xai-grok": "#71717a",
  "openrouter-grok4": "#a855f7",
  "openrouter-deepseek": "#9333ea",
  "openrouter-llama": "#c084fc",
};

const providerDescriptions: Record<string, string> = {
  openai: "OpenAI's GPT models via Replit AI Integrations",
  anthropic: "Anthropic's Claude models via Replit AI Integrations",
  gemini: "Google's Gemini models via Replit AI Integrations",
  xai: "xAI's Grok models - requires XAI_API_KEY secret",
};

type DatePreset = "today" | "7days" | "30days" | "all" | "custom";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: DatePreset): { from: string | null; to: string | null } {
  const today = toISODate(new Date());
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7days": {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { from: toISODate(d), to: today };
    }
    case "30days": {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { from: toISODate(d), to: today };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
}

interface CostModelStats {
  modelId: string;
  displayName: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  callCount: number;
}

interface DailyTrendEntry {
  date: string;
  totalCost: number;
  byModel: Record<string, number>;
}

interface CostAnalytics {
  models: CostModelStats[];
  totals: {
    estimatedCost: number;
    totalTokens: number;
    totalCalls: number;
  };
  dailyTrend: DailyTrendEntry[];
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const { data: benchmarkWeights = [] } = useQuery<BenchmarkWeight[]>({
    queryKey: ["/api/benchmark-weights"],
  });

  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (benchmarkWeights.length > 0) {
      const weights: Record<string, number> = {};
      benchmarkWeights.forEach(w => {
        weights[w.testId] = w.weight;
      });
      setLocalWeights(weights);
    }
  }, [benchmarkWeights]);

  const updateWeightMutation = useMutation({
    mutationFn: async ({ testId, weight }: { testId: string; weight: number }) => {
      return apiRequest("PUT", `/api/benchmark-weights/${testId}`, { weight });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/benchmark-weights"] });
    },
  });

  const handleWeightChange = (testId: string, value: number[]) => {
    setLocalWeights(prev => ({ ...prev, [testId]: value[0] }));
    setHasChanges(true);
  };

  const saveAllWeights = async () => {
    try {
      for (const [testId, weight] of Object.entries(localWeights)) {
        await updateWeightMutation.mutateAsync({ testId, weight });
      }
      toast({
        title: "Weights Saved",
        description: "Benchmark weights have been updated successfully.",
      });
      setHasChanges(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save benchmark weights.",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = () => {
    const defaults: Record<string, number> = {};
    benchmarkWeights.forEach(w => {
      defaults[w.testId] = 100;
    });
    setLocalWeights(defaults);
    setHasChanges(true);
  };

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(toISODate(new Date()));

  const effectiveRange = datePreset === "custom"
    ? { from: customFrom || null, to: customTo || null }
    : getPresetRange(datePreset);

  const costQueryKey = (() => {
    const params = new URLSearchParams();
    if (effectiveRange.from) params.set("from", effectiveRange.from);
    if (effectiveRange.to) params.set("to", effectiveRange.to);
    const qs = params.toString();
    return [qs ? `/api/cost-analytics?${qs}` : "/api/cost-analytics"];
  })();

  const { data: costAnalytics, isLoading: costLoading } = useQuery<CostAnalytics>({
    queryKey: costQueryKey,
  });

  const groupedChatbots = chatbots.reduce((acc, chatbot) => {
    if (!acc[chatbot.provider]) {
      acc[chatbot.provider] = [];
    }
    acc[chatbot.provider].push(chatbot);
    return acc;
  }, {} as Record<string, Chatbot[]>);

  // Determine which models appear in the daily trend
  const trendModels = costAnalytics
    ? [...new Set(costAnalytics.dailyTrend.flatMap(d => Object.keys(d.byModel)))]
    : [];

  // Chart data: each row is a day with a cost per model
  const chartData = costAnalytics?.dailyTrend.map(d => {
    const row: Record<string, number | string> = { date: d.date.slice(5) }; // MM-DD
    for (const m of trendModels) {
      row[m] = parseFloat(((d.byModel[m] || 0)).toFixed(6));
    }
    return row;
  }) ?? [];

  return (
    <div className="flex flex-col h-full p-6 overflow-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure AI providers and benchmark settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Benchmark Test Weights
            </CardTitle>
            <CardDescription>
              Adjust the weight (importance) of each benchmark test in the aggregate score. Higher weights mean the test contributes more to the final score.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {benchmarkWeights.map((test) => (
              <div key={test.testId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{test.testName}</Label>
                  <Badge variant="outline" className="font-mono">
                    {localWeights[test.testId] ?? test.weight}
                  </Badge>
                </div>
                <Slider
                  value={[localWeights[test.testId] ?? test.weight]}
                  onValueChange={(value) => handleWeightChange(test.testId, value)}
                  min={0}
                  max={200}
                  step={5}
                  className="w-full"
                  data-testid={`slider-weight-${test.testId}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low Priority</span>
                  <span>Default (100)</span>
                  <span>High Priority</span>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                data-testid="button-reset-weights"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button
                onClick={saveAllWeights}
                disabled={!hasChanges || updateWeightMutation.isPending}
                data-testid="button-save-weights"
              >
                {updateWeightMutation.isPending ? "Saving..." : "Save Weights"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cost Analytics Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost Analytics
                </CardTitle>
                <CardDescription>
                  Estimated API costs based on token usage. Approximate, based on published provider pricing.
                </CardDescription>
              </div>

              {/* Date range controls */}
              <div className="flex items-center gap-2 flex-wrap" data-testid="cost-date-filter">
                <Select
                  value={datePreset}
                  onValueChange={(v) => setDatePreset(v as DatePreset)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-date-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>

                {datePreset === "custom" && (
                  <>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="h-8 w-36 text-xs"
                      data-testid="input-custom-from"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      className="h-8 w-36 text-xs"
                      data-testid="input-custom-to"
                    />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {costLoading ? (
              <div className="text-sm text-muted-foreground" data-testid="text-cost-loading">Loading cost data...</div>
            ) : !costAnalytics || costAnalytics.totals.totalCalls === 0 ? (
              <div className="text-sm text-muted-foreground" data-testid="text-cost-empty">
                No token usage data for the selected period. Run some prompts to start tracking costs.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg text-center" data-testid="stat-total-cost">
                    <div className="text-2xl font-bold text-primary">
                      ${costAnalytics.totals.estimatedCost.toFixed(4)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Estimated Total Cost</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center" data-testid="stat-total-tokens">
                    <div className="text-2xl font-bold">
                      {costAnalytics.totals.totalTokens.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Total Tokens</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center" data-testid="stat-total-calls">
                    <div className="text-2xl font-bold">
                      {costAnalytics.totals.totalCalls.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">API Calls</div>
                  </div>
                </div>

                {/* Daily cost trend chart */}
                {chartData.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4" />
                        Daily Cost Trend
                        <span className="text-xs text-muted-foreground font-normal">
                          (estimated USD, stacked by model)
                        </span>
                      </h4>
                      <div className="w-full" style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                              width={52}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                `$${value.toFixed(6)}`,
                                costAnalytics.models.find(m => m.modelId === name)?.displayName || name,
                              ]}
                              contentStyle={{ fontSize: 12 }}
                            />
                            {trendModels.length > 1 && (
                              <Legend
                                formatter={(value: string) =>
                                  costAnalytics.models.find(m => m.modelId === value)?.displayName || value
                                }
                                iconSize={8}
                                wrapperStyle={{ fontSize: 11 }}
                              />
                            )}
                            {trendModels.map(modelId => (
                              <Bar
                                key={modelId}
                                dataKey={modelId}
                                stackId="cost"
                                fill={MODEL_CHART_COLORS[modelId] || "#6b7280"}
                                radius={trendModels[trendModels.length - 1] === modelId ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Per-model breakdown */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Cost by Model
                  </h4>
                  {costAnalytics.models.map((model) => {
                    const maxCost = costAnalytics.models[0]?.estimatedCost || 1;
                    const pct = maxCost > 0 ? (model.estimatedCost / maxCost) * 100 : 0;
                    return (
                      <div key={model.modelId} className="space-y-2" data-testid={`cost-row-${model.modelId}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded text-xs ${providerColors[model.provider] || "bg-zinc-500/10 text-zinc-600"}`}
                            >
                              {providerIcons[model.provider] || <span className="text-xs font-bold">{model.provider[0]?.toUpperCase()}</span>}
                            </div>
                            <span className="font-medium">{model.displayName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{model.callCount} calls</span>
                            <span>{model.totalTokens.toLocaleString()} tokens</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              ${model.estimatedCost.toFixed(4)}
                            </Badge>
                          </div>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>In: {model.promptTokens.toLocaleString()} tokens</span>
                          <span>Out: {model.completionTokens.toLocaleString()} tokens</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              About Cooperation Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cooperation Engine allows you to send the same prompts to multiple AI chatbots
              simultaneously and compare their responses side-by-side. This is useful for:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Running experiments like the Prisoner's Dilemma with different AI agents</li>
              <li>Comparing how different models respond to the same question</li>
              <li>Testing prompt effectiveness across providers</li>
              <li>Research and analysis of AI behavior</li>
            </ul>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm">
                <span className="font-medium">Powered by Replit AI Integrations</span>
                <span className="text-muted-foreground"> - No API keys required. Usage is billed to your Replit credits.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available Providers</CardTitle>
            <CardDescription>
              Models available through Replit AI Integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedChatbots).map(([provider, models], idx) => (
              <div key={provider}>
                {idx > 0 && <Separator className="mb-6" />}
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md ${providerColors[provider]}`}>
                    {providerIcons[provider]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium capitalize">{provider}</h3>
                    <p className="text-sm text-muted-foreground">{providerDescriptions[provider]}</p>

                    <div className="mt-4 space-y-3">
                      {models.map((model) => (
                        <div key={model.id} className="flex items-center justify-between gap-4 p-3 border rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{model.displayName}</span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {model.model}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`model-${model.id}`} className="text-xs text-muted-foreground">
                              {model.enabled ? "Active" : "Inactive"}
                            </Label>
                            <Switch
                              id={`model-${model.id}`}
                              checked={model.enabled}
                              disabled
                              data-testid={`switch-model-${model.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Research Data
            </CardTitle>
            <CardDescription>
              Download all research data as a ZIP file containing CSVs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export includes: sessions, runs with AI responses, arena matches and rounds, toolkit items, benchmark weights, wargames (CSV summary + full JSON with turn-by-turn data), and a metadata.json manifest with record counts and app version.
              </p>
              <Button
                onClick={() => {
                  window.location.href = "/api/export";
                }}
                data-testid="button-export-data"
              >
                <Download className="h-4 w-4 mr-2" />
                Download All Data (ZIP)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
