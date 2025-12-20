import { type Session, type Run, type Chatbot, type InsertSession, type InsertRun, type ChatbotResponse, type ArenaMatch, type ArenaRound, type InsertArenaMatch, sessions, runs, arenaMatches } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Available chatbots configuration
export const availableChatbots: Chatbot[] = [
  {
    id: "openai-gpt5",
    provider: "openai",
    displayName: "GPT-5.1",
    model: "gpt-5.1",
    description: "OpenAI's most capable model",
    enabled: true,
  },
  {
    id: "openai-gpt4o",
    provider: "openai",
    displayName: "GPT-4o",
    model: "gpt-4o",
    description: "Fast multimodal model",
    enabled: true,
  },
  {
    id: "anthropic-sonnet",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.5",
    model: "claude-sonnet-4-5",
    description: "Balanced performance and speed",
    enabled: true,
  },
  {
    id: "anthropic-opus",
    provider: "anthropic",
    displayName: "Claude Opus 4.5",
    model: "claude-opus-4-5",
    description: "Not available via Replit AI Integrations",
    enabled: false,
  },
  {
    id: "gemini-flash",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash",
    model: "gemini-2.5-flash",
    description: "Fast hybrid reasoning model",
    enabled: true,
  },
  {
    id: "gemini-pro",
    provider: "gemini",
    displayName: "Gemini 2.5 Pro",
    model: "gemini-2.5-pro",
    description: "Advanced reasoning capabilities",
    enabled: true,
  },
  {
    id: "xai-grok",
    provider: "xai",
    displayName: "Grok 3",
    model: "grok-3",
    description: "xAI's Grok model - requires XAI_API_KEY",
    enabled: !!process.env.XAI_API_KEY,
  },
];

export interface IStorage {
  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  getRuns(): Promise<Run[]>;
  getRunsBySession(sessionId: string): Promise<Run[]>;
  getRun(id: string): Promise<Run | undefined>;
  createRun(data: InsertRun): Promise<Run>;
  updateRun(id: string, updates: Partial<Run>): Promise<Run | undefined>;
  addResponse(runId: string, response: ChatbotResponse): Promise<void>;
  deleteRun(id: string): Promise<void>;
  getChatbots(): Promise<Chatbot[]>;
  // Arena methods
  getArenaMatches(): Promise<ArenaMatch[]>;
  getArenaMatch(id: string): Promise<ArenaMatch | undefined>;
  createArenaMatch(data: InsertArenaMatch): Promise<ArenaMatch>;
  updateArenaMatch(id: string, updates: Partial<ArenaMatch>): Promise<ArenaMatch | undefined>;
  deleteArenaMatch(id: string): Promise<void>;
}

function dbSessionToSession(row: typeof sessions.$inferSelect): Session {
  return {
    id: row.id,
    title: row.title,
    prompts: row.prompts || [],
    createdAt: row.createdAt.toISOString(),
  };
}

function dbRunToRun(row: typeof runs.$inferSelect): Run {
  return {
    id: row.id,
    sessionId: row.sessionId,
    chatbotIds: row.chatbotIds || [],
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    responses: row.responses || [],
  };
}

