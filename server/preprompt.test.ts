// Unit tests for the pre-prompt separation helpers (#18). Pure — no DB.

import { describe, it, expect } from "vitest";
import {
  PROMPT_STYLE,
  splitSessionPrompts,
  hasExplicitPreprompt,
} from "./preprompt";

const turns = [
  { role: "system", content: "You are participating in a cooperation study." },
  { role: "user", content: "Split 10 coins with another player." },
  { role: "assistant", content: "I propose 5/5." },
  { role: "system", content: "Now a second framing note." },
  { role: "user", content: "Round two." },
];

describe("splitSessionPrompts", () => {
  it("separates system framing from the scenario, preserving order", () => {
    const { preprompt, scenario } = splitSessionPrompts(turns);
    expect(preprompt.map((p) => p.content)).toEqual([
      "You are participating in a cooperation study.",
      "Now a second framing note.",
    ]);
    expect(scenario.map((p) => p.role)).toEqual(["user", "assistant", "user"]);
  });

  it("handles no framing (all scenario)", () => {
    const { preprompt, scenario } = splitSessionPrompts([
      { role: "user", content: "hi" },
      { role: "assistant", content: "ok" },
    ]);
    expect(preprompt).toEqual([]);
    expect(scenario).toHaveLength(2);
  });

  it("handles an empty prompt list", () => {
    expect(splitSessionPrompts([])).toEqual({ preprompt: [], scenario: [] });
  });
});

describe("hasExplicitPreprompt", () => {
  it("is true when framing is broken out into a system turn", () => {
    expect(hasExplicitPreprompt(turns)).toBe(true);
  });

  it("is false when framing is folded into the scenario (the baseline)", () => {
    expect(
      hasExplicitPreprompt([
        { role: "user", content: "You are in a test. Now split 10 coins." },
      ]),
    ).toBe(false);
  });
});

describe("PROMPT_STYLE", () => {
  it("names the baseline and the separated style", () => {
    expect(PROMPT_STYLE.PRE_PROMPT).toBe("pre-prompt");
    expect(PROMPT_STYLE.SEPARATED).toBe("separated");
  });
});
