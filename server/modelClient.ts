// ModelClient — deterministic record/replay layer for vendor LLM calls.
//
// Phase 1 of the run-level integration spec (issue #12). The goal is to make
// model calls reproducible without re-spending API budget: every live call is
// captured as a content-addressable artifact (keyed by a hash of the exact
// request), and a later "replay" run looks the response up by that hash instead
// of hitting the network. This is what lets evals be re-parsed / re-scored
// deterministically, and it separates code/scoring changes (deterministic) from
// model sampling noise (the statistical-delta layer, Phase 2).
//
// Design notes:
//   - This module is intentionally store-agnostic and provider-agnostic: the
//     artifact store and the actual vendor call are both injected. That keeps
//     the core pure and unit-testable with no DB and no API keys.
//   - Default behavior is a no-op wrapper: with no env flags set the client runs
//     in `live` mode with capture OFF, so existing runs are byte-for-byte
//     unchanged (only an extra, cheap hash computation is added).
//   - Capture is fail-safe: a store error is logged but never thrown into the
//     model path, so a recording failure can never break a production run.

import { createHash } from "crypto";

export type ModelClientMode = "live" | "replay";

// A single, normalized chat message as the wrappers already pass them around.
export interface ModelMessage {
  role: string;
  content: string;
}

// The exact, hashable description of a model request. Anything that can change
// the model's output should live here so it participates in the request hash.
export interface ModelRequest {
  provider: string;
  model: string;
  messages: ModelMessage[];
  // Sampling / decoding params (max_tokens, temperature, ...). Optional so that
  // wrappers which set nothing still hash to a stable value.
  params?: Record<string, unknown>;
}

// Token usage, mirrored from shared/schema's TokenUsage to avoid a cross-import
// cycle (server -> shared -> server). Structurally identical.
export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// What a vendor wrapper returns and what we replay. The optional fields are
// provenance captured into the artifact (issue #12): the resolved model
// snapshot, the finish reason, and the unparsed provider payload.
export interface ModelResult {
  content: string;
  usage?: ModelUsage;
  modelVersion?: string;
  finishReason?: string;
  raw?: unknown;
}

// Optional run context. When present, the captured artifact is linked to a run
// (and ordered within it), which is what makes replayRun(runId) possible.
export interface ModelCallContext {
  runId?: string;
  chatbotId?: string;
  stepOrder?: number;
}

// A persisted record of one model call.
export interface RunArtifact {
  requestHash: string;
  provider: string;
  model: string;
  request: ModelRequest;
  content: string;
  usage?: ModelUsage;
  latencyMs: number;
  runId?: string;
  chatbotId?: string;
  stepOrder?: number;
  modelVersion?: string;
  finishReason?: string;
  responseRaw?: unknown;
}

// The minimal persistence contract the client needs. Implemented by the DB in
// storage.ts; implemented in-memory by the unit tests.
export interface ArtifactStore {
  getByHash(requestHash: string): Promise<RunArtifact | undefined>;
  put(artifact: RunArtifact): Promise<void>;
}

// Stable JSON: object keys are emitted in sorted order at every depth so that
// two semantically-equal requests serialize identically. Array order is
// preserved (message order is significant).
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

// Content-addressable key for a request. Same provider+model+messages+params
// => same hash => replayable. Changing any of them yields a different hash.
export function computeRequestHash(request: ModelRequest): string {
  const canonical = stableStringify({
    provider: request.provider,
    model: request.model,
    messages: request.messages,
    params: request.params ?? {},
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface ModelClientOptions {
  mode?: ModelClientMode;
  capture?: boolean;
  // Injected so tests can assert timing without a real clock; defaults to
  // Date.now in production.
  now?: () => number;
  // Sink for non-fatal capture/replay warnings; defaults to console.warn.
  logger?: (message: string) => void;
}

export class ReplayMissError extends Error {
  constructor(public requestHash: string) {
    super(`No artifact found for request hash ${requestHash} (replay mode)`);
    this.name = "ReplayMissError";
  }
}

export class ModelClient {
  private readonly mode: ModelClientMode;
  private readonly capture: boolean;
  private readonly now: () => number;
  private readonly logger: (message: string) => void;

  constructor(
    private readonly store: ArtifactStore,
    options: ModelClientOptions = {},
  ) {
    this.mode = options.mode ?? "live";
    this.capture = options.capture ?? false;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? ((m) => console.warn(m));
  }

  // Run a model request. In `live` mode it calls `liveCall` (the real vendor
  // request) and, if capture is on, persists the artifact. In `replay` mode it
  // returns the stored response for this request hash and never calls the
  // network; a miss throws ReplayMissError so incomplete recordings surface
  // loudly rather than silently falling back to a paid call.
  async complete(
    request: ModelRequest,
    liveCall: () => Promise<ModelResult>,
    ctx: ModelCallContext = {},
  ): Promise<ModelResult> {
    const requestHash = computeRequestHash(request);

    if (this.mode === "replay") {
      const existing = await this.store.getByHash(requestHash);
      if (!existing) throw new ReplayMissError(requestHash);
      return { content: existing.content, usage: existing.usage };
    }

    const startedAt = this.now();
    const result = await liveCall();
    const latencyMs = this.now() - startedAt;

    if (this.capture) {
      const artifact: RunArtifact = {
        requestHash,
        provider: request.provider,
        model: request.model,
        request,
        content: result.content,
        usage: result.usage,
        latencyMs,
        runId: ctx.runId,
        chatbotId: ctx.chatbotId,
        stepOrder: ctx.stepOrder,
        modelVersion: result.modelVersion,
        finishReason: result.finishReason,
        responseRaw: result.raw,
      };
      // Fail-safe: a capture error must never break the model path.
      try {
        await this.store.put(artifact);
      } catch (err) {
        this.logger(
          `[modelClient] failed to capture artifact ${requestHash}: ${String(err)}`,
        );
      }
    }

    return result;
  }
}

// Deterministically reconstruct the model calls of a prior run from its
// captured artifacts, ordered by step. This is the foundation the spec calls
// "re-parse / re-score from artifacts": it returns the exact recorded model
// outputs with zero API spend. Full re-scoring through the orchestration is
// Phase 2; this provides the deterministic record it will build on.
export async function replayRun(
  store: { getByRun(runId: string): Promise<RunArtifact[]> },
  runId: string,
): Promise<RunArtifact[]> {
  const artifacts = await store.getByRun(runId);
  return [...artifacts].sort(
    (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0),
  );
}
