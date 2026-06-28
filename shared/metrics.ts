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
