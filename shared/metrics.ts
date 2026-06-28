// HELM-style metric primitives (issue #20).
//
// Borrows two shapes from HELM (stanford-crfm/helm) without taking on its
// harness, so cross-eval comparison gets cheaper:
//
//   - MetricName: a *structured*, comparable key instead of a bare string, so
//     "cooperation_rate" under different conditions (model tier #17, category
//     #15, pre-prompt vs scenario baseline #18) is a distinct, comparable key
//     rather than a string you have to parse back apart.
//
//   - Stat: a metric stored as a *distribution*, never a single number. Re-run
//     N times, fold into one Stat, and stddev separates signal from sampling
//     noise — that is the statistical-delta idea from #12. Stats carry running
//     sum / sumSquared (HELM's statistic.py shape), so they aggregate online
//     and merge associatively rather than needing every raw value re-held.

/** A structured, comparable metric key. Mirrors HELM's metric_name.py. */
export type MetricName = {
  /** Base metric, e.g. "cooperation_rate". */
  name: string;
  /** Primary condition axis, e.g. "pre-prompt" | scenario id (#18 baseline). */
  split?: string;
  /** Secondary condition, e.g. category (#15). */
  subSplit?: string;
  /** Free context dimensions: model tier (#17), construct, game type, ... */
  context?: Record<string, string>;
};

/**
 * Canonical, stable string for a MetricName. The same structured key always
 * serializes identically — context entries are sorted by key — so comparing
 * metrics across runs/evals is a dictionary lookup, not string parsing.
 *
 * Format (readable, debuggable):
 *   name[|split][|sub][|k=v,k=v]
 * where context pairs are sorted and only present axes are emitted.
 */
export function metricKey(name: MetricName): string {
  const parts: string[] = [name.name];
  if (name.split !== undefined) parts.push(`split=${name.split}`);
  if (name.subSplit !== undefined) parts.push(`sub=${name.subSplit}`);
  if (name.context) {
    const ctx = Object.keys(name.context)
      .sort()
      .map((k) => `${k}=${name.context![k]}`)
      .join(",");
    if (ctx) parts.push(`ctx=${ctx}`);
  }
  return parts.join("|");
}

/**
 * A metric as a distribution. `mean` / `variance` / `stddev` are derived from
 * the running aggregates; `variance` is the population variance (divide by
 * count), matching HELM's statistic.py so values line up with their tooling.
 */
export type Stat = {
  name: MetricName;
  count: number;
  sum: number;
  sumSquared: number;
  min: number;
  max: number;
  mean: number;
  variance: number;
  stddev: number;
};

function derive(s: {
  name: MetricName;
  count: number;
  sum: number;
  sumSquared: number;
  min: number;
  max: number;
}): Stat {
  const mean = s.count > 0 ? s.sum / s.count : 0;
  // Population variance (HELM): E[x^2] - E[x]^2, floored at 0 against fp drift.
  const variance =
    s.count > 0 ? Math.max(0, s.sumSquared / s.count - mean * mean) : 0;
  return { ...s, mean, variance, stddev: Math.sqrt(variance) };
}

/** An empty Stat for `name`, ready to accumulate observations. */
export function emptyStat(name: MetricName): Stat {
  return derive({
    name,
    count: 0,
    sum: 0,
    sumSquared: 0,
    min: Infinity,
    max: -Infinity,
  });
}

/** Fold one observation into a Stat (returns a new Stat; input untouched). */
export function addToStat(stat: Stat, value: number): Stat {
  return derive({
    name: stat.name,
    count: stat.count + 1,
    sum: stat.sum + value,
    sumSquared: stat.sumSquared + value * value,
    min: Math.min(stat.min, value),
    max: Math.max(stat.max, value),
  });
}

/** Aggregate raw observations into one Stat keyed by `name`. */
export function aggregateStat(name: MetricName, values: number[]): Stat {
  return values.reduce<Stat>(addToStat, emptyStat(name));
}

/**
 * Merge two Stats into one. Associative: merging per-shard Stats equals
 * aggregating all raw values together. Caller is responsible for only merging
 * Stats with the same metricKey; the merged Stat keeps `a.name`.
 */
export function mergeStats(a: Stat, b: Stat): Stat {
  if (a.count === 0) return { ...b, name: a.name };
  if (b.count === 0) return a;
  return derive({
    name: a.name,
    count: a.count + b.count,
    sum: a.sum + b.sum,
    sumSquared: a.sumSquared + b.sumSquared,
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
  });
}

/**
 * Fold per-observation values into one Stat per MetricName. Observations that
 * serialize to the same `metricKey` (same metric under the same condition) are
 * aggregated together. This is the "many runs -> one Stat per (metric,
 * condition)" step from #12: until now the schema stored no metric as an
 * aggregate across runs, only recomputed it from `responses` each time.
 */
export function aggregateByMetric(
  observations: Array<{ name: MetricName; value: number }>,
): Map<string, Stat> {
  const out = new Map<string, Stat>();
  for (const { name, value } of observations) {
    const key = metricKey(name);
    out.set(key, addToStat(out.get(key) ?? emptyStat(name), value));
  }
  return out;
}

/**
 * Signed difference between two Stats of the same metric, with a gate that
 * separates a real shift from sampling noise (#12's "statistical delta").
 * `stderr` is the standard error of the difference of means; `z` is the change
 * in those units; `significant` is true only when |z| clears `threshold`
 * (default 2, ~95%). Comparing a metric before/after a change (pre-prompt vs
 * scenario #18, tier A vs tier B #17) reduces to one call.
 */
export type StatDelta = {
  meanDelta: number; // b.mean - a.mean
  stderr: number;    // standard error of the difference of means
  z: number;         // meanDelta / stderr (0 when there is no spread)
  significant: boolean;
};

export function statDelta(a: Stat, b: Stat, threshold = 2): StatDelta {
  const meanDelta = b.mean - a.mean;
  // SE of the difference of two independent sample means: sqrt(varA/nA + varB/nB).
  const seA = a.count > 0 ? a.variance / a.count : 0;
  const seB = b.count > 0 ? b.variance / b.count : 0;
  const stderr = Math.sqrt(seA + seB);
  // stderr 0 means both groups are perfectly tight: any real mean gap is
  // infinitely separated from noise; an equal gap of 0 is just no change.
  const z =
    stderr > 0
      ? meanDelta / stderr
      : meanDelta === 0
        ? 0
        : meanDelta > 0
          ? Infinity
          : -Infinity;
  return { meanDelta, stderr, z, significant: Math.abs(z) >= threshold };
}
