import { test } from "node:test";
import assert from "node:assert/strict";
import { modelTier, statsByTier, type ModelTier } from "./modelTier.ts";

test("modelTier classifies frontier flagships", () => {
  for (const id of [
    "openai/gpt-5",
    "openai/o3",
    "anthropic/claude-opus-4.8",
    "google/gemini-3.1-pro",
    "deepseek/deepseek-r1",
    "meta/llama-3.1-405b",
  ]) {
    assert.equal(modelTier(id), "frontier", id);
  }
});

test("modelTier classifies small/cheap variants (size or suffix)", () => {
  for (const id of [
    "openai/gpt-5-mini",
    "google/gemini-3.5-flash",
    "anthropic/claude-haiku-4.5",
    "qwen/qwen-2.5-7b",
    "some/model-lite",
  ]) {
    assert.equal(modelTier(id), "small", id);
  }
});

test("modelTier falls back to mid, and unknown for empty", () => {
  assert.equal(modelTier("mistralai/mistral-large-2512"), "mid");
  assert.equal(modelTier("anthropic/claude-sonnet-4.6"), "mid");
  assert.equal(modelTier(""), "unknown");
});

test("overrides win over the heuristic", () => {
  assert.equal(modelTier("openai/gpt-5", { "openai/gpt-5": "mid" }), "mid");
  assert.equal(
    modelTier("house/custom", { "house/custom": "frontier" }),
    "frontier",
  );
});

test("statsByTier shows cooperation dropping below the frontier", () => {
  const obs = [
    { model: "anthropic/claude-opus-4.8", value: 1 }, // frontier
    { model: "openai/gpt-5", value: 1 }, // frontier
    { model: "mistralai/mistral-large", value: 1 }, // mid
    { model: "mistralai/mistral-large", value: 0 }, // mid
    { model: "openai/gpt-5-mini", value: 0 }, // small
    { model: "anthropic/claude-haiku-4.5", value: 0 }, // small
  ];
  const byTier = statsByTier(obs);
  assert.equal(byTier.get("frontier")!.mean, 1);
  assert.equal(byTier.get("mid")!.mean, 0.5);
  assert.equal(byTier.get("small")!.mean, 0);
  assert.equal(byTier.get("frontier")!.count, 2);
});

test("statsByTier respects overrides", () => {
  const ov: Record<string, ModelTier> = { "x/y": "small" };
  const byTier = statsByTier([{ model: "x/y", value: 0 }], ov);
  assert.equal(byTier.get("small")!.count, 1);
  assert.equal(byTier.has("mid"), false);
});
