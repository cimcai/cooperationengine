import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Zap, CheckCircle2, Loader2 } from "lucide-react";

interface ContributorInfo {
  name: string | null;
  affiliation: string | null;
  alreadySubmitted: boolean;
  submissionTitle: string | null;
  submissionContent: string | null;
  submissionLink: string | null;
}

export default function ContributePage() {
  const [location] = useLocation();
  const token = location.split("/contribute/")[1]?.split(/[?#]/)[0] ?? "";

  const [info, setInfo] = useState<ContributorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/academics/submit/${token}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok) { setError(data.error ?? "This link is not valid."); return; }
        setInfo(data);
        if (data.alreadySubmitted) {
          setTitle(data.submissionTitle ?? "");
          setContent(data.submissionContent ?? "");
          setLink(data.submissionLink ?? "");
        }
      } catch {
        if (active) setError("Something went wrong loading this page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async () => {
    setFormError(null);
    if (!title.trim()) { setFormError("Please add a short title."); return; }
    if (!content.trim() && !link.trim()) { setFormError("Please add either a description or a link (e.g. a Google Doc)."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/academics/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), link: link.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to submit."); return; }
      setSubmitted(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Cooperation Benchmark</span>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Link not valid</CardTitle>
              <CardDescription data-testid="text-contribute-error">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : submitted ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold" data-testid="text-contribute-success">Thank you!</h2>
              <p className="text-muted-foreground">Your contribution has been received and will be included in the internal report for evaluation.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{info?.name ? `Hi ${info.name},` : "Share your contribution"}</CardTitle>
              <CardDescription>
                {info?.alreadySubmitted
                  ? "You've already submitted. You can update your contribution below."
                  : "If you've made progress on a scenario, dilemma, dataset, critique, or any idea worth evaluating, share it below. Even a few sentences help."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contribute-title">Title</Label>
                <Input
                  id="contribute-title"
                  placeholder="A short name for your contribution"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  data-testid="input-contribute-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contribute-content">Your contribution</Label>
                <Textarea
                  id="contribute-content"
                  placeholder="Describe your scenario, dilemma, dataset, critique, or idea. Paste the full text if you have it — or just share a link below."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={10}
                  data-testid="input-contribute-content"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contribute-link">Link</Label>
                <Input
                  id="contribute-link"
                  placeholder="https://… a Google Doc, paper, dataset, or other link"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  data-testid="input-contribute-link"
                />
                <p className="text-xs text-muted-foreground">You can paste text above, share a link, or both. A link on its own is fine.</p>
              </div>
              {formError && <p className="text-sm text-destructive" data-testid="text-contribute-form-error">{formError}</p>}
              <Button onClick={handleSubmit} disabled={submitting} className="w-full" data-testid="button-contribute-submit">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : info?.alreadySubmitted ? "Update my contribution" : "Submit my contribution"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
