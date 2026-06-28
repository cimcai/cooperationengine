import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type MetricName,
  metricKey,
  emptyStat,
  addToStat,
  aggregateStat,
  mergeStats,
} from "./metrics.ts";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

test("metricKey is stable regardless of context insertion order", () => {
  const a: MetricName = {
    name: "cooperation_rate",
    split: "pre-prompt",
    context: { tier: "frontier", category: "deception" },
  };
  const b: MetricName = {
    name: "cooperation_rate",
    split: "pre-prompt",
    context: { category: "deception", tier: "frontier" },
  };
  assert.equal(metricKey(a), metricKey(b));
  assert.equal(
    metricKey(a),
    "cooperation_rate|split=pre-prompt|ctx=category=deception,tier=frontier",
  );
});

test("metricKey emits only the axes that are present", () => {
  assert.equal(metricKey({ name: "coop" }), "coop");
  assert.equal(metricKey({ name: "coop", subSplit: "x" }), "coop|sub=x");
});

test("distinct conditions produce distinct keys", () => {
  const base: MetricName = { name: "coop", context: { tier: "frontier" } };
  const other: MetricName = { name: "coop", context: { tier: "small" } };
  assert.notEqual(metricKey(base), metricKey(other));
});

test("aggregateStat computes the distribution (population stddev, HELM)", () => {
  const name: MetricName = { name: "cooperation_rate" };
  const s = aggregateStat(name, [0, 1, 1, 0, 1]);
  assert.equal(s.count, 5);
  assert.equal(s.sum, 3);
  assert.equal(s.min, 0);
  assert.equal(s.max, 1);
  near(s.mean, 0.6);
  near(s.variance, 0.24); // 3/5 - 0.6^2
  near(s.stddev, Math.sqrt(0.24));
});

test("emptyStat is safe (no NaN on zero observations)", () => {
  const s = emptyStat({ name: "coop" });
  assert.equal(s.count, 0);
  assert.equal(s.mean, 0);
  assert.equal(s.variance, 0);
  assert.equal(s.stddev, 0);
});

test("addToStat does not mutate its input", () => {
  const a = aggregateStat({ name: "coop" }, [1, 1]);
  const before = { ...a };
  addToStat(a, 0);
  assert.deepEqual(a, before);
});

test("mergeStats is associative with full aggregation", () => {
  const name: MetricName = { name: "coop" };
  const left = aggregateStat(name, [0, 1, 1]);
  const right = aggregateStat(name, [0, 1]);
  const merged = mergeStats(left, right);
  const whole = aggregateStat(name, [0, 1, 1, 0, 1]);
  near(merged.mean, whole.mean);
  near(merged.variance, whole.variance);
  assert.equal(merged.count, whole.count);
  assert.equal(merged.sum, whole.sum);
});

test("merging an empty Stat is a no-op", () => {
  const name: MetricName = { name: "coop" };
  const s = aggregateStat(name, [1, 0, 1]);
  assert.deepEqual(mergeStats(emptyStat(name), s), { ...s, name });
  assert.deepEqual(mergeStats(s, emptyStat(name)), s);
});
