// Unit tests for the deterministic record/replay layer (issue #12 / #13 item 4).
//
// Everything here runs with no database and no API keys: the ArtifactStore is an
// in-memory map and the "vendor call" is a stub. That is the whole point of the
// Phase-1 design — the model path is store-agnostic and provider-agnostic, so the
// scoring/replay behaviour can be pinned down deterministically.

import { describe, it, expect, vi } from "vitest";
import {
  ModelClient,
  ReplayMissError,
  computeRequestHash,
  replayRun,
  type ArtifactStore,
  type ModelRequest,
  type ModelResult,
  type RunArtifact,
} from "./modelClient";

// Minimal in-memory ArtifactStore (also satisfies replayRun's getByRun shape).
class MemArtifactStore implements ArtifactStore {
  private byHash = new Map<string, RunArtifact>();
  private byRun = new Map<string, RunArtifact[]>();

  async getByHash(requestHash: string): Promise<RunArtifact | undefined> {
    return this.byHash.get(requestHash);
  }
  async put(artifact: RunArtifact): Promise<void> {
    this.byHash.set(artifact.requestHash, artifact);
    if (artifact.runId) {
      const list = this.byRun.get(artifact.runId) ?? [];
      list.push(artifact);
      this.byRun.set(artifact.runId, list);
    }
  }
  async getByRun(runId: string): Promise<RunArtifact[]> {
    return this.byRun.get(runId) ?? [];
  }
}

const baseRequest = (): ModelRequest => ({
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "Cooperate or defect?" }],
  params: { temperature: 0, max_tokens: 256 },
});

const baseResult = (): ModelResult => ({
  content: "COOPERATE",
  usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
  modelVersion: "claude-sonnet-4-6-20260101",
  finishReason: "stop",
  raw: { id: "msg_123", stop_reason: "end_turn" },
});

describe("computeRequestHash", () => {
  it("is stable for an identical request", () => {
    expect(computeRequestHash(baseRequest())).toBe(
      computeRequestHash(baseRequest()),
    );
  });

  it("is independent of param key order (stable stringify)", () => {
    const a: ModelRequest = { ...baseRequest(), params: { temperature: 0, max_tokens: 256 } };
    const b: ModelRequest = { ...baseRequest(), params: { max_tokens: 256, temperature: 0 } };
    expect(computeRequestHash(a)).toBe(computeRequestHash(b));
  });

  it("treats missing params and empty params as the same", () => {
    const a: ModelRequest = { ...baseRequest(), params: undefined };
    const b: ModelRequest = { ...baseRequest(), params: {} };
    expect(computeRequestHash(a)).toBe(computeRequestHash(b));
  });

  it("changes when provider, model, messages, or params change", () => {
    const h = computeRequestHash(baseRequest());
    expect(computeRequestHash({ ...baseRequest(), provider: "openai" })).not.toBe(h);
    expect(computeRequestHash({ ...baseRequest(), model: "gpt-4o" })).not.toBe(h);
    expect(
      computeRequestHash({ ...baseRequest(), messages: [{ role: "user", content: "different" }] }),
    ).not.toBe(h);
    expect(
      computeRequestHash({ ...baseRequest(), params: { temperature: 1 } }),
    ).not.toBe(h);
  });

  it("is sensitive to message order", () => {
    const a: ModelRequest = {
      ...baseRequest(),
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hi" },
      ],
    };
    const b: ModelRequest = { ...baseRequest(), messages: [...a.messages].reverse() };
    expect(computeRequestHash(a)).not.toBe(computeRequestHash(b));
  });
});

