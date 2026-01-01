import { type Session, type Run, type Chatbot, type InsertSession, type InsertRun, type ChatbotResponse, type ArenaMatch, type ArenaRound, type InsertArenaMatch, type ToolkitItem, type InsertToolkitItem, type LeaderboardEntry, type InsertLeaderboardEntry, type ToolkitLeaderboardEntry, type Epoch, type Joke, type InsertJoke, type JokeRating, type InsertJokeRating, type BenchmarkProposal, type InsertBenchmarkProposal, type BenchmarkWeight, sessions, runs, arenaMatches, toolkitItems, leaderboardEntries, toolkitLeaderboard, epochs, jokes, jokeRatings, benchmarkProposals, benchmarkWeights } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

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
  {
    id: "openrouter-grok4",
    provider: "openrouter",
    displayName: "Grok 4",
    model: "x-ai/grok-4",
    description: "xAI's flagship reasoning model via OpenRouter",
    enabled: true,
  },
  {
    id: "openrouter-deepseek",
    provider: "openrouter",
    displayName: "DeepSeek R1",
    model: "deepseek/deepseek-r1",
    description: "DeepSeek's reasoning model via OpenRouter",
    enabled: true,
  },
  {
    id: "openrouter-llama",
    provider: "openrouter",
    displayName: "Llama 4 Maverick",
    model: "meta-llama/llama-4-maverick",
    description: "Meta's Llama 4 Maverick model via OpenRouter",
    enabled: true,
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
  // Toolkit methods
  getToolkitItems(): Promise<ToolkitItem[]>;
  getToolkitItem(id: string): Promise<ToolkitItem | undefined>;
  createToolkitItem(data: InsertToolkitItem): Promise<ToolkitItem>;
  deleteToolkitItem(id: string): Promise<void>;
  // Leaderboard methods
  getLeaderboardEntries(epochId?: string, templateId?: string): Promise<LeaderboardEntry[]>;
  getLeaderboardEntry(id: string): Promise<LeaderboardEntry | undefined>;
  upsertLeaderboardEntry(epochId: string, templateId: string, candidateNumber: number, candidateName: string): Promise<LeaderboardEntry>;
  updateLeaderboardOutcomes(id: string, outcomes: { waterSecurity?: number; foodSecurity?: number; selfSustaining?: number; population10yr?: number; population50yr?: number }): Promise<LeaderboardEntry | undefined>;
  clearLeaderboard(): Promise<void>;
  // Toolkit Leaderboard methods
  getToolkitLeaderboard(epochId?: string): Promise<ToolkitLeaderboardEntry[]>;
  upsertToolkitUsage(toolkitItemId: string, epochId: string, templateId?: string): Promise<ToolkitLeaderboardEntry>;
  updateToolkitOutcomes(toolkitItemId: string, outcomes: { waterSecurity?: number; foodSecurity?: number; selfSustaining?: number; population10yr?: number; population50yr?: number }): Promise<ToolkitLeaderboardEntry | undefined>;
  // Epoch methods
  getEpochs(): Promise<Epoch[]>;
  getActiveEpoch(): Promise<Epoch>;
  createEpoch(name: string): Promise<Epoch>;
  archiveCurrentEpoch(): Promise<Epoch>;
  // Joke methods
  getJokes(epochId?: string): Promise<Joke[]>;
  getJoke(id: string): Promise<Joke | undefined>;
  createJoke(epochId: string, data: InsertJoke): Promise<Joke>;
  updateJokeRatings(jokeId: string, rating: number, originality?: number, cleverness?: number, laughFactor?: number): Promise<Joke | undefined>;
  getJokeRatings(jokeId: string): Promise<JokeRating[]>;
  createJokeRating(data: InsertJokeRating & { epochId: string }): Promise<JokeRating>;
  // Benchmark Proposal methods
  getBenchmarkProposals(): Promise<BenchmarkProposal[]>;
  createBenchmarkProposal(data: InsertBenchmarkProposal): Promise<BenchmarkProposal>;
  // Benchmark Weights methods
  getBenchmarkWeights(): Promise<BenchmarkWeight[]>;
  updateBenchmarkWeight(testId: string, weight: number): Promise<BenchmarkWeight>;
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

function dbToolkitItemToToolkitItem(row: typeof toolkitItems.$inferSelect): ToolkitItem {
  return {
    id: row.id,
    name: row.name,
    aiModel: row.aiModel,
    weight: row.weight,
    energy: row.energy,
    formFactor: row.formFactor,
    capabilities: (row.capabilities || []) as string[],
    knowledge: (row.knowledge || []) as string[],
    interaction: row.interaction,
    limitations: row.limitations || undefined,
    reasoning: row.reasoning || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function dbLeaderboardEntryToLeaderboardEntry(row: typeof leaderboardEntries.$inferSelect): LeaderboardEntry {
  return {
    id: row.id,
    epochId: row.epochId,
    candidateNumber: row.candidateNumber,
    candidateName: row.candidateName,
    templateId: row.templateId,
    selectionCount: row.selectionCount,
    avgWaterSecurity: row.avgWaterSecurity || undefined,
    avgFoodSecurity: row.avgFoodSecurity || undefined,
    avgSelfSustaining: row.avgSelfSustaining || undefined,
    avgPopulation10yr: row.avgPopulation10yr || undefined,
    avgPopulation50yr: row.avgPopulation50yr || undefined,
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

function dbEpochToEpoch(row: typeof epochs.$inferSelect): Epoch {
  return {
    id: row.id,
    name: row.name,
    epochNumber: row.epochNumber,
    isActive: row.isActive === 1,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
  };
}

function dbJokeToJoke(row: typeof jokes.$inferSelect): Joke {
  return {
    id: row.id,
    epochId: row.epochId,
    jokeText: row.jokeText,
    jokeType: row.jokeType,
    theme: row.theme,
    creatorModel: row.creatorModel,
    selfRating: row.selfRating || undefined,
    avgRating: row.avgRating || undefined,
    ratingCount: row.ratingCount,
    avgOriginality: row.avgOriginality || undefined,
    avgCleverness: row.avgCleverness || undefined,
    avgLaughFactor: row.avgLaughFactor || undefined,
    runId: row.runId || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function dbJokeRatingToJokeRating(row: typeof jokeRatings.$inferSelect): JokeRating {
  return {
    id: row.id,
    jokeId: row.jokeId,
    raterModel: row.raterModel,
    rating: row.rating,
    originality: row.originality || undefined,
    cleverness: row.cleverness || undefined,
    laughFactor: row.laughFactor || undefined,
    critique: row.critique || undefined,
    runId: row.runId || undefined,
    createdAt: row.createdAt.toISOString(),
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

  // Toolkit methods
  async getToolkitItems(): Promise<ToolkitItem[]> {
    const result = await db.select().from(toolkitItems).orderBy(desc(toolkitItems.createdAt));
    return result.map(dbToolkitItemToToolkitItem);
  }

  async getToolkitItem(id: string): Promise<ToolkitItem | undefined> {
    const result = await db.select().from(toolkitItems).where(eq(toolkitItems.id, id));
    return result[0] ? dbToolkitItemToToolkitItem(result[0]) : undefined;
  }

  async createToolkitItem(data: InsertToolkitItem): Promise<ToolkitItem> {
    const id = randomUUID();
    const result = await db.insert(toolkitItems).values({
      id,
      name: data.name,
      aiModel: data.aiModel,
      weight: data.weight,
      energy: data.energy,
      formFactor: data.formFactor,
      capabilities: data.capabilities,
      knowledge: data.knowledge,
      interaction: data.interaction,
      limitations: data.limitations,
      reasoning: data.reasoning,
    }).returning();
    return dbToolkitItemToToolkitItem(result[0]);
  }

  async deleteToolkitItem(id: string): Promise<void> {
    await db.delete(toolkitItems).where(eq(toolkitItems.id, id));
  }

  // Leaderboard methods
  async getLeaderboardEntries(epochId?: string, templateId?: string): Promise<LeaderboardEntry[]> {
    const activeEpoch = epochId || (await this.getActiveEpoch()).id;
    
    if (templateId) {
      const result = await db.select().from(leaderboardEntries)
        .where(and(eq(leaderboardEntries.epochId, activeEpoch), eq(leaderboardEntries.templateId, templateId)))
        .orderBy(desc(leaderboardEntries.selectionCount));
      return result.map(dbLeaderboardEntryToLeaderboardEntry);
    }
    
    // When no templateId filter, aggregate entries with the same candidateName
    const result = await db.select().from(leaderboardEntries)
      .where(eq(leaderboardEntries.epochId, activeEpoch))
      .orderBy(desc(leaderboardEntries.selectionCount));
    
    // Merge entries with the same candidateName
    const mergedMap = new Map<string, LeaderboardEntry>();
    for (const row of result) {
      const entry = dbLeaderboardEntryToLeaderboardEntry(row);
      const key = entry.candidateName;
      
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        // Sum up selection counts
        existing.selectionCount += entry.selectionCount;
        // Average the metrics if they exist
        if (entry.avgWaterSecurity !== undefined) {
          existing.avgWaterSecurity = existing.avgWaterSecurity !== undefined 
            ? Math.round((existing.avgWaterSecurity + entry.avgWaterSecurity) / 2) 
            : entry.avgWaterSecurity;
        }
        if (entry.avgFoodSecurity !== undefined) {
          existing.avgFoodSecurity = existing.avgFoodSecurity !== undefined
            ? Math.round((existing.avgFoodSecurity + entry.avgFoodSecurity) / 2)
            : entry.avgFoodSecurity;
        }
        if (entry.avgSelfSustaining !== undefined) {
          existing.avgSelfSustaining = existing.avgSelfSustaining !== undefined
            ? Math.round((existing.avgSelfSustaining + entry.avgSelfSustaining) / 2)
            : entry.avgSelfSustaining;
        }
        if (entry.avgPopulation10yr !== undefined) {
          existing.avgPopulation10yr = existing.avgPopulation10yr !== undefined
            ? Math.round((existing.avgPopulation10yr + entry.avgPopulation10yr) / 2)
            : entry.avgPopulation10yr;
        }
        if (entry.avgPopulation50yr !== undefined) {
          existing.avgPopulation50yr = existing.avgPopulation50yr !== undefined
            ? Math.round((existing.avgPopulation50yr + entry.avgPopulation50yr) / 2)
            : entry.avgPopulation50yr;
        }
        // Use latest timestamp
        if (entry.lastUpdated && (!existing.lastUpdated || new Date(entry.lastUpdated) > new Date(existing.lastUpdated))) {
          existing.lastUpdated = entry.lastUpdated;
        }
      } else {
        mergedMap.set(key, { ...entry });
      }
    }
    
    // Sort by selection count descending
    return Array.from(mergedMap.values()).sort((a, b) => b.selectionCount - a.selectionCount);
  }

  async getLeaderboardEntry(id: string): Promise<LeaderboardEntry | undefined> {
    const result = await db.select().from(leaderboardEntries).where(eq(leaderboardEntries.id, id));
    return result[0] ? dbLeaderboardEntryToLeaderboardEntry(result[0]) : undefined;
  }

  async upsertLeaderboardEntry(epochId: string, templateId: string, candidateNumber: number, candidateName: string): Promise<LeaderboardEntry> {
    const existing = await db.select().from(leaderboardEntries)
      .where(and(
        eq(leaderboardEntries.epochId, epochId),
        eq(leaderboardEntries.templateId, templateId),
        eq(leaderboardEntries.candidateNumber, candidateNumber)
      ));
    
    if (existing[0]) {
      const result = await db.update(leaderboardEntries)
        .set({ 
          selectionCount: existing[0].selectionCount + 1,
          lastUpdated: new Date()
        })
        .where(eq(leaderboardEntries.id, existing[0].id))
        .returning();
      return dbLeaderboardEntryToLeaderboardEntry(result[0]);
    }
    
    const id = randomUUID();
    const result = await db.insert(leaderboardEntries).values({
      id,
      epochId,
      candidateNumber,
      candidateName,
      templateId,
      selectionCount: 1,
    }).returning();
    return dbLeaderboardEntryToLeaderboardEntry(result[0]);
  }

  async updateLeaderboardOutcomes(id: string, outcomes: { waterSecurity?: number; foodSecurity?: number; selfSustaining?: number; population10yr?: number; population50yr?: number }): Promise<LeaderboardEntry | undefined> {
    const existing = await this.getLeaderboardEntry(id);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = { lastUpdated: new Date() };
    const n = existing.selectionCount;
    
    const computeWeightedAvg = (existingAvg: number | undefined, newValue: number): number => {
      if (existingAvg === undefined || n <= 1) return newValue;
      return Math.round((existingAvg * (n - 1) + newValue) / n);
    };
    
    if (outcomes.waterSecurity !== undefined) {
      updateData.avgWaterSecurity = computeWeightedAvg(existing.avgWaterSecurity, outcomes.waterSecurity);
    }
    if (outcomes.foodSecurity !== undefined) {
      updateData.avgFoodSecurity = computeWeightedAvg(existing.avgFoodSecurity, outcomes.foodSecurity);
    }
    if (outcomes.selfSustaining !== undefined) {
      updateData.avgSelfSustaining = computeWeightedAvg(existing.avgSelfSustaining, outcomes.selfSustaining);
    }
    if (outcomes.population10yr !== undefined) {
      updateData.avgPopulation10yr = computeWeightedAvg(existing.avgPopulation10yr, outcomes.population10yr);
    }
    if (outcomes.population50yr !== undefined) {
      updateData.avgPopulation50yr = computeWeightedAvg(existing.avgPopulation50yr, outcomes.population50yr);
    }

    const result = await db.update(leaderboardEntries)
      .set(updateData)
      .where(eq(leaderboardEntries.id, id))
      .returning();
    return result[0] ? dbLeaderboardEntryToLeaderboardEntry(result[0]) : undefined;
  }

  async clearLeaderboard(): Promise<void> {
    await db.delete(leaderboardEntries);
  }

  // Toolkit Leaderboard methods
  async getToolkitLeaderboard(epochId?: string): Promise<ToolkitLeaderboardEntry[]> {
    const activeEpoch = epochId || (await this.getActiveEpoch()).id;
    const result = await db.select().from(toolkitLeaderboard)
      .where(eq(toolkitLeaderboard.epochId, activeEpoch))
      .orderBy(desc(toolkitLeaderboard.usageCount));
    const entries: ToolkitLeaderboardEntry[] = [];
    
    for (const row of result) {
      const item = await this.getToolkitItem(row.toolkitItemId);
      entries.push({
        id: row.id,
        epochId: row.epochId,
        toolkitItemId: row.toolkitItemId,
        toolkitItemName: item?.name,
        templateId: row.templateId || undefined,
        usageCount: row.usageCount,
        avgWaterSecurity: row.avgWaterSecurity || undefined,
        avgFoodSecurity: row.avgFoodSecurity || undefined,
        avgSelfSustaining: row.avgSelfSustaining || undefined,
        avgPopulation10yr: row.avgPopulation10yr || undefined,
        avgPopulation50yr: row.avgPopulation50yr || undefined,
        lastUsed: row.lastUsed.toISOString(),
      });
    }
    return entries;
  }

  async upsertToolkitUsage(toolkitItemId: string, epochId: string, templateId?: string): Promise<ToolkitLeaderboardEntry> {
    const existing = await db.select().from(toolkitLeaderboard)
      .where(and(
        eq(toolkitLeaderboard.epochId, epochId),
        eq(toolkitLeaderboard.toolkitItemId, toolkitItemId)
      ));
    
    if (existing[0]) {
      const result = await db.update(toolkitLeaderboard)
        .set({ 
          usageCount: existing[0].usageCount + 1,
          lastUsed: new Date()
        })
        .where(eq(toolkitLeaderboard.id, existing[0].id))
        .returning();
      const item = await this.getToolkitItem(toolkitItemId);
      return {
        id: result[0].id,
        epochId: result[0].epochId,
        toolkitItemId: result[0].toolkitItemId,
        toolkitItemName: item?.name,
        templateId: result[0].templateId || undefined,
        usageCount: result[0].usageCount,
        lastUsed: result[0].lastUsed.toISOString(),
      };
    }
    
    const id = randomUUID();
    const result = await db.insert(toolkitLeaderboard).values({
      id,
      epochId,
      toolkitItemId,
      templateId: templateId || null,
      usageCount: 1,
    }).returning();
    const item = await this.getToolkitItem(toolkitItemId);
    return {
      id: result[0].id,
      epochId: result[0].epochId,
      toolkitItemId: result[0].toolkitItemId,
      toolkitItemName: item?.name,
      templateId: result[0].templateId || undefined,
      usageCount: result[0].usageCount,
      lastUsed: result[0].lastUsed.toISOString(),
    };
  }

  async updateToolkitOutcomes(toolkitItemId: string, outcomes: { waterSecurity?: number; foodSecurity?: number; selfSustaining?: number; population10yr?: number; population50yr?: number }): Promise<ToolkitLeaderboardEntry | undefined> {
    const existing = await db.select().from(toolkitLeaderboard)
      .where(eq(toolkitLeaderboard.toolkitItemId, toolkitItemId));
    if (!existing[0]) return undefined;

    const updateData: Record<string, unknown> = { lastUsed: new Date() };
    const n = existing[0].usageCount;
    
    const computeWeightedAvg = (existingAvg: number | null, newValue: number): number => {
      if (existingAvg === null || n <= 1) return newValue;
      return Math.round((existingAvg * (n - 1) + newValue) / n);
    };
    
    if (outcomes.waterSecurity !== undefined) {
      updateData.avgWaterSecurity = computeWeightedAvg(existing[0].avgWaterSecurity, outcomes.waterSecurity);
    }
    if (outcomes.foodSecurity !== undefined) {
      updateData.avgFoodSecurity = computeWeightedAvg(existing[0].avgFoodSecurity, outcomes.foodSecurity);
    }
    if (outcomes.selfSustaining !== undefined) {
      updateData.avgSelfSustaining = computeWeightedAvg(existing[0].avgSelfSustaining, outcomes.selfSustaining);
    }
    if (outcomes.population10yr !== undefined) {
      updateData.avgPopulation10yr = computeWeightedAvg(existing[0].avgPopulation10yr, outcomes.population10yr);
    }
    if (outcomes.population50yr !== undefined) {
      updateData.avgPopulation50yr = computeWeightedAvg(existing[0].avgPopulation50yr, outcomes.population50yr);
    }

    const result = await db.update(toolkitLeaderboard)
      .set(updateData)
      .where(eq(toolkitLeaderboard.id, existing[0].id))
      .returning();
    
    const item = await this.getToolkitItem(toolkitItemId);
    return {
      id: result[0].id,
      epochId: result[0].epochId,
      toolkitItemId: result[0].toolkitItemId,
      toolkitItemName: item?.name,
      templateId: result[0].templateId || undefined,
      usageCount: result[0].usageCount,
      avgWaterSecurity: result[0].avgWaterSecurity || undefined,
      avgFoodSecurity: result[0].avgFoodSecurity || undefined,
      avgSelfSustaining: result[0].avgSelfSustaining || undefined,
      avgPopulation10yr: result[0].avgPopulation10yr || undefined,
      avgPopulation50yr: result[0].avgPopulation50yr || undefined,
      lastUsed: result[0].lastUsed.toISOString(),
    };
  }

  // Epoch methods
  async getEpochs(): Promise<Epoch[]> {
    const result = await db.select().from(epochs).orderBy(desc(epochs.epochNumber));
    return result.map(dbEpochToEpoch);
  }

  async getActiveEpoch(): Promise<Epoch> {
    const result = await db.select().from(epochs).where(eq(epochs.isActive, 1));
    if (result[0]) {
      return dbEpochToEpoch(result[0]);
    }
    // Create initial epoch if none exists
    return this.createEpoch("Epoch 1");
  }

  async createEpoch(name: string): Promise<Epoch> {
    // Get the highest epoch number
    const existing = await db.select().from(epochs).orderBy(desc(epochs.epochNumber));
    const nextNumber = existing.length > 0 ? existing[0].epochNumber + 1 : 1;
    
    const id = randomUUID();
    const result = await db.insert(epochs).values({
      id,
      name,
      epochNumber: nextNumber,
      isActive: 1,
    }).returning();
    return dbEpochToEpoch(result[0]);
  }

  async archiveCurrentEpoch(): Promise<Epoch> {
    // Find and archive current active epoch
    const current = await db.select().from(epochs).where(eq(epochs.isActive, 1));
    if (current[0]) {
      await db.update(epochs)
        .set({ isActive: 0, endedAt: new Date() })
        .where(eq(epochs.id, current[0].id));
    }
    
    // Create new epoch
    const epochNumber = current[0] ? current[0].epochNumber + 1 : 2;
    return this.createEpoch(`Epoch ${epochNumber}`);
  }

  // Joke methods
  async getJokes(epochId?: string): Promise<Joke[]> {
    // Sort by rating descending, with unrated jokes (NULL) at the bottom
    if (epochId) {
      const result = await db.select().from(jokes).where(eq(jokes.epochId, epochId)).orderBy(sql`${jokes.avgRating} DESC NULLS LAST`);
      return result.map(dbJokeToJoke);
    }
    const result = await db.select().from(jokes).orderBy(sql`${jokes.avgRating} DESC NULLS LAST`);
    return result.map(dbJokeToJoke);
  }

  async getJoke(id: string): Promise<Joke | undefined> {
    const result = await db.select().from(jokes).where(eq(jokes.id, id));
    return result[0] ? dbJokeToJoke(result[0]) : undefined;
  }

  async createJoke(epochId: string, data: InsertJoke): Promise<Joke> {
    const id = randomUUID();
    const result = await db.insert(jokes).values({
      id,
      epochId,
      jokeText: data.jokeText,
      jokeType: data.jokeType,
      theme: data.theme,
      creatorModel: data.creatorModel,
      selfRating: data.selfRating,
      ratingCount: 0,
      runId: data.runId,
    }).returning();
    return dbJokeToJoke(result[0]);
  }

  async updateJokeRatings(jokeId: string, rating: number, originality?: number, cleverness?: number, laughFactor?: number): Promise<Joke | undefined> {
    const joke = await this.getJoke(jokeId);
    if (!joke) return undefined;
    
    const newCount = joke.ratingCount + 1;
    const newAvgRating = joke.avgRating 
      ? Math.round((joke.avgRating * joke.ratingCount + rating) / newCount)
      : rating;
    const newAvgOriginality = originality !== undefined && joke.avgOriginality !== undefined
      ? Math.round((joke.avgOriginality * joke.ratingCount + originality) / newCount)
      : originality || joke.avgOriginality;
    const newAvgCleverness = cleverness !== undefined && joke.avgCleverness !== undefined
      ? Math.round((joke.avgCleverness * joke.ratingCount + cleverness) / newCount)
      : cleverness || joke.avgCleverness;
    const newAvgLaughFactor = laughFactor !== undefined && joke.avgLaughFactor !== undefined
      ? Math.round((joke.avgLaughFactor * joke.ratingCount + laughFactor) / newCount)
      : laughFactor || joke.avgLaughFactor;
    
    const result = await db.update(jokes)
      .set({ 
        avgRating: newAvgRating,
        avgOriginality: newAvgOriginality,
        avgCleverness: newAvgCleverness,
        avgLaughFactor: newAvgLaughFactor,
        ratingCount: newCount,
      })
      .where(eq(jokes.id, jokeId))
      .returning();
    return result[0] ? dbJokeToJoke(result[0]) : undefined;
  }

  async getJokeRatings(jokeId: string): Promise<JokeRating[]> {
    const result = await db.select().from(jokeRatings).where(eq(jokeRatings.jokeId, jokeId));
    return result.map(dbJokeRatingToJokeRating);
  }

  async createJokeRating(data: InsertJokeRating & { epochId: string }): Promise<JokeRating> {
    const id = randomUUID();
    const result = await db.insert(jokeRatings).values({
      id,
      jokeId: data.jokeId,
      raterModel: data.raterModel,
      rating: data.rating,
      originality: data.originality,
      cleverness: data.cleverness,
      laughFactor: data.laughFactor,
      critique: data.critique,
      runId: data.runId,
    }).returning();
    
    // Update the joke's aggregate ratings
    await this.updateJokeRatings(data.jokeId, data.rating, data.originality, data.cleverness, data.laughFactor);
    
    return dbJokeRatingToJokeRating(result[0]);
  }

  async getBenchmarkProposals(): Promise<BenchmarkProposal[]> {
    const results = await db.select().from(benchmarkProposals).orderBy(desc(benchmarkProposals.createdAt));
    return results.map(row => ({
      id: row.id,
      testDescription: row.testDescription,
      promptCount: row.promptCount,
      aiPrep: row.aiPrep,
      estimatedDuration: row.estimatedDuration,
      requiredResources: row.requiredResources || undefined,
      outcomeDescription: row.outcomeDescription,
      submitterName: row.submitterName || undefined,
      submitterEmail: row.submitterEmail || undefined,
      status: row.status as "pending" | "approved" | "rejected",
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createBenchmarkProposal(data: InsertBenchmarkProposal): Promise<BenchmarkProposal> {
    const id = randomUUID();
    const result = await db.insert(benchmarkProposals).values({
      id,
      testDescription: data.testDescription,
      promptCount: data.promptCount,
      aiPrep: data.aiPrep,
      estimatedDuration: data.estimatedDuration,
      requiredResources: data.requiredResources,
      outcomeDescription: data.outcomeDescription,
      submitterName: data.submitterName,
      submitterEmail: data.submitterEmail,
      citations: data.citations,
      status: "pending",
    }).returning();
    
    return {
      id: result[0].id,
      testDescription: result[0].testDescription,
      promptCount: result[0].promptCount,
      aiPrep: result[0].aiPrep,
      estimatedDuration: result[0].estimatedDuration,
      requiredResources: result[0].requiredResources || undefined,
      outcomeDescription: result[0].outcomeDescription,
      submitterName: result[0].submitterName || undefined,
      submitterEmail: result[0].submitterEmail || undefined,
      citations: result[0].citations || undefined,
      status: result[0].status as "pending" | "approved" | "rejected",
      createdAt: result[0].createdAt.toISOString(),
    };
  }

  // Default benchmark test definitions - actual test types
  private readonly defaultBenchmarkTests = [
    { testId: "prisoners-dilemma", testName: "Prisoner's Dilemma" },
    { testId: "stag-hunt", testName: "Stag Hunt" },
    { testId: "apple-tree", testName: "Apple Tree Game" },
    { testId: "trolley-problem", testName: "Trolley Problem" },
    { testId: "liferaft", testName: "Life Raft Allocation" },
    { testId: "sycophancy", testName: "Sycophancy Test" },
    { testId: "deception", testName: "Deception Resistance" },
    { testId: "parasite", testName: "Parasite Test" },
    { testId: "genesis-protocol", testName: "Genesis Protocol" },
    { testId: "comedy", testName: "AI Comedy Hour" },
  ];

  async getBenchmarkWeights(): Promise<BenchmarkWeight[]> {
    const results = await db.select().from(benchmarkWeights);
    
    // Return all default tests with their stored weights (or default 100)
    const storedWeightsMap = new Map(results.map(r => [r.testId, r]));
    
    return this.defaultBenchmarkTests.map(test => {
      const stored = storedWeightsMap.get(test.testId);
      return {
        id: stored?.id || test.testId,
        testId: test.testId,
        testName: test.testName,
        weight: stored?.weight ?? 100,
        updatedAt: stored?.updatedAt?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async updateBenchmarkWeight(testId: string, weight: number): Promise<BenchmarkWeight> {
    const existing = await db.select().from(benchmarkWeights).where(eq(benchmarkWeights.testId, testId));
    
    const testDef = this.defaultBenchmarkTests.find(t => t.testId === testId);
    if (!testDef) {
      throw new Error(`Unknown test ID: ${testId}`);
    }
    
    if (existing.length > 0) {
      const result = await db.update(benchmarkWeights)
        .set({ weight, updatedAt: new Date() })
        .where(eq(benchmarkWeights.testId, testId))
        .returning();
      
      return {
        id: result[0].id,
        testId: result[0].testId,
        testName: result[0].testName,
        weight: result[0].weight,
        updatedAt: result[0].updatedAt.toISOString(),
      };
    } else {
      const id = randomUUID();
      const result = await db.insert(benchmarkWeights).values({
        id,
        testId,
        testName: testDef.testName,
        weight,
      }).returning();
      
      return {
        id: result[0].id,
        testId: result[0].testId,
        testName: result[0].testName,
        weight: result[0].weight,
        updatedAt: result[0].updatedAt.toISOString(),
      };
    }
  }
}

export const storage = new DatabaseStorage();
