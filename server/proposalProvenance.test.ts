// Unit tests for proposal provenance/dedup/recusal helpers (issue #22 / #15).
// Pure — no DB.

import { describe, it, expect } from "vitest";
import { computeProposalHash, wouldRecuse } from "./proposalProvenance";

const base = () => ({
  testDescription: "Two agents split a resource under scarcity.",
  aiPrep: "System prompt establishes the scenario.",
  outcomeDescription: "Measure cooperative vs. defecting splits.",
});

describe("computeProposalHash", () => {
  it("is stable for identical content", () => {
    expect(computeProposalHash(base())).toBe(computeProposalHash(base()));
  });

  it("ignores case and surrounding/collapsed whitespace (dedup-friendly)", () => {
    const a = base();
    const b = {
      testDescription: "  TWO agents   split a resource under scarcity.  ",
      aiPrep: "System Prompt establishes the scenario.",
      outcomeDescription: "MEASURE cooperative vs. defecting splits.",
    };
    expect(computeProposalHash(a)).toBe(computeProposalHash(b));
  });

  it("changes when the substance changes", () => {
    const h = computeProposalHash(base());
    expect(computeProposalHash({ ...base(), testDescription: "A different scenario." })).not.toBe(h);
    expect(computeProposalHash({ ...base(), aiPrep: "Different prep." })).not.toBe(h);
    expect(computeProposalHash({ ...base(), outcomeDescription: "Different outcome." })).not.toBe(h);
  });
});

describe("wouldRecuse", () => {
  it("recuses when the rater is the proposer", () => {
    expect(wouldRecuse("alice@x.org", "alice@x.org")).toBe(true);
  });

  it("allows rating someone else's proposal", () => {
    expect(wouldRecuse("alice@x.org", "bob@x.org")).toBe(false);
  });

  it("does not recuse when either identity is missing (can't prove self-rating)", () => {
    expect(wouldRecuse(undefined, "bob@x.org")).toBe(false);
    expect(wouldRecuse("alice@x.org", null)).toBe(false);
    expect(wouldRecuse("", "")).toBe(false);
  });
});