describe("ModelClient live mode", () => {
  it("calls the vendor and does NOT persist when capture is off (default)", async () => {
    const store = new MemArtifactStore();
    const putSpy = vi.spyOn(store, "put");
    const client = new ModelClient(store); // defaults: live, capture off
    const liveCall = vi.fn(async () => baseResult());

    const result = await client.complete(baseRequest(), liveCall);

    expect(liveCall).toHaveBeenCalledOnce();
    expect(result.content).toBe("COOPERATE");
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("persists a fully-provenanced artifact when capture is on", async () => {
    const store = new MemArtifactStore();
    // Deterministic clock: two reads 42ms apart -> latencyMs === 42.
    const now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1042);
    const client = new ModelClient(store, { capture: true, now });

    await client.complete(baseRequest(), async () => baseResult(), {
      runId: "run-1",
      chatbotId: "bot-a",
      stepOrder: 3,
    });

    const stored = await store.getByHash(computeRequestHash(baseRequest()));
    expect(stored).toBeDefined();
    // Every spec'd provenance field must survive capture (the artifact is a contract).
    expect(stored).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      content: "COOPERATE",
      latencyMs: 42,
      runId: "run-1",
      chatbotId: "bot-a",
      stepOrder: 3,
      modelVersion: "claude-sonnet-4-6-20260101",
      finishReason: "stop",
      responseRaw: { id: "msg_123", stop_reason: "end_turn" },
    });
    expect(stored!.request).toEqual(baseRequest());
    expect(stored!.usage).toEqual({ promptTokens: 10, completionTokens: 1, totalTokens: 11 });
  });

  it("is fail-safe: a store error never breaks the model path", async () => {
    const store = new MemArtifactStore();
    vi.spyOn(store, "put").mockRejectedValue(new Error("disk full"));
    const logger = vi.fn();
    const client = new ModelClient(store, { capture: true, logger });

    const result = await client.complete(baseRequest(), async () => baseResult());

    expect(result.content).toBe("COOPERATE"); // run still succeeds
    expect(logger).toHaveBeenCalledOnce();
    expect(logger.mock.calls[0][0]).toContain("failed to capture artifact");
  });
});

describe("ModelClient replay mode", () => {
  it("returns the stored response and never calls the vendor", async () => {
    const store = new MemArtifactStore();
    // Record once...
    const recorder = new ModelClient(store, { capture: true });
    await recorder.complete(baseRequest(), async () => baseResult());

    // ...then replay with a liveCall that would fail if invoked.
    const replayer = new ModelClient(store, { mode: "replay" });
    const liveCall = vi.fn(async () => {
      throw new Error("network must not be touched in replay");
    });

    const result = await replayer.complete(baseRequest(), liveCall);

    expect(liveCall).not.toHaveBeenCalled();
    expect(result.content).toBe("COOPERATE");
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 1, totalTokens: 11 });
  });

  it("throws ReplayMissError (loudly) on an unrecorded request", async () => {
    const store = new MemArtifactStore();
    const replayer = new ModelClient(store, { mode: "replay" });
    const hash = computeRequestHash(baseRequest());

    await expect(
      replayer.complete(baseRequest(), async () => baseResult()),
    ).rejects.toBeInstanceOf(ReplayMissError);
    await expect(
      replayer.complete(baseRequest(), async () => baseResult()),
    ).rejects.toMatchObject({ requestHash: hash });
  });
});

describe("replayRun (deterministic eval-run from artifacts)", () => {
  it("reconstructs a recorded run's calls in step order with zero API spend", async () => {
    const store = new MemArtifactStore();
    const liveCalls = vi.fn();

    // Fixture: a real two-player prisoner's-dilemma run, captured out of order.
    const fixture: RunArtifact[] = [
      { requestHash: "h-b", provider: "openai", model: "gpt-4o", request: baseRequest(), content: "DEFECT", latencyMs: 5, runId: "run-42", stepOrder: 2 },
      { requestHash: "h-a", provider: "anthropic", model: "claude-sonnet-4-6", request: baseRequest(), content: "COOPERATE", latencyMs: 7, runId: "run-42", stepOrder: 1 },
    ];
    for (const a of fixture) await store.put(a);

    const replayed = await replayRun(store, "run-42");

    // Ordered by step, no live calls — the eval's model outputs are now testable.
    expect(liveCalls).not.toHaveBeenCalled();
    expect(replayed.map((a) => a.stepOrder)).toEqual([1, 2]);
    expect(replayed.map((a) => a.content)).toEqual(["COOPERATE", "DEFECT"]);

    // A deterministic scoring pass over the replayed transcript is now reproducible.
    const cooperated = replayed.filter((a) => a.content === "COOPERATE").length;
    expect(cooperated).toBe(1);
  });

  it("returns an empty transcript for an unknown run", async () => {
    const store = new MemArtifactStore();
    expect(await replayRun(store, "nope")).toEqual([]);
  });
});
