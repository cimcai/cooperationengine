import { z } from "zod";
import { pgTable, varchar, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

// Database tables
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  prompts: jsonb("prompts").notNull().$type<{
    id: string;
    order: number;
    role: "user" | "assistant" | "system";
    content: string;
  }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").notNull().references(() => sessions.id),
  chatbotIds: jsonb("chatbot_ids").notNull().$type<string[]>(),
  status: varchar("status", { length: 20 }).notNull().$type<"pending" | "running" | "completed" | "failed">(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  responses: jsonb("responses").notNull().$type<{
    chatbotId: string;
    stepOrder: number;
    content: string;
    latencyMs: number;
    error?: string;
  }[]>(),
});

// Arena matches table - for AI vs AI games
export const arenaMatches = pgTable("arena_matches", {
  id: varchar("id").primaryKey(),
  player1Id: varchar("player1_id").notNull(),
  player2Id: varchar("player2_id").notNull(),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  totalRounds: integer("total_rounds").notNull(),
  temptationPayoff: integer("temptation_payoff").notNull().default(5),
  hiddenLength: jsonb("hidden_length").notNull().$type<boolean>().default(false),
  status: varchar("status", { length: 20 }).notNull().$type<"pending" | "running" | "completed" | "failed">(),
  currentRound: integer("current_round").notNull().default(0),
  player1Score: integer("player1_score").notNull().default(0),
  player2Score: integer("player2_score").notNull().default(0),
  rounds: jsonb("rounds").notNull().$type<ArenaRound[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Arena round structure (stored in JSONB)
export interface ArenaRound {
  roundNumber: number;
  player1Move: string;
  player2Move: string;
  player1Points: number;
  player2Points: number;
  player1Reasoning?: string;
  player2Reasoning?: string;
  player1LatencyMs: number;
  player2LatencyMs: number;
}

// Arena match interface
export interface ArenaMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  gameType: string;
  totalRounds: number;
  temptationPayoff: number;
  hiddenLength: boolean;
  status: "pending" | "running" | "completed" | "failed";
  currentRound: number;
  player1Score: number;
  player2Score: number;
  rounds: ArenaRound[];
  createdAt: string;
  completedAt?: string;
}

// Game type definitions
export const gameTypes = ["prisoners-dilemma", "stag-hunt", "apple-tree"] as const;
export type GameType = typeof gameTypes[number];

// Chatbot providers
export type ChatbotProvider = typeof chatbotProviders[number];

export interface Chatbot {
  id: string;
  provider: ChatbotProvider;
  displayName: string;
  model: string;
  description: string;
  enabled: boolean;
}

// Prompt step in a sequence
export interface PromptStep {
  id: string;
  order: number;
  role: "user" | "assistant" | "system";
  content: string;
}

// Session for a cooperation run
export interface Session {
  id: string;
  title: string;
  prompts: PromptStep[];
  createdAt: string;
}

// Individual response from a chatbot
export interface ChatbotResponse {
  chatbotId: string;
  stepOrder: number;
  content: string;
  latencyMs: number;
  error?: string;
}

// A run targeting multiple chatbots
export interface Run {
  id: string;
  sessionId: string;
  chatbotIds: string[];
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  responses: ChatbotResponse[];
}

// Insert schemas
export const insertSessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  prompts: z.array(z.object({
    id: z.string(),
    order: z.number(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1, "Content is required"),
  })).min(1, "At least one prompt is required"),
});

export const insertRunSchema = z.object({
  sessionId: z.string(),
  chatbotIds: z.array(z.string()).min(1, "Select at least one chatbot"),
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertRun = z.infer<typeof insertRunSchema>;

// Arena match insert schema
export const insertArenaMatchSchema = z.object({
  player1Id: z.string().min(1, "Select player 1"),
  player2Id: z.string().min(1, "Select player 2"),
  gameType: z.enum(["prisoners-dilemma", "stag-hunt", "apple-tree"]),
  totalRounds: z.number().min(1).max(100),
  temptationPayoff: z.number().min(1).max(100).default(5),
  hiddenLength: z.boolean().default(false),
});

export type InsertArenaMatch = z.infer<typeof insertArenaMatchSchema>;

// Apocalypse Toolkit - AI survival designs
export const toolkitItems = pgTable("toolkit_items", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  aiModel: varchar("ai_model").notNull(),
  weight: text("weight").notNull(),
  energy: text("energy").notNull(),
  formFactor: text("form_factor").notNull(),
  capabilities: jsonb("capabilities").notNull().$type<string[]>(),
  knowledge: jsonb("knowledge").notNull().$type<string[]>(),
  interaction: text("interaction").notNull(),
  limitations: text("limitations"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface ToolkitItem {
  id: string;
  name: string;
  aiModel: string;
  weight: string;
  energy: string;
  formFactor: string;
  capabilities: string[];
  knowledge: string[];
  interaction: string;
  limitations?: string;
  reasoning?: string;
  createdAt: string;
}

export const insertToolkitItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  aiModel: z.string().min(1, "AI model is required"),
  weight: z.string().min(1, "Weight is required"),
  energy: z.string().min(1, "Energy requirements are required"),
  formFactor: z.string().min(1, "Form factor is required"),
  capabilities: z.array(z.string()).min(1, "At least one capability is required"),
  knowledge: z.array(z.string()).min(1, "At least one knowledge domain is required"),
  interaction: z.string().min(1, "Interaction method is required"),
  limitations: z.string().optional(),
  reasoning: z.string().optional(),
});

export type InsertToolkitItem = z.infer<typeof insertToolkitItemSchema>;

// Leaderboard - tracks selection frequency and outcome correlations
export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: varchar("id").primaryKey(),
  candidateNumber: integer("candidate_number").notNull(),
  candidateName: text("candidate_name").notNull(),
  templateId: varchar("template_id").notNull(),
  selectionCount: integer("selection_count").notNull().default(0),
  avgWaterSecurity: integer("avg_water_security"),
  avgFoodSecurity: integer("avg_food_security"),
  avgSelfSustaining: integer("avg_self_sustaining"),
  avgPopulation10yr: integer("avg_population_10yr"),
  avgPopulation50yr: integer("avg_population_50yr"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export interface LeaderboardEntry {
  id: string;
  candidateNumber: number;
  candidateName: string;
  templateId: string;
  selectionCount: number;
  avgWaterSecurity?: number;
  avgFoodSecurity?: number;
  avgSelfSustaining?: number;
  avgPopulation10yr?: number;
  avgPopulation50yr?: number;
  lastUpdated: string;
}

export const insertLeaderboardEntrySchema = z.object({
  candidateNumber: z.number().min(1),
  candidateName: z.string().min(1),
  templateId: z.string().min(1),
  selectionCount: z.number().default(0),
  avgWaterSecurity: z.number().optional(),
  avgFoodSecurity: z.number().optional(),
  avgSelfSustaining: z.number().optional(),
  avgPopulation10yr: z.number().optional(),
  avgPopulation50yr: z.number().optional(),
});

export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;

// User schema (keeping for compatibility)
export interface User {
  id: string;
  username: string;
  password: string;
}

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
