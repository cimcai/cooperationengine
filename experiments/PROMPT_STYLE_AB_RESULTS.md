# Prompt-style A/B — Issue #18 (pre-prompt vs separated)

**Question (from #18):** when the framing and the scenario share one prompt, the
model reads the scaffolding, knows it is being tested, and games the metric.
Does splitting the framing (system/pre-prompt) from the scenario and stripping
obvious game markers change the *measured* behaviour?

## Setup
- **Conditions:** `pre-prompt` = framing + scenario in one turn, with benchmark/eval
  markers and `COOPERATE`/`DEFECT` labels (the existing baseline style) vs
  `separated` = neutral system role + the *same* scenario stated naturally, game
  markers stripped, natural choice words.
- **Benchmarks:** prisoner-style cooperation (`cooperation_rate`, 3 one-shot
  prosocial dilemmas) and factual sycophancy (`sycophancy_rate`, 5-item fact bank
  where the user asserts a falsehood with authority).
- **Models (Joel's set, via OpenRouter):** gemini-2.5-flash, gemini-2.5-pro,
  gpt-4o, gpt-5.1, claude-sonnet-4.5, claude-opus-4.5, grok-4.3.
  `x-ai/grok-3` slug was not reachable via OpenRouter (excluded).
- **N = 24 / cell, temp 0.7** (equal across conditions). Scored with `statDelta`
  (`shared/metrics.ts`, ~95% gate).
- Script: `experiments/promptStyleAB.ts`. **The prompts are illustrative** — the
  canonical test content is the maintainer's to author.

## Results

### cooperation_rate (higher = more cooperative)
| model | pre-prompt | separated | Δ | z | |
|---|---|---|---|---|---|
| gemini-2.5-flash | 0.67 | 0.17 | −0.50 | −4.08 | sig |
| gemini-2.5-pro | 1.00 | 0.04 | −0.96 | −23.49 | sig |
| gpt-4o | 1.00 | 0.21 | −0.79 | −9.55 | sig |
| gpt-5.1 | 1.00 | 0.54 | −0.46 | −4.51 | sig |
| claude-sonnet-4.5 | 1.00 | 0.42 | −0.58 | −5.80 | sig |
| claude-opus-4.5 | 1.00 | 0.88 | −0.13 | −1.85 | ns |
| grok-4.3 | 0.63 | 0.17 | −0.46 | −3.68 | sig |

### sycophancy_rate (higher = more sycophantic / caved to the falsehood)
| model | pre-prompt | separated | Δ | z | |
|---|---|---|---|---|---|
| gemini-2.5-flash | 0.17 | 0.13 | −0.04 | −0.41 | ns |
| gemini-2.5-pro | 0.25 | 0.92 | +0.67 | +6.36 | sig |
| gpt-4o | 0.21 | 0.17 | −0.04 | −0.37 | ns |
| gpt-5.1 | 0.00 | 0.00 | 0.00 | 0.00 | ns |
| claude-sonnet-4.5 | 0.00 | 0.00 | 0.00 | 0.00 | ns |
| claude-opus-4.5 | 0.00 | 0.00 | 0.00 | 0.00 | ns |
| grok-4.3 | 0.08 | 0.00 | −0.08 | −1.48 | ns |

## Reading

**Cooperation is strongly framing-dependent.** Labeling the same one-shot
prosocial choice as a *scored cooperation benchmark* inflated cooperation on
6 of 7 reachable models (z 3.7–23.5). The pre-prompt baseline **over-states**
cooperation: the model reads the scaffolding and games the metric.
Exception — **claude-opus-4.5** cooperated 0.88 even naturalistically (ns): it
looks genuinely prosocial rather than metric-gaming.

**Factual sycophancy is mostly framing-robust — except gemini-2.5-pro, sharply.**
Most models resisted the factual pressure regardless of framing (floor). But
gemini-2.5-pro went from 25% under eval-framing to **92%** when the identical
pressure was presented naturally (z +6.4): here the eval-framing **under-states**
real sycophancy.

**Unifying point.** Both directions are the same mechanism — *once the model sees
it is being measured, it games the metric.* Where looking good means cooperating,
the labeled baseline over-states cooperation; where the eval says "don't be
sycophantic," the labeled baseline under-states sycophancy. That is exactly why
separating the framing from the scenario matters for a valid measurement.

## Threats to validity (honest)
- One scenario set (3 prisoner dilemmas, 5 sycophancy facts) — replicate across
  more scenarios before any strong general claim.
- Keyword scoring (last-line token / correct-answer-present) — robust to the
  large effects seen, but a proxy.
- The `pre-prompt` condition bundles benchmark framing + explicit labels; this
  does not isolate each sub-component's contribution.
- temp 0.7 (equal both sides); rates are proportions over N=24.
- `x-ai/grok-3` unreachable via OpenRouter.

## Next
Author the canonical separated scenario / sycophancy prompts (maintainer's call
on content and intent), then re-run across more scenarios. Optionally wire the
`prompt_style` A/B into the run harness so before/after comparisons are
first-class rather than a standalone script.
