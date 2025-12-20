import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Trash2, 
  Send, 
  GripVertical, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import type { Chatbot, PromptStep, Run, Session } from "@shared/schema";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-4 w-4" />,
  anthropic: <span className="text-xs font-bold">A</span>,
  gemini: <SiGoogle className="h-4 w-4" />,
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export default function ComposePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("New Cooperation Session");
  const [prompts, setPrompts] = useState<PromptStep[]>([
    { id: crypto.randomUUID(), order: 0, role: "user", content: "" }
  ]);
  const [selectedChatbots, setSelectedChatbots] = useState<string[]>([]);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);

  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const sessionRes = await apiRequest("POST", "/api/sessions", {
        title,
        prompts: prompts.filter(p => p.content.trim()),
      });
      const session: Session = await sessionRes.json();
      
      const runRes = await apiRequest("POST", `/api/sessions/${session.id}/run`, {
        chatbotIds: selectedChatbots,
      });
      const run: Run = await runRes.json();
      return run;
    },
    onSuccess: (run) => {
      setCurrentRun(run);
      pollForResults(run.id);
      toast({
        title: "Run started",
        description: "Sending prompts to selected chatbots...",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start run",
        variant: "destructive",
      });
    },
  });

  const pollForResults = async (runId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`);
        const run: Run = await response.json();
        setCurrentRun(run);
        
        if (run.status === "running" || run.status === "pending") {
          setTimeout(poll, 1000);
        } else {
          queryClient.invalidateQueries({ queryKey: ["/api/history"] });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };
    poll();
  };

  const addPrompt = () => {
    setPrompts([
      ...prompts,
      { id: crypto.randomUUID(), order: prompts.length, role: "user", content: "" }
    ]);
  };

  const removePrompt = (id: string) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter(p => p.id !== id).map((p, i) => ({ ...p, order: i })));
    }
  };

  const updatePrompt = (id: string, content: string) => {
    setPrompts(prompts.map(p => p.id === id ? { ...p, content } : p));
  };

  const toggleChatbot = (id: string) => {
    setSelectedChatbots(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedChatbots(chatbots.filter(c => c.enabled).map(c => c.id));
  };

  const clearAll = () => {
    setSelectedChatbots([]);
  };

  const canRun = prompts.some(p => p.content.trim()) && selectedChatbots.length > 0;

  const resetSession = () => {
    setCurrentRun(null);
    setPrompts([{ id: crypto.randomUUID(), order: 0, role: "user", content: "" }]);
    setTitle("New Cooperation Session");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-0 bg-transparent px-0 focus-visible:ring-0"
                placeholder="Session title..."
                data-testid="input-session-title"
              />
            </div>
            {currentRun && (
              <Button variant="outline" onClick={resetSession} data-testid="button-new-session">
                New Session
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    Prompt Sequence
                    <Badge variant="secondary" className="font-normal">
                      {prompts.filter(p => p.content.trim()).length} prompt{prompts.filter(p => p.content.trim()).length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {prompts.map((prompt, index) => (
                    <div key={prompt.id} className="flex gap-2 items-start group">
                      <div className="flex items-center gap-1 pt-2 text-muted-foreground">
                        <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 cursor-grab" />
                        <span className="text-xs font-mono w-4">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <Textarea
                          value={prompt.content}
                          onChange={(e) => updatePrompt(prompt.id, e.target.value)}
                          placeholder={index === 0 
                            ? "Enter your first prompt (e.g., 'You are playing the prisoner's dilemma game...')" 
                            : "Enter the next prompt in the sequence..."
                          }
                          className="min-h-[100px] resize-none"
                          data-testid={`input-prompt-${index}`}
                        />
                      </div>
                      {prompts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePrompt(prompt.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-prompt-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addPrompt}
                    className="w-full"
                    data-testid="button-add-prompt"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prompt
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">Select Chatbots</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-all">
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {chatbots.filter(c => c.enabled).map((chatbot) => (
                      <div
                        key={chatbot.id}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors hover-elevate ${
                          selectedChatbots.includes(chatbot.id) 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border'
                        }`}
                        onClick={() => toggleChatbot(chatbot.id)}
                        data-testid={`checkbox-chatbot-${chatbot.id}`}
                      >
                        <Checkbox
                          checked={selectedChatbots.includes(chatbot.id)}
                          onCheckedChange={() => toggleChatbot(chatbot.id)}
                        />
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${providerColors[chatbot.provider]}`}>
                          {providerIcons[chatbot.provider]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{chatbot.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{chatbot.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => runMutation.mutate()}
                disabled={!canRun || runMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-send-to-all"
              >
                {runMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to {selectedChatbots.length} Chatbot{selectedChatbots.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <Card className="h-full min-h-[500px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    Responses
                    {currentRun && (
                      <Badge 
                        variant={
                          currentRun.status === "completed" ? "default" :
                          currentRun.status === "failed" ? "destructive" :
                          "secondary"
                        }
                      >
                        {currentRun.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {currentRun.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {currentRun.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                        {currentRun.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {currentRun.status}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!currentRun ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                      <Send className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm">Send prompts to see responses here</p>
                      <p className="text-xs mt-1">Responses will appear side-by-side for comparison</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {currentRun.chatbotIds.map((chatbotId) => {
                          const chatbot = chatbots.find(c => c.id === chatbotId);
                          const responses = currentRun.responses.filter(r => r.chatbotId === chatbotId);
                          const hasError = responses.some(r => r.error);
                          
                          return (
                            <div key={chatbotId} className="border rounded-md overflow-hidden">
                              <div className={`flex items-center gap-2 px-3 py-2 ${providerColors[chatbot?.provider || 'openai']} border-b`}>
                                {providerIcons[chatbot?.provider || 'openai']}
                                <span className="text-sm font-medium">{chatbot?.displayName}</span>
                                {responses.length > 0 && !hasError && (
                                  <Badge variant="outline" className="ml-auto text-xs">
                                    {responses[0].latencyMs}ms
                                  </Badge>
                                )}
                                {hasError && (
                                  <Badge variant="destructive" className="ml-auto text-xs">
                                    Error
                                  </Badge>
                                )}
                                {responses.length === 0 && currentRun.status === "running" && (
                                  <Loader2 className="h-3 w-3 ml-auto animate-spin" />
                                )}
                              </div>
                              <div className="p-3 bg-card">
                                {responses.length === 0 ? (
                                  <p className="text-sm text-muted-foreground italic">
                                    {currentRun.status === "running" ? "Waiting for response..." : "No response yet"}
                                  </p>
                                ) : (
                                  responses.map((response, idx) => (
                                    <div key={idx} className="text-sm">
                                      {response.error ? (
                                        <p className="text-destructive">{response.error}</p>
                                      ) : (
                                        <pre className="font-mono text-xs whitespace-pre-wrap break-words">{response.content}</pre>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
