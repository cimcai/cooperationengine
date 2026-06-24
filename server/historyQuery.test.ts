// Unit tests for the GET /api/history query/response helpers (issue #13 item 3).
// Pure functions — no DB, no Express.

import { describe, it, expect } from "vitest";
import { parseHistoryQuery, buildHistoryResponse } from "./historyQuery";

describe("parseHistoryQuery", () => {
  it("applies defaults when nothing is supplied", () => {
    expect(parseHistoryQuery({})).toEqual({ page: 1, limit: 50, search: undefined });
  });

  it("parses a valid page and limit", () => {
    expect(parseHistoryQuery({ page: "3", limit: "100" })).toMatchObject({ page: 3, limit: 100 });
  });

  it("falls back to defaults on non-numeric input", () => {
    expect(parseHistoryQuery({ page: "abc", limit: "xyz" })).toMatchObject({ page: 1, limit: 50 });
  });

  it("clamps page to a minimum of 1", () => {
    expect(parseHistoryQuery({ page: "0" }).page).toBe(1);
    expect(parseHistoryQuery({ page: "-5" }).page).toBe(1);
  });

  it("clamps limit to [1, 500]", () => {
    expect(parseHistoryQuery({ limit: "0" }).limit).toBe(1);
    expect(parseHistoryQuery({ limit: "9999" }).limit).toBe(500);
    expect(parseHistoryQuery({ limit: "250" }).limit).toBe(250);
  });

  it("treats blank / whitespace search as no search", () => {
    expect(parseHistoryQuery({ search: "" }).search).toBeUndefined();
    expect(parseHistoryQuery({ search: "   " }).search).toBeUndefined();
    expect(parseHistoryQuery({ search: 123 }).search).toBeUndefined();
  });

  it("trims a real search term", () => {
    expect(parseHistoryQuery({ search: "  prisoner  " }).search).toBe("prisoner");
  });
});

describe("buildHistoryResponse", () => {
  it("passes items/total through and echoes page/limit", () => {
    const out = buildHistoryResponse({ items: [{ id: "r1" }], total: 1 }, 2, 25);
    expect(out).toMatchObject({ items: [{ id: "r1" }], total: 1, page: 2, limit: 25 });
  });

  it("computes totalPages by ceiling division", () => {
    expect(buildHistoryResponse({ items: [], total: 10 }, 1, 3).totalPages).toBe(4);
    expect(buildHistoryResponse({ items: [], total: 50 }, 1, 50).totalPages).toBe(1);
  });

  it("reports zero pages for an empty result set", () => {
    expect(buildHistoryResponse({ items: [], total: 0 }, 1, 50).totalPages).toBe(0);
  });
});
