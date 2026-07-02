// Parsing of the contribution-evaluator model output.
// Extracted from routes.ts so the parse path (Issue #22) is unit-testable and
// so a parse *failure* is visible (parseOk) rather than silently scored as 1.

export function stripJsonFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export interface ParsedEvaluation {
  score: number;      // clamped integer 1..10 (defaults to 1 on failure, preserving prior behavior)
  summary: string;
  parseOk: boolean;   // true only when the model returned a JSON object with a usable numeric score
}

/**
 * Parse the evaluator model's raw content into { score, summary, parseOk }.
 * Behaviour is intentionally identical to the previous inline logic for score/summary,
 * with one addition: `parseOk` distinguishes a real parse failure (bad/prose/string-score
 * output → defaulted to 1) from a genuine model score of 1.
 */
export function parseEvaluation(rawContent: string): ParsedEvaluation {
  const raw = rawContent ?? "";
  let parsed: any = null;
  try { parsed = JSON.parse(stripJsonFence(raw)); } catch { parsed = null; }

  const scoreVal = parsed && typeof parsed === "object" ? parsed.score : undefined;
  const scoreIsNumber = typeof scoreVal === "number" && Number.isFinite(scoreVal);
  const parseOk = !!parsed && typeof parsed === "object" && scoreIsNumber;

  let score = scoreIsNumber ? Math.round(scoreVal) : 1; // preserve default-to-1 on failure
  score = Math.max(1, Math.min(10, score));

  const summary = parsed && parsed.summary != null && parsed.summary !== ""
    ? String(parsed.summary)
    : (raw || "No summary produced.").slice(0, 2000);

  return { score, summary, parseOk };
}
