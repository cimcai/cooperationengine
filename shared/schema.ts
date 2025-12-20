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
