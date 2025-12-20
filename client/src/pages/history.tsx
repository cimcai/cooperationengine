import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Eye, 
  Trash2, 
  Download, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  FileJson,
  FileSpreadsheet,
  History as HistoryIcon,
  Grid3X3,
} from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import { Link } from "wouter";
import type { Run, Session, Chatbot } from "@shared/schema";

interface HistoryItem {
  run: Run;
  session: Session;
}

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-3 w-3" />,
  anthropic: <span className="text-[10px] font-bold">A</span>,
  gemini: <SiGoogle className="h-3 w-3" />,
};

export default function HistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<HistoryItem | null>(null);

  const { data: history = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history"],
  });

  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (runId: string) => {
      await apiRequest("DELETE", `/api/runs/${runId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ title: "Run deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete run", variant: "destructive" });
    },
  });

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const exportAsJson = (item: HistoryItem) => {
    const data = {
      session: item.session,
      run: item.run,
      responses: item.run.responses.map(r => ({
        chatbot: chatbots.find(c => c.id === r.chatbotId)?.displayName,
        ...r,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.session.title.replace(/\s+/g, "_")}_${item.run.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCsv = (item: HistoryItem) => {
    const headers = ["Chatbot", "Provider", "Prompt", "Response", "Latency (ms)", "Error"];
    const rows = item.run.responses.map(r => {
      const chatbot = chatbots.find(c => c.id === r.chatbotId);
      const prompt = item.session.prompts.find(p => p.order === r.stepOrder);
      return [
        chatbot?.displayName || r.chatbotId,
        chatbot?.provider || "",
        `"${(prompt?.content || "").replace(/"/g, '""')}"`,
        `"${(r.content || "").replace(/"/g, '""')}"`,
        r.latencyMs.toString(),
        r.error || "",
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.session.title.replace(/\s+/g, "_")}_${item.run.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: Run["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Run History</h1>
            <p className="text-sm text-muted-foreground">View and export past cooperation runs</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" />
              Recent Runs
              {history.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {history.length} run{history.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                <HistoryIcon className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">No runs yet</p>
                <p className="text-xs mt-1">Start a new session to see runs here</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Chatbots</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.run.id} data-testid={`row-run-${item.run.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.run.status)}
                            <span className="text-sm capitalize">{item.run.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{item.session.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.session.prompts.length} prompt{item.session.prompts.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {item.run.chatbotIds.map((id) => {
                              const chatbot = chatbots.find(c => c.id === id);
                              return (
                                <Badge key={id} variant="outline" className="text-xs gap-1">
                                  {chatbot && providerIcons[chatbot.provider]}
                                  {chatbot?.displayName.split(" ")[0]}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(item.run.startedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedRun(item)}
                              data-testid={`button-view-${item.run.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link href={`/results/${item.session.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-grid-${item.run.id}`}
                              >
                                <Grid3X3 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => exportAsJson(item)}
                              data-testid={`button-export-json-${item.run.id}`}
                            >
                              <FileJson className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => exportAsCsv(item)}
                              data-testid={`button-export-csv-${item.run.id}`}
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(item.run.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${item.run.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedRun?.session.title}</DialogTitle>
            <DialogDescription>
              Run ID: {selectedRun?.run.id.slice(0, 8)}... | {selectedRun && formatDate(selectedRun.run.startedAt)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRun && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Prompts</h4>
                <div className="space-y-2">
                  {selectedRun.session.prompts.map((prompt, idx) => (
                    <div key={prompt.id} className="flex gap-2 p-2 bg-muted rounded-md">
                      <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                      <p className="text-sm flex-1">{prompt.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Responses</h4>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportAsJson(selectedRun)}>
                      <Download className="h-3 w-3 mr-1" />
                      JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportAsCsv(selectedRun)}>
                      <Download className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRun.run.chatbotIds.map((chatbotId) => {
                      const chatbot = chatbots.find(c => c.id === chatbotId);
                      const responses = selectedRun.run.responses.filter(r => r.chatbotId === chatbotId);

                      return (
                        <Card key={chatbotId}>
                          <CardHeader className="py-2 px-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {chatbot && providerIcons[chatbot.provider]}
                                <span className="text-sm font-medium">{chatbot?.displayName}</span>
                              </div>
                              {responses.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(responses.map(r => r.content).join("\n\n"))}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="py-2 px-3">
                            {responses.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No response</p>
                            ) : (
                              responses.map((response, idx) => (
                                <div key={idx}>
                                  {response.error ? (
                                    <p className="text-sm text-destructive">{response.error}</p>
                                  ) : (
                                    <pre className="font-mono text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-auto">
                                      {response.content}
                                    </pre>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {response.latencyMs}ms
                                  </p>
                                </div>
                              ))
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
