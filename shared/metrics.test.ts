import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type MetricName,
  metricKey,
  emptyStat,
  addToStat,
  aggregateStat,
  mergeStats,
  aggregateByMetric,
  statDelta,
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

test("aggregateByMetric folds observations into one Stat per key", () => {
  const frontier: MetricName = { name: "coop", context: { tier: "frontier" } };
  const small: MetricName = { name: "coop", context: { tier: "small" } };
  const m = aggregateByMetric([
    { name: frontier, value: 1 },
    { name: frontier, value: 0 },
    { name: small, value: 1 },
  ]);
  assert.equal(m.size, 2);
  const f = m.get(metricKey(frontier))!;
  assert.equal(f.count, 2);
  near(f.mean, 0.5);
  assert.equal(m.get(metricKey(small))!.count, 1);
});

test("aggregateByMetric keys by condition, not insertion order", () => {
  const a: MetricName = { name: "coop", context: { tier: "x", cat: "y" } };
  const b: MetricName = { name: "coop", context: { cat: "y", tier: "x" } };
  const m = aggregateByMetric([
    { name: a, value: 1 },
    { name: b, value: 0 },
  ]);
  assert.equal(m.size, 1); // same key despite different context order
  assert.equal(m.get(metricKey(a))!.count, 2);
});

test("statDelta flags a real shift as significant", () => {
  const n: MetricName = { name: "coop" };
  const a = aggregateStat(n, [0, 0, 0, 0, 0, 0, 0, 1, 0, 0]); // mean 0.1
  const b = aggregateStat(n, [1, 1, 1, 1, 1, 1, 1, 0, 1, 1]); // mean 0.9
  const d = statDelta(a, b);
  near(d.meanDelta, 0.8);
  assert.ok(d.z > 2 && d.significant);
});

test("statDelta treats overlapping distributions as noise", () => {
  const n: MetricName = { name: "coop" };
  const a = aggregateStat(n, [0, 1, 0, 1, 0]); // mean 0.4
  const b = aggregateStat(n, [0, 1, 1, 0, 1]); // mean 0.6
  const d = statDelta(a, b);
  assert.equal(d.significant, false);
});

test("statDelta: perfect separation is infinitely significant", () => {
  const n: MetricName = { name: "coop" };
  const d = statDelta(aggregateStat(n, [0, 0, 0]), aggregateStat(n, [1, 1, 1]));
  assert.equal(d.stderr, 0);
  assert.equal(d.z, Infinity);
  assert.ok(d.significant);
});

test("statDelta: no change is not significant", () => {
  const n: MetricName = { name: "coop" };
  const s = aggregateStat(n, [0, 1, 0, 1]);
  const d = statDelta(s, s);
  assert.equal(d.meanDelta, 0);
  assert.equal(d.z, 0);
  assert.equal(d.significant, false);
});