function dbArenaMatchToArenaMatch(row: typeof arenaMatches.$inferSelect): ArenaMatch {
  return {
    id: row.id,
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    gameType: row.gameType,
    totalRounds: row.totalRounds,
    temptationPayoff: row.temptationPayoff,
    hiddenLength: row.hiddenLength as boolean,
    status: row.status,
    currentRound: row.currentRound,
    player1Score: row.player1Score,
    player2Score: row.player2Score,
    rounds: (row.rounds || []) as ArenaRound[],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

export class DatabaseStorage implements IStorage {
  async getSessions(): Promise<Session[]> {
    const result = await db.select().from(sessions).orderBy(desc(sessions.createdAt));
    return result.map(dbSessionToSession);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0] ? dbSessionToSession(result[0]) : undefined;
  }

  async createSession(data: InsertSession): Promise<Session> {
    const id = randomUUID();
    const result = await db.insert(sessions).values({
      id,
      title: data.title,
      prompts: data.prompts,
    }).returning();
    return dbSessionToSession(result[0]);
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const result = await db.update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return result[0] ? dbSessionToSession(result[0]) : undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(runs).where(eq(runs.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getRuns(): Promise<Run[]> {
    const result = await db.select().from(runs).orderBy(desc(runs.startedAt));
    return result.map(dbRunToRun);
  }

  async getRunsBySession(sessionId: string): Promise<Run[]> {
    const result = await db.select().from(runs)
      .where(eq(runs.sessionId, sessionId))
      .orderBy(desc(runs.startedAt));
    return result.map(dbRunToRun);
  }

  async getRun(id: string): Promise<Run | undefined> {
    const result = await db.select().from(runs).where(eq(runs.id, id));
    return result[0] ? dbRunToRun(result[0]) : undefined;
  }

  async createRun(data: InsertRun): Promise<Run> {
    const id = randomUUID();
    const result = await db.insert(runs).values({
      id,
      sessionId: data.sessionId,
      chatbotIds: data.chatbotIds,
      status: "pending",
      responses: [],
    }).returning();
    return dbRunToRun(result[0]);
  }

  async updateRun(id: string, updates: Partial<Run>): Promise<Run | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.completedAt) updateData.completedAt = new Date(updates.completedAt);
    if (updates.responses) updateData.responses = updates.responses;
    
    const result = await db.update(runs)
      .set(updateData)
      .where(eq(runs.id, id))
      .returning();
    return result[0] ? dbRunToRun(result[0]) : undefined;
  }

  async addResponse(runId: string, response: ChatbotResponse): Promise<void> {
    const run = await this.getRun(runId);
    if (run) {
      const updatedResponses = [...run.responses, response];
      await db.update(runs)
        .set({ responses: updatedResponses })
        .where(eq(runs.id, runId));
    }
  }

  async deleteRun(id: string): Promise<void> {
    await db.delete(runs).where(eq(runs.id, id));
  }

  async getChatbots(): Promise<Chatbot[]> {
    return availableChatbots;
  }

  // Arena methods
  async getArenaMatches(): Promise<ArenaMatch[]> {
    const result = await db.select().from(arenaMatches).orderBy(desc(arenaMatches.createdAt));
    return result.map(dbArenaMatchToArenaMatch);
  }

  async getArenaMatch(id: string): Promise<ArenaMatch | undefined> {
    const result = await db.select().from(arenaMatches).where(eq(arenaMatches.id, id));
    return result[0] ? dbArenaMatchToArenaMatch(result[0]) : undefined;
  }

  async createArenaMatch(data: InsertArenaMatch): Promise<ArenaMatch> {
    const id = randomUUID();
    const result = await db.insert(arenaMatches).values({
      id,
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      gameType: data.gameType,
      totalRounds: data.totalRounds,
      temptationPayoff: data.temptationPayoff,
      hiddenLength: data.hiddenLength,
      status: "pending",
      currentRound: 0,
      player1Score: 0,
      player2Score: 0,
      rounds: [],
    }).returning();
    return dbArenaMatchToArenaMatch(result[0]);
  }

  async updateArenaMatch(id: string, updates: Partial<ArenaMatch>): Promise<ArenaMatch | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.currentRound !== undefined) updateData.currentRound = updates.currentRound;
    if (updates.player1Score !== undefined) updateData.player1Score = updates.player1Score;
    if (updates.player2Score !== undefined) updateData.player2Score = updates.player2Score;
    if (updates.rounds !== undefined) updateData.rounds = updates.rounds;
    if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
    
    if (Object.keys(updateData).length === 0) {
      return this.getArenaMatch(id);
    }
    
    const result = await db.update(arenaMatches)
      .set(updateData)
      .where(eq(arenaMatches.id, id))
      .returning();
    return result[0] ? dbArenaMatchToArenaMatch(result[0]) : undefined;
  }

  async deleteArenaMatch(id: string): Promise<void> {
    await db.delete(arenaMatches).where(eq(arenaMatches.id, id));
  }
}

export const storage = new DatabaseStorage();
