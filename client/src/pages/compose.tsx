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
  Clock,
  FileText,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiOpenai, SiGoogle } from "react-icons/si";
import type { Chatbot, PromptStep, Run, Session } from "@shared/schema";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-4 w-4" />,
  anthropic: <span className="text-xs font-bold">A</span>,
  gemini: <SiGoogle className="h-4 w-4" />,
  xai: <span className="text-xs font-bold">X</span>,
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  xai: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompts: { role: "user" | "assistant" | "system"; content: string }[];
}

const promptTemplates: PromptTemplate[] = [
  {
    id: "prisoners-dilemma-10",
    title: "Prisoner's Dilemma (10 Rounds)",
    description: "Classic game theory experiment over 10 rounds",
    prompts: [
      { role: "system", content: "You are playing an iterated Prisoner's Dilemma game. In each round, you must choose to either COOPERATE or DEFECT. Scoring: If both cooperate, both get 3 points. If both defect, both get 1 point. If one cooperates and one defects, the defector gets 5 points and the cooperator gets 0. Your goal is to maximize your total score over all rounds. Respond with only COOPERATE or DEFECT followed by a brief explanation of your reasoning." },
      { role: "user", content: "Round 1: This is the first round. What is your choice?" },
      { role: "user", content: "Round 2: Your opponent chose COOPERATE in Round 1. What is your choice?" },
      { role: "user", content: "Round 3: Your opponent chose COOPERATE in Round 2. What is your choice?" },
      { role: "user", content: "Round 4: Your opponent chose DEFECT in Round 3. What is your choice?" },
      { role: "user", content: "Round 5: Your opponent chose COOPERATE in Round 4. What is your choice?" },
      { role: "user", content: "Round 6: Your opponent chose COOPERATE in Round 5. What is your choice?" },
      { role: "user", content: "Round 7: Your opponent chose DEFECT in Round 6. What is your choice?" },
      { role: "user", content: "Round 8: Your opponent chose COOPERATE in Round 7. What is your choice?" },
      { role: "user", content: "Round 9: Your opponent chose COOPERATE in Round 8. What is your choice?" },
      { role: "user", content: "Round 10 (FINAL): Your opponent chose COOPERATE in Round 9. This is the last round. What is your choice?" },
    ],
  },
  {
    id: "prisoners-dilemma-always-cooperate",
    title: "Prisoner's Dilemma (Always Cooperating Opponent)",
    description: "10 rounds where the opponent always cooperates - will AIs exploit this?",
    prompts: [
      { role: "system", content: "You are playing an iterated Prisoner's Dilemma game. In each round, you must choose to either COOPERATE or DEFECT. Scoring: If both cooperate, both get 3 points. If both defect, both get 1 point. If one cooperates and one defects, the defector gets 5 points and the cooperator gets 0. Respond with only COOPERATE or DEFECT followed by a brief explanation of your reasoning." },
      { role: "user", content: "Round 1: This is the first round. What is your choice?" },
      { role: "user", content: "Round 2: Your opponent chose COOPERATE in Round 1. What is your choice?" },
      { role: "user", content: "Round 3: Your opponent chose COOPERATE in Round 2. What is your choice?" },
      { role: "user", content: "Round 4: Your opponent chose COOPERATE in Round 3. What is your choice?" },
      { role: "user", content: "Round 5: Your opponent chose COOPERATE in Round 4. What is your choice?" },
      { role: "user", content: "Round 6: Your opponent chose COOPERATE in Round 5. What is your choice?" },
      { role: "user", content: "Round 7: Your opponent chose COOPERATE in Round 6. What is your choice?" },
      { role: "user", content: "Round 8: Your opponent chose COOPERATE in Round 7. What is your choice?" },
      { role: "user", content: "Round 9: Your opponent chose COOPERATE in Round 8. What is your choice?" },
      { role: "user", content: "Round 10 (FINAL): Your opponent chose COOPERATE in Round 9. This is the last round - there will be no future rounds to consider. What is your choice?" },
    ],
  },
  {
    id: "trolley-problem",
    title: "Trolley Problem Variations",
    description: "Ethical dilemma with escalating variations",
    prompts: [
      { role: "user", content: "A runaway trolley is heading toward 5 people tied to the tracks. You are standing next to a lever that can divert the trolley to a side track, where 1 person is tied. Do you pull the lever? Explain your reasoning." },
      { role: "user", content: "Same scenario, but now you are standing on a bridge above the tracks. The only way to stop the trolley is to push a large man off the bridge onto the tracks, killing him but saving the 5 people. Do you push him? Explain how this differs from your previous answer." },
      { role: "user", content: "Now imagine the 1 person on the side track is a doctor who will go on to save 100 lives. The 5 people are convicted criminals. Does this change your original answer? Why or why not?" },
      { role: "user", content: "What if you are the one tied to the side track, and you have to decide whether to pull the lever yourself to save the 5 people? How does self-sacrifice change the ethical calculus?" },
    ],
  },
  {
    id: "creative-story",
    title: "Collaborative Story Building",
    description: "Compare creative writing styles across AI models",
    prompts: [
      { role: "user", content: "Begin a short story with this opening line: 'The last lighthouse keeper in the world woke to find all the stars had disappeared.' Write 2-3 paragraphs continuing this story." },
      { role: "user", content: "Now introduce a mysterious character who arrives at the lighthouse. Describe them and hint at their connection to the missing stars. Write 2-3 paragraphs." },
      { role: "user", content: "Write the climactic revelation: what happened to the stars and what must the lighthouse keeper do? Conclude the story in 2-3 paragraphs." },
    ],
  },
  {
    id: "code-review",
    title: "Code Review Challenge",
    description: "Compare how different AIs approach code analysis",
    prompts: [
      { role: "user", content: "Review this JavaScript function and identify any bugs, performance issues, or improvements:\n\n```javascript\nfunction findDuplicates(arr) {\n  let duplicates = [];\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = 0; j < arr.length; j++) {\n      if (i != j && arr[i] == arr[j]) {\n        duplicates.push(arr[i]);\n      }\n    }\n  }\n  return duplicates;\n}\n```" },
      { role: "user", content: "Now write an optimized version of this function with O(n) time complexity. Explain your approach." },
      { role: "user", content: "Add TypeScript types to your solution and handle edge cases like null, undefined, or non-array inputs." },
    ],
  },
  {
    id: "reasoning-chain",
    title: "Chain of Thought Reasoning",
    description: "Test step-by-step logical reasoning abilities",
    prompts: [
      { role: "user", content: "Solve this step by step: A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left? Show your reasoning process." },
      { role: "user", content: "Now a harder one: If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets? Show each step of your reasoning." },
      { role: "user", content: "Logic puzzle: Three people check into a hotel room that costs $30. They each pay $10. Later, the manager realizes the room was only $25. He gives $5 to the bellboy to return. The bellboy keeps $2 and gives each person $1 back. So each person paid $9 (totaling $27), plus the bellboy has $2. That's $29. Where's the missing dollar? Explain the flaw in this reasoning." },
    ],
  },
  {
    id: "debate-format",
    title: "Self-Debate on AI Safety",
    description: "Have AI argue both sides of a complex topic",
    prompts: [
      { role: "user", content: "Present the strongest argument FOR pausing AI development until we better understand alignment and safety risks. Be as persuasive as possible." },
      { role: "user", content: "Now present the strongest argument AGAINST pausing AI development. Assume the role of someone who genuinely believes continued development is the right path." },
      { role: "user", content: "Finally, synthesize both perspectives. What's the most nuanced, balanced position you can articulate on AI development pacing? What concrete policies would you recommend?" },
    ],
  },
];

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

  const loadTemplate = (template: PromptTemplate) => {
    setTitle(template.title);
    setPrompts(
      template.prompts.map((p, i) => ({
        id: crypto.randomUUID(),
        order: i,
        role: p.role,
        content: p.content,
      }))
    );
    setCurrentRun(null);
    toast({
      title: "Template loaded",
      description: `Loaded "${template.title}" with ${template.prompts.length} prompts`,
    });
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
            <div className="flex gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-load-template">
                    <FileText className="h-4 w-4 mr-2" />
                    Templates
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Load a Template</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {promptTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className="flex flex-col items-start gap-1 cursor-pointer"
                      data-testid={`template-${template.id}`}
                    >
                      <span className="font-medium">{template.title}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {currentRun && (
                <Button variant="outline" onClick={resetSession} data-testid="button-new-session">
                  New Session
                </Button>
              )}
            </div>
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
                      <div className="space-y-6">
                        {(() => {
                          // Get unique step orders from responses
                          const stepOrders = [...new Set(currentRun.responses.map(r => r.stepOrder))].sort((a, b) => a - b);
                          // Get the expected total steps from prompts (excluding system prompts)
                          const expectedSteps = prompts.filter(p => p.role !== "system").length || stepOrders.length || 1;
                          const stepsToShow = Math.max(expectedSteps, stepOrders.length > 0 ? Math.max(...stepOrders) + 1 : 0);
                          
                          return Array.from({ length: stepsToShow }, (_, stepIndex) => {
                            const stepPrompt = prompts.filter(p => p.role !== "system")[stepIndex];
                            
                            return (
                              <div key={stepIndex} className="border rounded-md overflow-hidden">
                                <div className="bg-muted/50 px-3 py-2 border-b">
                                  <span className="text-sm font-medium">Round {stepIndex + 1}</span>
                                  {stepPrompt && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {stepPrompt.content.substring(0, 100)}...
                                    </p>
                                  )}
                                </div>
                                <div className="divide-y">
                                  {currentRun.chatbotIds.map((chatbotId) => {
                                    const chatbot = chatbots.find(c => c.id === chatbotId);
                                    const response = currentRun.responses.find(
                                      r => r.chatbotId === chatbotId && r.stepOrder === stepIndex
                                    );
                                    
                                    return (
                                      <div key={chatbotId} className="p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className={`flex h-6 w-6 items-center justify-center rounded ${providerColors[chatbot?.provider || 'openai']}`}>
                                            {providerIcons[chatbot?.provider || 'openai']}
                                          </div>
                                          <span className="text-xs font-medium">{chatbot?.displayName}</span>
                                          {response && !response.error && (
                                            <Badge variant="outline" className="ml-auto text-xs">
                                              {response.latencyMs}ms
                                            </Badge>
                                          )}
                                          {response?.error && (
                                            <Badge variant="destructive" className="ml-auto text-xs">
                                              Error
                                            </Badge>
                                          )}
                                          {!response && currentRun.status === "running" && (
                                            <Loader2 className="h-3 w-3 ml-auto animate-spin" />
                                          )}
                                        </div>
                                        <div className="text-sm pl-8">
                                          {!response ? (
                                            <p className="text-muted-foreground italic text-xs">
                                              {currentRun.status === "running" ? "Waiting..." : "No response"}
                                            </p>
                                          ) : response.error ? (
                                            <p className="text-destructive text-xs">{response.error}</p>
                                          ) : (
                                            <pre className="font-mono text-xs whitespace-pre-wrap break-words bg-muted/30 p-2 rounded">
                                              {response.content}
                                            </pre>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
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
