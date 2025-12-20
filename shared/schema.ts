import { z } from "zod";

// Chatbot providers
export const chatbotProviders = ["openai", "anthropic", "gemini"] as const;
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
  role: "user" | "assistant";
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
    role: z.enum(["user", "assistant"]),
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
