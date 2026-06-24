// Integration test for storage.getRunsHistory (issue #13, item 2).
//
// This one needs a real Postgres: getRunsHistory is a thin Drizzle query
// (ilike on session title + pagination over runs), so the honest way to pin it
// down is to run it against the actual database rather than a mock. It is gated
// on DATABASE_URL, so a DB-less `npm test` simply skips it.
//
// Run it with a Postgres pointed at by DATABASE_URL and the schema pushed
// (`npm run db:push`), e.g.:
//   DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/coe_test npm test

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { sessions, runs } from "@shared/schema";

const hasDb = !!process.env.DATABASE_URL;

async function seedSession(id: string, title: string, runCount: number) {
  await db.insert(sessions).values({
    id,
    title,
    prompts: [{ id: "p1", order: 0, role: "user", content: "hi" }],
  });
  for (let i = 0; i < runCount; i++) {
    await db.insert(runs).values({
      id: `${id}-run-${i}`,
      sessionId: id,
      chatbotIds: ["bot-a"],
      status: "completed",
      // Distinct timestamps so the desc() ordering is well-defined.
      startedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      responses: [{ chatbotId: "bot-a", stepOrder: 0, content: "COOPERATE", latencyMs: 5 }],
    });
  }
}

describe.skipIf(!hasDb)("getRunsHistory (integration, real Postgres)", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE runs, sessions RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    // Release the pool so vitest can exit cleanly.
    await (db.$client as { end?: () => Promise<void> }).end?.();
  });

  it("returns every run when no search is given", async () => {
    await seedSession("s1", "Prisoner's Dilemma", 2);
    await seedSession("s2", "Life Raft", 1);

    const res = await storage.getRunsHistory({ page: 1, limit: 50 });

    expect(res.total).toBe(3);
    expect(res.items).toHaveLength(3);
  });

  it("filters by case-insensitive title substring (ilike)", async () => {
    await seedSession("s1", "Prisoner's Dilemma", 2);
    await seedSession("s2", "Life Raft", 1);

    const res = await storage.getRunsHistory({ page: 1, limit: 50, search: "prisoner" });

    expect(res.total).toBe(2);
    expect(res.items.every((i) => i.session.title === "Prisoner's Dilemma")).toBe(true);
  });

  it("returns an empty result for a non-matching search", async () => {
    await seedSession("s1", "Prisoner's Dilemma", 1);

    const res = await storage.getRunsHistory({ page: 1, limit: 50, search: "zzz-nomatch" });

    expect(res).toEqual({ items: [], total: 0 });
  });

  it("paginates: total counts all matches, items only the requested page", async () => {
    await seedSession("s1", "Prisoner's Dilemma", 5);

    const page1 = await storage.getRunsHistory({ page: 1, limit: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);

    const page3 = await storage.getRunsHistory({ page: 3, limit: 2 });
    expect(page3.total).toBe(5);
    expect(page3.items).toHaveLength(1); // 5 rows, third page of size 2 -> 1 left
  });
});
