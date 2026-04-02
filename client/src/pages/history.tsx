import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  BookOpen,
} from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import { Link } from "wouter";
import type { Run, Session, Chatbot } from "@shared/schema";

interface HistoryItem {
  run: Run;
  session: Session;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-3 w-3" />,
  anthropic: <span className="text-[10px] font-bold">A</span>,
  gemini: <SiGoogle className="h-3 w-3" />,
  xai: <span className="text-[10px] font-bold">X</span>,
};

const PAGE_SIZE_OPTIONS = ["25", "50", "100", "250"];

export default function HistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<HistoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const queryKey = ["/api/history", { page, limit, search }];

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const history = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }, []);

  const handlePageSizeChange = (val: string) => {
    setLimit(Number(val));
    setPage(1);
  };

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

  const exportAsStory = (item: HistoryItem) => {
    const allChatbots = item.run.chatbotIds.map(id => chatbots.find(c => c.id === id)).filter(Boolean) as Chatbot[];
    const systemPrompt = item.session.prompts.find(p => p.role === "system");
    const userPrompts = item.session.prompts.filter(p => p.role === "user").sort((a, b) => a.order - b.order);
    const dateStr = new Date(item.run.startedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

    const modelColors: Record<string, string> = {
      openai: "#10a37f",
      anthropic: "#d97706",
      gemini: "#4285f4",
      xai: "#1a1a1a",
      openrouter: "#7c3aed",
    };

    const roundSections = userPrompts.map((prompt, idx) => {
      const responses = item.run.responses.filter(r => r.stepOrder === prompt.order);
      const responseBlocks = item.run.chatbotIds.map(chatbotId => {
        const bot = chatbots.find(c => c.id === chatbotId);
        const resp = responses.find(r => r.chatbotId === chatbotId);
        const color = modelColors[bot?.provider ?? "openai"] ?? "#555";
        const content = resp?.error
          ? `<em style="color:#c00">Error: ${esc(resp.error)}</em>`
          : resp?.content
            ? nl2br(resp.content)
            : `<em style="color:#999">No response</em>`;
        return `
          <div class="response-card">
            <div class="model-label" style="color:${color}">${esc(bot?.displayName ?? chatbotId)}</div>
            <div class="response-body">${content}</div>
            ${resp && !resp.error ? `<div class="meta">${resp.latencyMs.toLocaleString()}ms</div>` : ""}
          </div>`;
      }).join("");

      return `
        <section class="round">
          <div class="round-header">
            <span class="round-number">Round ${idx + 1}</span>
          </div>
          <div class="prompt-box">${nl2br(prompt.content)}</div>
          <div class="responses">${responseBlocks}</div>
        </section>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(item.session.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    background: #fafaf8;
    color: #1a1a1a;
    line-height: 1.75;
    padding: 0 1rem 4rem;
  }
  .page-wrap { max-width: 860px; margin: 0 auto; }
  header {
    padding: 3.5rem 0 2rem;
    border-bottom: 2px solid #1a1a1a;
    margin-bottom: 2.5rem;
  }
  h1 {
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 0.75rem;
  }
  .meta-line {
    font-family: system-ui, sans-serif;
    font-size: 0.82rem;
    color: #666;
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .meta-line span::before { content: "· "; }
  .meta-line span:first-child::before { content: ""; }
  .models-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 1rem;
  }
  .model-badge {
    font-family: system-ui, sans-serif;
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #ddd;
    background: #fff;
    color: #333;
  }
  .preface {
    background: #f0ede6;
    border-left: 4px solid #8b7355;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2.5rem;
    border-radius: 0 6px 6px 0;
    font-size: 0.9rem;
    color: #3a3228;
    font-style: italic;
  }
  .preface strong { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8b7355; margin-bottom: 0.5rem; font-style: normal; }
  .round {
    margin-bottom: 3rem;
    padding-bottom: 3rem;
    border-bottom: 1px solid #e0ddd6;
  }
  .round:last-child { border-bottom: none; }
  .round-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .round-number {
    font-family: system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    border: 1px solid #ddd;
    padding: 0.2rem 0.7rem;
    border-radius: 3px;
  }
  .prompt-box {
    background: #fff;
    border: 1px solid #e0ddd6;
    border-radius: 6px;
    padding: 1.1rem 1.4rem;
    font-size: 1rem;
    margin-bottom: 1.5rem;
    color: #2a2a2a;
  }
  .responses { display: flex; flex-direction: column; gap: 1.25rem; }
  .response-card {
    background: #fff;
    border: 1px solid #e8e5de;
    border-radius: 8px;
    padding: 1.25rem 1.4rem;
  }
  .model-label {
    font-family: system-ui, sans-serif;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.65rem;
  }
  .response-body {
    font-size: 0.97rem;
    line-height: 1.8;
    color: #1a1a1a;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .meta {
    font-family: system-ui, sans-serif;
    font-size: 0.72rem;
    color: #aaa;
    margin-top: 0.75rem;
  }
  footer {
    margin-top: 4rem;
    padding-top: 1.5rem;
    border-top: 1px solid #ddd;
    font-family: system-ui, sans-serif;
    font-size: 0.75rem;
    color: #999;
    text-align: center;
  }
  @media print {
    body { background: white; }
    .round { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page-wrap">
  <header>
    <h1>${esc(item.session.title)}</h1>
    <div class="meta-line">
      <span>${dateStr}</span>
      <span>${userPrompts.length} rounds</span>
      <span>${allChatbots.length} model${allChatbots.length !== 1 ? "s" : ""}</span>
      <span>Run ${item.run.id.slice(0, 8)}</span>
    </div>
    <div class="models-list">
      ${allChatbots.map(b => `<span class="model-badge" style="border-color:${modelColors[b.provider] ?? "#ddd"};color:${modelColors[b.provider] ?? "#333"}">${esc(b.displayName)}</span>`).join("")}
    </div>
  </header>
  ${systemPrompt ? `<div class="preface"><strong>Scenario Context</strong>${nl2br(systemPrompt.content)}</div>` : ""}
  ${roundSections}
  <footer>Generated by Cooperation Engine · ${dateStr}</footer>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.session.title.replace(/[^a-z0-9]+/gi, "_")}_story.html`;
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

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon className="h-4 w-4" />
                All Runs
                {total > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {total.toLocaleString()} total
                  </Badge>
                )}
              </CardTitle>

              {/* Search bar */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by session name..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                    className="pl-8 w-64"
                    data-testid="input-search-history"
                  />
                  {searchInput && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch} data-testid="button-search-history">
                  Search
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                <HistoryIcon className="h-12 w-12 mb-4 opacity-20" />
                {search ? (
                  <>
                    <p className="text-sm">No runs found for "{search}"</p>
                    <Button variant="link" size="sm" onClick={handleClearSearch} className="mt-1">
                      Clear search
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No runs yet</p>
                    <p className="text-xs mt-1">Start a new session to see runs here</p>
                  </>
                )}
              </div>
            ) : (
              <>
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
                          <div className="max-w-[220px]">
                            <p className="font-medium truncate">{item.session.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.session.prompts.length} prompt{item.session.prompts.length !== 1 ? "s" : ""}
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
                              onClick={() => exportAsStory(item)}
                              title="Publish story as HTML"
                              data-testid={`button-export-story-${item.run.id}`}
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
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

                {/* Pagination footer */}
                <div className="flex items-center justify-between pt-4 flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Showing {startItem}–{endItem} of {total.toLocaleString()} runs</span>
                    <span className="text-muted-foreground/40">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>Rows</span>
                      <Select value={String(limit)} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="h-7 w-16 text-xs" data-testid="select-page-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      data-testid="button-page-first"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="button-page-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-3 py-1 border rounded-md min-w-[90px] text-center">
                      Page {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      data-testid="button-page-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages}
                      data-testid="button-page-last"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
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
                    <Button variant="outline" size="sm" onClick={() => exportAsStory(selectedRun)} data-testid="button-export-story-dialog">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Publish Story
                    </Button>
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
