import { type Session, type Run, type Chatbot, type InsertSession, type InsertRun, type ChatbotResponse } from "@shared/schema";
import { randomUUID } from "crypto";

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
    displayName: "Grok 2",
    model: "grok-2-1212",
    description: "xAI's Grok model - requires XAI_API_KEY",
    enabled: !!process.env.XAI_API_KEY,
  },
];

export interface IStorage {
  // Sessions
  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;

  // Runs
  getRuns(): Promise<Run[]>;
  getRunsBySession(sessionId: string): Promise<Run[]>;
  getRun(id: string): Promise<Run | undefined>;
  createRun(data: InsertRun): Promise<Run>;
  updateRun(id: string, updates: Partial<Run>): Promise<Run | undefined>;
  addResponse(runId: string, response: ChatbotResponse): Promise<void>;
  deleteRun(id: string): Promise<void>;

  // Chatbots
  getChatbots(): Promise<Chatbot[]>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private runs: Map<string, Run>;

  constructor() {
    this.sessions = new Map();
    this.runs = new Map();
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(data: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      id,
      title: data.title,
      prompts: data.prompts,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updated = { ...session, ...data };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    // Also delete associated runs
    for (const [runId, run] of this.runs) {
      if (run.sessionId === id) {
        this.runs.delete(runId);
      }
    }
  }

  // Runs
  async getRuns(): Promise<Run[]> {
    return Array.from(this.runs.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  async getRunsBySession(sessionId: string): Promise<Run[]> {
    return Array.from(this.runs.values())
      .filter(r => r.sessionId === sessionId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getRun(id: string): Promise<Run | undefined> {
    return this.runs.get(id);
  }

  async createRun(data: InsertRun): Promise<Run> {
    const id = randomUUID();
    const run: Run = {
      id,
      sessionId: data.sessionId,
      chatbotIds: data.chatbotIds,
      status: "pending",
      startedAt: new Date().toISOString(),
      responses: [],
    };
    this.runs.set(id, run);
    return run;
  }

  async updateRun(id: string, updates: Partial<Run>): Promise<Run | undefined> {
    const run = this.runs.get(id);
    if (!run) return undefined;
    
    const updated = { ...run, ...updates };
    this.runs.set(id, updated);
    return updated;
  }

  async addResponse(runId: string, response: ChatbotResponse): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.responses.push(response);
      this.runs.set(runId, run);
    }
  }

  async deleteRun(id: string): Promise<void> {
    this.runs.delete(id);
  }

  // Chatbots
  async getChatbots(): Promise<Chatbot[]> {
    return availableChatbots;
  }
}

export const storage = new MemStorage();
