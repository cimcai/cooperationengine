import { z } from "zod";
import { pgTable, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";

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

// Chatbot providers
export const chatbotProviders = ["openai", "anthropic", "gemini", "xai"] as const;
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
