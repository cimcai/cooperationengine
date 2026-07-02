// Integration test for benchmark-proposal provenance + dedup (issue #22 / #15).
// Needs a real Postgres (DATABASE_URL) with the schema pushed; self-skips otherwise.
//   DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/coe_test npm test

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import type { InsertBenchmarkProposal } from "@shared/schema";

const hasDb = !!process.env.DATABASE_URL;

const proposal = (over: Partial<InsertBenchmarkProposal> = {}): InsertBenchmarkProposal => ({
  testDescription: "Two agents split a scarce resource.",
  promptCount: 3,
  aiPrep: "System prompt sets up the dilemma.",
  estimatedDuration: "~2 min",
  outcomeDescription: "Measure cooperative vs. defecting splits.",
  ...over,
});

describe.skipIf(!hasDb)("benchmark proposals — provenance & dedup (real Postgres)", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE benchmark_proposals RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await (db.$client as { end?: () => Promise<void> }).end?.();
  });

  it("defaults category to 'uncategorized' when none is given", async () => {
    const p = await storage.createBenchmarkProposal(proposal());
    expect(p.category).toBe("uncategorized");
  });

  it("round-trips provenance fields (source / sourceType / category)", async () => {
    await storage.createBenchmarkProposal(
      proposal({ source: "transcript:abc", sourceType: "symposium", category: "sycophancy" }),
    );
    const [stored] = await storage.getBenchmarkProposals();
    expect(stored).toMatchObject({
      source: "transcript:abc",
      sourceType: "symposium",
      category: "sycophancy",
    });
  });

  it("dedups identical content to a single row and returns the existing proposal", async () => {
    const first = await storage.createBenchmarkProposal(proposal({ submitterName: "Alice" }));
    // Same substance, different submitter + formatting — still the same test.
    const second = await storage.createBenchmarkProposal(
      proposal({ submitterName: "Bob", testDescription: "  Two agents SPLIT a scarce   resource.  " }),
    );

    expect(second.id).toBe(first.id); // returned the existing row, didn't insert
    const all = await storage.getBenchmarkProposals();
    expect(all).toHaveLength(1);
    expect(all[0].submitterName).toBe("Alice"); // the original won
  });

  it("keeps genuinely different proposals as separate rows", async () => {
    await storage.createBenchmarkProposal(proposal());
    await storage.createBenchmarkProposal(proposal({ testDescription: "A trolley variant." }));
    expect(await storage.getBenchmarkProposals()).toHaveLength(2);
  });

  it("looks a proposal up by its content hash", async () => {
    const created = await storage.createBenchmarkProposal(proposal());
    // re-submitting yields the same row, proving the hash lookup hit
    const again = await storage.createBenchmarkProposal(proposal());
    expect(again.id).toBe(created.id);
  });
});
