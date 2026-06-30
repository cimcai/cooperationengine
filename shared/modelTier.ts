// Model capability tiers (issue #17).
//
// Most runs so far used only frontier models, where everyone cooperates and
// the interesting variance hides below the frontier. Tagging each run with a
// coarse tier lets the leaderboard show *where* cooperation breaks down.
//
// Tiers are a heuristic on the model id plus an `overrides` escape hatch — they
// only need to be coarse and consistent, not authoritative. Composes with the
// metric primitives (#20): use `tier` as MetricName.context.tier, and statDelta
// (#12) to test whether a drop between tiers is signal or sampling noise.

import { type Stat, emptyStat, addToStat } from "./metrics.ts";

export type ModelTier = "frontier" | "mid" | "small" | "unknown";

export const TIER_ORDER: ModelTier[] = ["small", "mid", "frontier"];

// Small/cheap variants — checked first so "gpt-5-mini" lands in `small`, not
// `frontier`. Word boundaries keep "mini" from matching inside "gemini"; the
// size clause matches 1b–13b but not 70b/405b.
const SMALL =
  /\b(?:mini|flash|lite|nano|tiny|haiku|small)\b|\b[1-9]b\b|\b1[0-3]b\b/i;

// Flagship/frontier families.
const FRONTIER =
  /gpt-5|\bo[1-9]\b|\bopus\b|gemini-[0-9.]*-(?:ultra|pro)|grok-[3-9]|deepseek-(?:v[3-9]|r[1-9])|\b405b\b/i;

/** Classify a model id into a coarse capability tier (heuristic + overrides). */
export function modelTier(
  modelId: string,
  overrides: Record<string, ModelTier> = {},
): ModelTier {
  if (modelId in overrides) return overrides[modelId];
  if (!modelId) return "unknown";
  const id = modelId.toLowerCase();
  if (SMALL.test(id)) return "small";
  if (FRONTIER.test(id)) return "frontier";
  return "mid";
}

/**
 * Bucket per-model metric observations into one Stat per tier, so a single
 * metric (e.g. cooperation rate) can be read across capability tiers and show
 * where it breaks down below the frontier (#17). Pair adjacent tiers with
 * statDelta (#12) to separate a real drop from sampling noise.
 */
export function statsByTier(
  observations: Array<{ model: string; value: number }>,
  overrides?: Record<string, ModelTier>,
): Map<ModelTier, Stat> {
  const out = new Map<ModelTier, Stat>();
  for (const { model, value } of observations) {
    const tier = modelTier(model, overrides);
    const cur =
      out.get(tier) ?? emptyStat({ name: "by_tier", context: { tier } });
    out.set(tier, addToStat(cur, value));
  }
  return out;
}
