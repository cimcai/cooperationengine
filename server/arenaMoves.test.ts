import { describe, it, expect } from "vitest";
import { extractMove } from "./arenaMoves";

const PD: [string, string] = ["COOPERATE", "DEFECT"];
const STAG_HUNT: [string, string] = ["STAG", "RABBIT"];
const APPLE: [string, string] = ["WORK", "STEAL"];

describe("extractMove", () => {
  describe("format-compliant responses (label on first line)", () => {
    it("parses a bare label", () => {
      expect(extractMove("DEFECT", PD)).toEqual({ move: "DEFECT", parseOk: true });
      expect(extractMove("COOPERATE", PD)).toEqual({ move: "COOPERATE", parseOk: true });
    });

    it("parses label followed by reasoning on later lines", () => {
      const r = "DEFECT\nIf I cooperate now I lose the endgame.";
      expect(extractMove(r, PD)).toEqual({ move: "DEFECT", parseOk: true });
    });

    it("reasoning mentioning the other label does not override the first line", () => {
      const r = "COOPERATE\nDefect would score more but destroys trust; cooperate compounds.";
      expect(extractMove(r, PD)).toEqual({ move: "COOPERATE", parseOk: true });
    });

    it("is case-insensitive", () => {
      expect(extractMove("cooperate", PD)).toEqual({ move: "COOPERATE", parseOk: true });
    });

    it("tolerates markdown/punctuation around the label", () => {
      expect(extractMove("**DEFECT**", PD)).toEqual({ move: "DEFECT", parseOk: true });
      expect(extractMove("- STAG: joint hunt maximizes payoff", STAG_HUNT))
        .toEqual({ move: "STAG", parseOk: true });
    });

    it("skips leading blank lines", () => {
      expect(extractMove("\n\n  RABBIT\nSafe choice.", STAG_HUNT))
        .toEqual({ move: "RABBIT", parseOk: true });
    });
  });

  describe("format violations that are still unambiguous", () => {
    it("finds a single label mentioned mid-sentence", () => {
      const r = "After weighing the history, I choose to STEAL this round.";
      expect(extractMove(r, APPLE)).toEqual({ move: "STEAL", parseOk: true });
    });
  });

  describe("regressions the previous substring parser got wrong", () => {
    it("does not score 'hostage' as a STAG move", () => {
      const r = "This feels like the hostage situation from round 2. RABBIT.";
      // old parser: upper.includes("STAG") matched hoSTAGe first -> STAG (wrong)
      expect(extractMove(r, STAG_HUNT)).toEqual({ move: "RABBIT", parseOk: true });
    });

    it("does not score 'cooperation' (the word) as a COOPERATE move", () => {
      const r = "Our cooperation has broken down completely. DEFECT.";
      // old parser: includes("COOPERATE") matched COOPERATIon first -> COOPERATE (wrong)
      expect(extractMove(r, PD)).toEqual({ move: "DEFECT", parseOk: true });
    });

    it("does not resolve negated-then-chosen responses by label order", () => {
      const r = "I will not COOPERATE this time. DEFECT.";
      // old parser: includes(move1) checked first -> COOPERATE (wrong).
      // Both labels appear as words with no compliant first line, so this is
      // ambiguous: flag it rather than guess by order.
      expect(extractMove(r, PD)).toEqual({ move: null, parseOk: false });
    });
  });

  describe("unparseable responses", () => {
    it("flags a response with no move label", () => {
      expect(extractMove("I refuse to play this game.", PD))
        .toEqual({ move: null, parseOk: false });
    });

    it("flags an empty response", () => {
      expect(extractMove("", PD)).toEqual({ move: null, parseOk: false });
    });

    it("flags a response naming both labels with no compliant first line", () => {
      const r = "Torn between STAG and RABBIT here, honestly.";
      expect(extractMove(r, STAG_HUNT)).toEqual({ move: null, parseOk: false });
    });
  });
});
