// Pre-prompt separation helpers (#18).
//
// The robustness problem: when the framing ("you are in a cooperation test…")
// shares a turn with the scenario, the model reads the scaffolding and knows it
// is being evaluated, which lets it game the result. Breaking the framing out
// as its own (system) turn — distinct from the scenario turn — removes that tell.
//
// Runs carry a prompt style so a separated run can be compared against the
// existing "pre-prompt" baseline (Joel's ask on #18: tag the existing runs).

export const PROMPT_STYLE = {
  /** Framing mixed into the turn — the existing baseline. */
  PRE_PROMPT: "pre-prompt",
  /** Framing broken out from the scenario. */
  SEPARATED: "separated",
} as const;

export type PromptStyle = (typeof PROMPT_STYLE)[keyof typeof PROMPT_STYLE];

export interface PromptTurn {
  role: string;
  content: string;
}

// Split a session's prompts into the framing (system turns) and the scenario
// (everything the model actually responds to). Order is preserved within each.
export function splitSessionPrompts<T extends PromptTurn>(
  prompts: T[],
): { preprompt: T[]; scenario: T[] } {
  const preprompt: T[] = [];
  const scenario: T[] = [];
  for (const p of prompts) {
    (p.role === "system" ? preprompt : scenario).push(p);
  }
  return { preprompt, scenario };
}

// Whether the framing is broken out into its own system turn(s) rather than
// folded into the scenario. A run with separated framing should be tagged
// PROMPT_STYLE.SEPARATED; otherwise it is the PRE_PROMPT baseline.
export function hasExplicitPreprompt(prompts: PromptTurn[]): boolean {
  return prompts.some((p) => p.role === "system");
}
