import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Zap, CheckCircle2, Loader2 } from "lucide-react";

// Public, open submission page — no login, no invite token.
// Anyone can send a link (or paste text) to their work; it enters the benchmarking pipeline.
export default function SubmitPage() {
  const [link, setLink] = useState("");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!link.trim() && !content.trim()) {
      setError("Please add a link or paste your contribution.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link, content, title, name, email, affiliation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg" data-testid="card-submitted">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Received</CardTitle>
            <CardDescription>
              Thank you — your contribution has been received and is queued for review.
              We read it, extract the text, and evaluate it for the benchmark.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle>Contribute to the Cooperation Benchmark</CardTitle>
          </div>
          <CardDescription>
            Send a link to your work — a paper, page, dataset, or writeup — or paste it directly.
            It goes straight into our benchmarking pipeline. No account needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="link">Link</Label>
              <Input
                id="link"
                type="url"
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                data-testid="input-link"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content">…or paste it here</Label>
              <Textarea
                id="content"
                rows={5}
                placeholder="Paste your abstract, dataset description, or the contribution itself."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                data-testid="input-content"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="title"
                placeholder="A short title for your contribution"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affiliation">Affiliation <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="affiliation" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} data-testid="input-affiliation" />
            </div>

            {error && <p className="text-sm text-destructive" data-testid="text-error">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit">
              {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>) : "Send contribution"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
