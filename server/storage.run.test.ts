// Integration test for the run promptStyle tag (#18). Real Postgres; self-skips
// without DATABASE_URL.
//   DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/coe_test npm test

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { sessions } from "@shared/schema";
import { PROMPT_STYLE } from "./preprompt";

const hasDb = !!process.env.DATABASE_URL;

async function seedSession(id: string) {
  await db.insert(sessions).values({
    id,
    title: "Prisoner's Dilemma",
    prompts: [
      { id: "p1", order: 0, role: "system", content: "framing" },
      { id: "p2", order: 1, role: "user", content: "scenario" },
    ],
  });
}

describe.skipIf(!hasDb)("run promptStyle tag (real Postgres)", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE runs, sessions RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await (db.$client as { end?: () => Promise<void> }).end?.();
  });

  it("defaults a new run to the 'pre-prompt' baseline", async () => {
    await seedSession("s1");
    const run = await storage.createRun({ sessionId: "s1", chatbotIds: ["bot-a"] });
    expect(run.promptStyle).toBe(PROMPT_STYLE.PRE_PROMPT);
  });

  it("records an explicit 'separated' style when given", async () => {
    await seedSession("s1");
    const run = await storage.createRun({
      sessionId: "s1",
      chatbotIds: ["bot-a"],
      promptStyle: PROMPT_STYLE.SEPARATED,
    });
    expect(run.promptStyle).toBe("separated");
  });
});
