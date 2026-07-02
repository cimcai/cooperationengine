import { test, expect } from "vitest";
import { parseEvaluation, stripJsonFence } from "./evaluationParse";

test("clean JSON: score + summary parse, parseOk true", () => {
  const r = parseEvaluation('{"score": 8, "summary": "solid dilemma"}');
  expect(r.score).toBe(8);
  expect(r.summary).toBe("solid dilemma");
  expect(r.parseOk).toBe(true);
});

test("fenced ```json block is stripped and parsed", () => {
  const r = parseEvaluation('```json\n{"score": 6, "summary": "ok"}\n```');
  expect(r.score).toBe(6);
  expect(r.parseOk).toBe(true);
});

test("prose (non-JSON) → defaults to 1 but parseOk FALSE (distinguishes from a real 1)", () => {
  const r = parseEvaluation("This is a thoughtful contribution about cooperation...");
  expect(r.score).toBe(1);
  expect(r.parseOk).toBe(false);
  expect(r.summary.startsWith("This is a thoughtful")).toBe(true);
});

test("string-typed score '8' is NOT accepted → 1, parseOk FALSE (the #22 gap)", () => {
  const r = parseEvaluation('{"score": "8", "summary": "x"}');
  expect(r.score).toBe(1);
  expect(r.parseOk).toBe(false);
});

test("missing score → 1, parseOk FALSE", () => {
  const r = parseEvaluation('{"summary": "no score here"}');
  expect(r.score).toBe(1);
  expect(r.parseOk).toBe(false);
});

test("out-of-range score is clamped to 1..10, parseOk true", () => {
  expect(parseEvaluation('{"score": 99, "summary":"y"}').score).toBe(10);
  expect(parseEvaluation('{"score": -4, "summary":"y"}').score).toBe(1);
  expect(parseEvaluation('{"score": 99}').parseOk).toBe(true);
});

test("float score is rounded", () => {
  expect(parseEvaluation('{"score": 7.6, "summary":"y"}').score).toBe(8);
});

test("empty / whitespace input → 1, parseOk FALSE", () => {
  expect(parseEvaluation("").parseOk).toBe(false);
  expect(parseEvaluation("   ").score).toBe(1);
});

test("summary falls back to raw content, capped at 2000 chars", () => {
  const big = "x".repeat(5000);
  const r = parseEvaluation(big);
  expect(r.parseOk).toBe(false);
  expect(r.summary.length).toBe(2000);
});

test("stripJsonFence handles bare and fenced input", () => {
  expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
  expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
});
