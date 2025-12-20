import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, availableChatbots } from "./storage";
import { insertSessionSchema, insertRunSchema } from "@shared/schema";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// xAI client (uses OpenAI SDK with different base URL)
const xai = process.env.XAI_API_KEY ? new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
}) : null;

// AI Provider functions
async function callOpenAI(model: string, messages: { role: string; content: string }[]): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    max_completion_tokens: 2048,
  });
  return response.choices[0]?.message?.content || "";
}

async function callAnthropic(model: string, messages: { role: string; content: string }[]): Promise<string> {
  // Anthropic handles system prompts separately
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");
  
  const systemPrompt = systemMessages.map(m => m.content).join("\n\n") || undefined;
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: conversationMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });
  const content = response.content[0];
  return content.type === "text" ? content.text : "";
}

async function callGemini(model: string, messages: { role: string; content: string }[]): Promise<string> {
  // For Gemini, prepend system instructions to the first user message
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");
  
  const systemPrefix = systemMessages.length > 0 
    ? systemMessages.map(m => m.content).join("\n\n") + "\n\n---\n\n"
    : "";
  
  const contents = conversationMessages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: i === 0 && systemPrefix ? systemPrefix + m.content : m.content }],
  }));
  
  const response = await gemini.models.generateContent({
    model,
    contents,
  });
  
  return response.text || "";
}

async function callXAI(model: string, messages: { role: string; content: string }[]): Promise<string> {
  if (!xai) {
    throw new Error("XAI_API_KEY not configured");
  }
  const response = await xai.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    max_tokens: 2048,
  });
  return response.choices[0]?.message?.content || "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get available chatbots
  app.get("/api/chatbots", async (req, res) => {
    try {
      const chatbots = await storage.getChatbots();
      res.json(chatbots);
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      res.status(500).json({ error: "Failed to fetch chatbots" });
    }
  });

  // Sessions CRUD
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const parsed = insertSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const session = await storage.createSession(parsed.data);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.put("/api/sessions/:id", async (req, res) => {
    try {
      const parsed = insertSessionSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const session = await storage.updateSession(req.params.id, parsed.data);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      await storage.deleteSession(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Run a session against selected chatbots
  app.post("/api/sessions/:id/run", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const parsed = insertRunSchema.safeParse({
        sessionId: req.params.id,
        chatbotIds: req.body.chatbotIds,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      // Create the run
      const run = await storage.createRun(parsed.data);
      await storage.updateRun(run.id, { status: "running" });

      // Send response immediately so client can poll for results
      res.status(201).json(run);

      // Get prompts sorted by order
      const sortedPrompts = session.prompts.sort((a, b) => a.order - b.order);

      // Process each chatbot - they run in parallel, but each chatbot processes rounds sequentially
      const chatbotPromises = parsed.data.chatbotIds.map(async (chatbotId) => {
        const chatbot = availableChatbots.find(c => c.id === chatbotId);
        if (!chatbot) return;

        // Build conversation history as we go through rounds
        const conversationHistory: { role: string; content: string }[] = [];
        
        // Track user-visible round index (excludes system prompts)
        let roundIndex = 0;

        // Process each prompt/round sequentially for this chatbot
        for (let i = 0; i < sortedPrompts.length; i++) {
          const prompt = sortedPrompts[i];
          
          // Add this prompt to conversation history
          conversationHistory.push({ role: prompt.role, content: prompt.content });

          // Skip API calls for system prompts - they're just context
          if (prompt.role === "system") {
            continue;
          }

          const startTime = Date.now();
          try {
            let content = "";
            
            switch (chatbot.provider) {
              case "openai":
                content = await callOpenAI(chatbot.model, conversationHistory);
                break;
              case "anthropic":
                content = await callAnthropic(chatbot.model, conversationHistory);
                break;
              case "gemini":
                content = await callGemini(chatbot.model, conversationHistory);
                break;
              case "xai":
                content = await callXAI(chatbot.model, conversationHistory);
                break;
            }

            const latencyMs = Date.now() - startTime;
            
            // Store this round's response (using roundIndex for user-visible rounds)
            await storage.addResponse(run.id, {
              chatbotId,
              stepOrder: roundIndex,
              content,
              latencyMs,
            });

            // Add AI's response to conversation history for next round
            conversationHistory.push({ role: "assistant", content });
            roundIndex++;

          } catch (error) {
            const latencyMs = Date.now() - startTime;
            await storage.addResponse(run.id, {
              chatbotId,
              stepOrder: roundIndex,
              content: "",
              latencyMs,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            // Don't add error responses to conversation history, but continue with next rounds
            roundIndex++;
          }
        }
      });

      Promise.all(chatbotPromises)
        .then(async () => {
          await storage.updateRun(run.id, {
            status: "completed",
            completedAt: new Date().toISOString(),
          });
        })
        .catch(async (error) => {
          console.error("Run failed:", error);
          await storage.updateRun(run.id, {
            status: "failed",
            completedAt: new Date().toISOString(),
          });
        });

    } catch (error) {
      console.error("Error starting run:", error);
      res.status(500).json({ error: "Failed to start run" });
    }
  });

  // Get run status and results
  app.get("/api/runs/:id", async (req, res) => {
    try {
      const run = await storage.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Error fetching run:", error);
      res.status(500).json({ error: "Failed to fetch run" });
    }
  });

  app.delete("/api/runs/:id", async (req, res) => {
    try {
      await storage.deleteRun(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting run:", error);
      res.status(500).json({ error: "Failed to delete run" });
    }
  });

  // Get all runs for a session (for results grid)
  app.get("/api/sessions/:id/results", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const runs = await storage.getRunsBySession(req.params.id);
      
      // Get prompts excluding system prompts for round labels
      const userPrompts = session.prompts
        .filter(p => p.role !== "system")
        .sort((a, b) => a.order - b.order);
      
      res.json({
        session,
        runs: runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
        roundLabels: userPrompts.map((p, i) => ({
          round: i,
          prompt: p.content,
        })),
      });
    } catch (error) {
      console.error("Error fetching session results:", error);
      res.status(500).json({ error: "Failed to fetch session results" });
    }
  });

  // Get history (runs with sessions)
  app.get("/api/history", async (req, res) => {
    try {
      const runs = await storage.getRuns();
      const history = await Promise.all(
        runs.map(async (run) => {
          const session = await storage.getSession(run.sessionId);
          return { run, session };
        })
      );
      res.json(history.filter(h => h.session)); // Filter out orphaned runs
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  return httpServer;
}
