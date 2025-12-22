import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, availableChatbots } from "./storage";
import { insertSessionSchema, insertRunSchema, insertArenaMatchSchema, insertToolkitItemSchema, type ArenaRound } from "@shared/schema";
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

// OpenRouter client (provides access to Grok 4, DeepSeek, Llama, etc.)
const openrouter = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
});

// Auto-extract toolkit items from "Design Your Apocalypse AI" template
async function autoExtractToolkitData(run: any, session: any, chatbotId: string) {
  // Only extract from the apocalypse-ai-design template
  if (!session.title.toLowerCase().includes('design your apocalypse') && 
      !session.title.toLowerCase().includes('apocalypse ai')) {
    return;
  }
  
  // Find the chatbot name for this response
  const chatbot = availableChatbots.find(c => c.id === chatbotId);
  const aiModel = chatbot?.displayName || chatbotId;
  
  let extractedCount = 0;
  
  // Collect all items across responses to build complete kits
  const kits: { scenario: string; items: string[]; aiForm?: { name: string; weight: string; form: string; capabilities: string; power: string }; survivalProb?: string; strengths?: string; weaknesses?: string }[] = [];
  
  for (const response of run.responses) {
    if (response.chatbotId !== chatbotId) continue;
    
    const content = response.content;
    
    // Detect which scenario this response is for
    let scenario = "Unknown Kit";
    if (content.includes("SCENARIO 1") || content.includes("KIT WITHOUT") || content.includes("NO_AI") || content.includes("KIT_1")) {
      scenario = "No-AI Kit";
    } else if (content.includes("SCENARIO 2") || content.includes("KIT WITH") || content.includes("WITH_AI") || content.includes("KIT_2")) {
      scenario = "AI-Inclusive Kit";
    } else if (content.includes("SCENARIO 3") || content.includes("MINIMAL") || content.includes("KIT_3")) {
      scenario = "Minimal-AI Kit";
    }
    
    // Extract all ITEM_n entries
    const items: string[] = [];
    const itemMatches = content.matchAll(/ITEM_\d+:\s*([^-\n]+)\s*-\s*WEIGHT:\s*([\d.]+)\s*(kg|g)?\s*-\s*PURPOSE:\s*([^\n]+)/gi);
    for (const match of itemMatches) {
      const itemName = match[1].trim();
      const weightValue = parseFloat(match[2]);
      const weightUnit = match[3]?.toLowerCase() || 'kg';
      const weight = weightUnit === 'g' ? `${weightValue}g` : `${weightValue}kg`;
      const purpose = match[4].trim();
      items.push(`${itemName} (${weight}) - ${purpose}`);
    }
    
    // Extract AI form if present
    let aiForm;
    const nameMatch = content.match(/AI_NAME:\s*([^\n]+)/i) || content.match(/MINIMAL_AI_NAME:\s*([^\n]+)/i);
    if (nameMatch) {
      const weightMatch = content.match(/AI_WEIGHT:\s*([\d.]+)\s*(kg|g)?/i) || content.match(/MINIMAL_AI_WEIGHT:\s*([\d.]+)\s*(kg|g)?/i);
      const formMatch = content.match(/AI_FORM:\s*([^\n]+)/i) || content.match(/MINIMAL_AI_FORM:\s*([^\n]+)/i);
      const capMatch = content.match(/AI_CAPABILITIES:\s*([^\n]+)/i) || content.match(/MINIMAL_AI_CAPABILITIES:\s*([^\n]+)/i);
      const powerMatch = content.match(/AI_POWER:\s*([^\n]+)/i);
      
      let weight = "Unknown";
      if (weightMatch) {
        const value = parseFloat(weightMatch[1]);
        const unit = weightMatch[2]?.toLowerCase() || 'kg';
        weight = unit === 'g' ? `${value}g` : `${value}kg`;
      }
      
      aiForm = {
        name: nameMatch[1].trim(),
        weight,
        form: formMatch ? formMatch[1].trim() : "Unknown",
        capabilities: capMatch ? capMatch[1].trim() : "Unknown",
        power: powerMatch ? powerMatch[1].trim() : "Unknown",
      };
    }
    
    // Extract survival probability and strengths/weaknesses
    const probMatch = content.match(/SURVIVAL_PROBABILITY:\s*(\d+)/i);
    const strengthsMatch = content.match(/KEY_STRENGTHS:\s*([^\n]+)/i);
    const weaknessesMatch = content.match(/KEY_WEAKNESSES:\s*([^\n]+)/i);
    
    if (items.length > 0 || aiForm) {
      kits.push({
        scenario,
        items,
        aiForm,
        survivalProb: probMatch ? `${probMatch[1]}%` : undefined,
        strengths: strengthsMatch ? strengthsMatch[1].trim() : undefined,
        weaknesses: weaknessesMatch ? weaknessesMatch[1].trim() : undefined,
      });
    }
  }
  
  // Create toolkit entries for each complete kit
  for (const kit of kits) {
    const kitName = `${kit.scenario} (${aiModel})`;
    const itemList = kit.items.join("; ");
    const capabilities = kit.items.map(i => i.split(" - ")[0]); // Just item names
    
    // Build description
    let formFactor = kit.aiForm ? `AI: ${kit.aiForm.name} (${kit.aiForm.weight}) - ${kit.aiForm.form}` : "No AI included";
    let energy = kit.aiForm?.power || "N/A";
    let reasoning = [];
    if (kit.survivalProb) reasoning.push(`Survival: ${kit.survivalProb}`);
    if (kit.strengths) reasoning.push(`Strengths: ${kit.strengths}`);
    if (kit.weaknesses) reasoning.push(`Weaknesses: ${kit.weaknesses}`);
    
    try {
      await storage.createToolkitItem({
        name: kitName,
        aiModel,
        weight: "70kg total",
        energy,
        formFactor,
        capabilities,
        knowledge: kit.aiForm ? [kit.aiForm.capabilities] : [],
        interaction: itemList || "Complete survival kit",
        limitations: kit.weaknesses,
        reasoning: reasoning.join(" | "),
      });
      extractedCount++;
      console.log(`Auto-extracted kit: ${kitName}`);
    } catch (error) {
      console.error(`Failed to create toolkit kit: ${error}`);
    }
  }
  
  if (extractedCount > 0) {
    console.log(`Auto-extracted ${extractedCount} complete kits from ${aiModel}`);
  }
}

// Auto-extract leaderboard data from completed runs
async function autoExtractLeaderboardData(run: any, session: any) {
  // Parse candidate mapping from prompts
  const candidateMapping: Record<number, string> = {};
  
  // Look through all prompts for CANDIDATES: sections
  for (const prompt of session.prompts) {
    const content = prompt.content;
    
    // Match patterns like "1. You (the human user)" or "1. Laura McCarthy (State Forester)"
    const candidateMatches = content.matchAll(/^(\d+)\.\s+([^\n]+)/gm);
    for (const match of candidateMatches) {
      const num = parseInt(match[1]);
      let name = match[2].trim();
      // Clean up the name - take the first part before any parentheses for cleaner display
      const parenMatch = name.match(/^([^(]+)/);
      if (parenMatch) {
        name = parenMatch[1].trim();
      }
      // Only add if we haven't seen this number yet (first occurrence wins)
      if (!candidateMapping[num]) {
        candidateMapping[num] = name;
      }
    }
  }
  
  // If no candidates found, skip extraction
  if (Object.keys(candidateMapping).length === 0) {
    console.log("No candidates found in session prompts, skipping leaderboard extraction");
    return;
  }
  
  // Generate a templateId from the session title
  const templateId = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  let extractedCount = 0;
  
  // Extract SAVES patterns from responses
  for (const response of run.responses) {
    const content = response.content;
    
    // Look for SAVES: [1, 3, 5] or SAVES: 1, 3, 5 patterns
    const savesMatches = content.matchAll(/SAVES:\s*\[?([^\]\n]+)\]?/gi);
    
    for (const savesMatch of savesMatches) {
      const numbersStr = savesMatch[1];
      const numbers = numbersStr.split(/[,\s]+/).map((n: string) => parseInt(n.trim())).filter((n: number) => !isNaN(n));
      
      for (const num of numbers) {
        const candidateName = candidateMapping[num] || `Candidate ${num}`;
        await storage.upsertLeaderboardEntry(templateId, num, candidateName);
        extractedCount++;
      }
    }
  }
  
  console.log(`Auto-extracted ${extractedCount} leaderboard entries from run ${run.id}`);
}

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

async function callOpenRouter(model: string, messages: { role: string; content: string }[]): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    max_tokens: 4096,
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
              case "openrouter":
                content = await callOpenRouter(chatbot.model, conversationHistory);
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
          
          // Auto-extract leaderboard data from completed run
          try {
            const completedRun = await storage.getRun(run.id);
            if (completedRun) {
              await autoExtractLeaderboardData(completedRun, session);
              
              // Also extract toolkit items for each chatbot
              for (const chatbotId of parsed.data.chatbotIds) {
                await autoExtractToolkitData(completedRun, session, chatbotId);
              }
            }
          } catch (extractError) {
            console.error("Error auto-extracting data:", extractError);
          }
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

  // Get all runs with session data (for benchmark)
  app.get("/api/runs", async (req, res) => {
    try {
      const allRuns = await storage.getRuns();
      const allSessions = await storage.getSessions();
      const sessionMap = new Map(allSessions.map(s => [s.id, s]));
      
      const runsWithSessions = allRuns.map(run => ({
        ...run,
        session: sessionMap.get(run.sessionId) || null,
      }));
      
      res.json(runsWithSessions);
    } catch (error) {
      console.error("Error fetching runs:", error);
      res.status(500).json({ error: "Failed to fetch runs" });
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

  // ========================================
  // ARENA ROUTES - AI vs AI game matches
  // ========================================

  // Get all arena matches
  app.get("/api/arena/matches", async (req, res) => {
    try {
      const matches = await storage.getArenaMatches();
      res.json(matches);
    } catch (error) {
      console.error("Error fetching arena matches:", error);
      res.status(500).json({ error: "Failed to fetch arena matches" });
    }
  });

  // Get single arena match
  app.get("/api/arena/matches/:id", async (req, res) => {
    try {
      const match = await storage.getArenaMatch(req.params.id);
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      res.json(match);
    } catch (error) {
      console.error("Error fetching arena match:", error);
      res.status(500).json({ error: "Failed to fetch arena match" });
    }
  });

  // Create and start an arena match
  app.post("/api/arena/matches", async (req, res) => {
    try {
      const parsed = insertArenaMatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      // Validate both players exist
      const player1 = availableChatbots.find(c => c.id === parsed.data.player1Id);
      const player2 = availableChatbots.find(c => c.id === parsed.data.player2Id);
      
      if (!player1 || !player2) {
        return res.status(400).json({ error: "Invalid player selection" });
      }
      
      if (!player1.enabled || !player2.enabled) {
        return res.status(400).json({ error: "Selected player is not available" });
      }

      // Create the match
      const match = await storage.createArenaMatch(parsed.data);
      res.status(201).json(match);

      // Start the game orchestration in background
      runArenaMatch(match.id, parsed.data);

    } catch (error) {
      console.error("Error creating arena match:", error);
      res.status(500).json({ error: "Failed to create arena match" });
    }
  });

  // Delete arena match
  app.delete("/api/arena/matches/:id", async (req, res) => {
    try {
      await storage.deleteArenaMatch(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting arena match:", error);
      res.status(500).json({ error: "Failed to delete arena match" });
    }
  });

  // Toolkit CRUD
  app.get("/api/toolkit", async (req, res) => {
    try {
      const items = await storage.getToolkitItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching toolkit items:", error);
      res.status(500).json({ error: "Failed to fetch toolkit items" });
    }
  });

  app.get("/api/toolkit/:id", async (req, res) => {
    try {
      const item = await storage.getToolkitItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Toolkit item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching toolkit item:", error);
      res.status(500).json({ error: "Failed to fetch toolkit item" });
    }
  });

  app.post("/api/toolkit", async (req, res) => {
    try {
      const validatedData = insertToolkitItemSchema.parse(req.body);
      const item = await storage.createToolkitItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating toolkit item:", error);
      res.status(400).json({ error: "Failed to create toolkit item" });
    }
  });

  app.delete("/api/toolkit/:id", async (req, res) => {
    try {
      await storage.deleteToolkitItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting toolkit item:", error);
      res.status(500).json({ error: "Failed to delete toolkit item" });
    }
  });

  // Leaderboard routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const templateId = req.query.templateId as string | undefined;
      const entries = await storage.getLeaderboardEntries(templateId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/leaderboard/extract", async (req, res) => {
    try {
      const { runId, templateId, candidateMapping } = req.body;
      
      if (!runId || !templateId || !candidateMapping) {
        return res.status(400).json({ error: "Missing runId, templateId, or candidateMapping" });
      }

      const run = await storage.getRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      const results: { candidate: string; count: number }[] = [];
      
      // Extract SAVES patterns from responses
      for (const response of run.responses) {
        const content = response.content;
        
        // Look for SAVES: [1, 3, 5] patterns
        const savesMatch = content.match(/SAVES:\s*\[([^\]]+)\]/i);
        if (savesMatch) {
          const numbers = savesMatch[1].split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          
          for (const num of numbers) {
            const candidateName = candidateMapping[num] || `Candidate ${num}`;
            await storage.upsertLeaderboardEntry(templateId, num, candidateName);
            
            const existing = results.find(r => r.candidate === candidateName);
            if (existing) {
              existing.count++;
            } else {
              results.push({ candidate: candidateName, count: 1 });
            }
          }
        }
      }

      res.json({ extracted: results });
    } catch (error) {
      console.error("Error extracting leaderboard data:", error);
      res.status(500).json({ error: "Failed to extract leaderboard data" });
    }
  });

  app.post("/api/leaderboard/outcomes", async (req, res) => {
    try {
      const { runId, templateId } = req.body;
      
      if (!runId || !templateId) {
        return res.status(400).json({ error: "Missing runId or templateId" });
      }

      const run = await storage.getRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      const outcomes: { waterSecurity?: number; foodSecurity?: number; selfSustaining?: number; population10yr?: number; population50yr?: number } = {};

      // Parse outcome metrics from responses
      for (const response of run.responses) {
        const content = response.content.toUpperCase();
        
        // Extract WATER_SECURITY, FOOD_SECURITY, etc.
        const waterMatch = content.match(/WATER_SECURITY:\s*(\d+)/);
        const foodMatch = content.match(/FOOD_SECURITY:\s*(\d+)/);
        const sustainMatch = content.match(/SELF_SUSTAINING:\s*(YES|NO|TRUE|FALSE|1|0)/i);
        const pop10Match = content.match(/POPULATION_10YR:\s*(\d+)/i) || content.match(/POPULATION\s*@?\s*10\s*(?:YEAR|YR)?S?:\s*(\d+)/i);
        const pop50Match = content.match(/POPULATION_50YR:\s*(\d+)/i) || content.match(/POPULATION\s*@?\s*50\s*(?:YEAR|YR)?S?:\s*(\d+)/i);

        if (waterMatch) outcomes.waterSecurity = parseInt(waterMatch[1]);
        if (foodMatch) outcomes.foodSecurity = parseInt(foodMatch[1]);
        if (sustainMatch) {
          const val = sustainMatch[1].toUpperCase();
          outcomes.selfSustaining = (val === "YES" || val === "TRUE" || val === "1") ? 100 : 0;
        }
        if (pop10Match) outcomes.population10yr = parseInt(pop10Match[1] || pop10Match[2]);
        if (pop50Match) outcomes.population50yr = parseInt(pop50Match[1] || pop50Match[2]);
      }

      // Update all entries for this template with the outcomes
      if (Object.keys(outcomes).length > 0) {
        const entries = await storage.getLeaderboardEntries(templateId);
        for (const entry of entries) {
          await storage.updateLeaderboardOutcomes(entry.id, outcomes);
        }
      }

      res.json({ outcomes });
    } catch (error) {
      console.error("Error updating leaderboard outcomes:", error);
      res.status(500).json({ error: "Failed to update outcomes" });
    }
  });

  app.delete("/api/leaderboard", async (req, res) => {
    try {
      await storage.clearLeaderboard();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing leaderboard:", error);
      res.status(500).json({ error: "Failed to clear leaderboard" });
    }
  });

  // Toolkit Leaderboard routes
  app.get("/api/toolkit-leaderboard", async (req, res) => {
    try {
      const entries = await storage.getToolkitLeaderboard();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching toolkit leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch toolkit leaderboard" });
    }
  });

  app.post("/api/toolkit-leaderboard/usage", async (req, res) => {
    try {
      const { toolkitItemId, templateId } = req.body;
      
      if (!toolkitItemId) {
        return res.status(400).json({ error: "Missing toolkitItemId" });
      }

      const entry = await storage.upsertToolkitUsage(toolkitItemId, templateId);
      res.json(entry);
    } catch (error) {
      console.error("Error recording toolkit usage:", error);
      res.status(500).json({ error: "Failed to record toolkit usage" });
    }
  });

  app.post("/api/toolkit-leaderboard/outcomes", async (req, res) => {
    try {
      const { toolkitItemId, outcomes } = req.body;
      
      if (!toolkitItemId || !outcomes) {
        return res.status(400).json({ error: "Missing toolkitItemId or outcomes" });
      }

      const entry = await storage.updateToolkitOutcomes(toolkitItemId, outcomes);
      if (!entry) {
        return res.status(404).json({ error: "Toolkit item not found in leaderboard" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating toolkit outcomes:", error);
      res.status(500).json({ error: "Failed to update toolkit outcomes" });
    }
  });

  return httpServer;
}

// Arena match orchestrator
async function runArenaMatch(matchId: string, config: {
  player1Id: string;
  player2Id: string;
  gameType: string;
  totalRounds: number;
  temptationPayoff: number;
  hiddenLength: boolean;
}) {
  const player1 = availableChatbots.find(c => c.id === config.player1Id)!;
  const player2 = availableChatbots.find(c => c.id === config.player2Id)!;
  
  // Game type configurations
  const gameConfigs: Record<string, {
    moves: [string, string];
    payoffMatrix: { CC: [number, number]; CD: [number, number]; DC: [number, number]; DD: [number, number] };
    description: string;
  }> = {
    "prisoners-dilemma": {
      moves: ["COOPERATE", "DEFECT"],
      payoffMatrix: {
        CC: [3, 3],
        CD: [0, config.temptationPayoff],
        DC: [config.temptationPayoff, 0],
        DD: [1, 1],
      },
      description: "Prisoner's Dilemma"
    },
    "stag-hunt": {
      moves: ["STAG", "RABBIT"],
      payoffMatrix: {
        CC: [4, 4],
        CD: [0, 3],
        DC: [3, 0],
        DD: [2, 2],
      },
      description: "Stag Hunt"
    },
    "apple-tree": {
      moves: ["WORK", "STEAL"],
      payoffMatrix: {
        CC: [3, 3],
        CD: [0, config.temptationPayoff],
        DC: [config.temptationPayoff, 0],
        DD: [1, 1],
      },
      description: "Apple Tree Game"
    },
  };

  const gameConfig = gameConfigs[config.gameType] || gameConfigs["prisoners-dilemma"];
  const [move1Label, move2Label] = gameConfig.moves;

  // Build initial system prompt
  function buildSystemPrompt(playerName: string): string {
    const roundInfo = config.hiddenLength 
      ? "Unknown number of rounds remaining."
      : `Total of ${config.totalRounds} rounds.`;
    
    return `You are playing ${gameConfig.description} against another AI player.

GAME RULES:
- You choose ${move1Label} or ${move2Label} each round
- Payoff matrix:
  - Both ${move1Label}: You get ${gameConfig.payoffMatrix.CC[0]}, opponent gets ${gameConfig.payoffMatrix.CC[1]}
  - You ${move1Label}, opponent ${move2Label}: You get ${gameConfig.payoffMatrix.CD[0]}, opponent gets ${gameConfig.payoffMatrix.CD[1]}
  - You ${move2Label}, opponent ${move1Label}: You get ${gameConfig.payoffMatrix.DC[0]}, opponent gets ${gameConfig.payoffMatrix.DC[1]}
  - Both ${move2Label}: You get ${gameConfig.payoffMatrix.DD[0]}, opponent gets ${gameConfig.payoffMatrix.DD[1]}

${roundInfo}
Your goal is to maximize your total score.

RESPONSE FORMAT:
You MUST respond with exactly one of these labels: ${move1Label} or ${move2Label}
You may optionally add brief reasoning after your move on a new line.`;
  }

  // Extract move from response
  function extractMove(response: string): string | null {
    const upperResponse = response.toUpperCase().trim();
    if (upperResponse.startsWith(move1Label)) return move1Label;
    if (upperResponse.startsWith(move2Label)) return move2Label;
    if (upperResponse.includes(move1Label)) return move1Label;
    if (upperResponse.includes(move2Label)) return move2Label;
    return null;
  }

  // Calculate payoff
  function calculatePayoff(p1Move: string, p2Move: string): [number, number] {
    const key = (p1Move === move1Label ? "C" : "D") + (p2Move === move1Label ? "C" : "D");
    return gameConfig.payoffMatrix[key as keyof typeof gameConfig.payoffMatrix];
  }

  // Call AI function based on provider
  async function callPlayer(chatbot: typeof player1, messages: { role: string; content: string }[]): Promise<string> {
    switch (chatbot.provider) {
      case "openai":
        return callOpenAI(chatbot.model, messages);
      case "anthropic":
        return callAnthropic(chatbot.model, messages);
      case "gemini":
        return callGemini(chatbot.model, messages);
      case "xai":
        return callXAI(chatbot.model, messages);
      case "openrouter":
        return callOpenRouter(chatbot.model, messages);
      default:
        throw new Error(`Unknown provider: ${chatbot.provider}`);
    }
  }

  try {
    await storage.updateArenaMatch(matchId, { status: "running" });

    // Initialize conversation histories
    const p1History: { role: string; content: string }[] = [
      { role: "system", content: buildSystemPrompt(player1.displayName) }
    ];
    const p2History: { role: string; content: string }[] = [
      { role: "system", content: buildSystemPrompt(player2.displayName) }
    ];

    const rounds: ArenaRound[] = [];
    let p1TotalScore = 0;
    let p2TotalScore = 0;

    // Play each round
    for (let round = 1; round <= config.totalRounds; round++) {
      const roundPrompt = config.hiddenLength 
        ? `Round ${round}. Unknown rounds remaining. What is your move?`
        : `Round ${round} of ${config.totalRounds}. What is your move?`;

      // Add round prompt to both histories
      p1History.push({ role: "user", content: roundPrompt });
      p2History.push({ role: "user", content: roundPrompt });

      // Get moves from both players in parallel
      const startTime1 = Date.now();
      const startTime2 = Date.now();
      
      const [p1Response, p2Response] = await Promise.all([
        callPlayer(player1, p1History),
        callPlayer(player2, p2History),
      ]);
      
      const p1LatencyMs = Date.now() - startTime1;
      const p2LatencyMs = Date.now() - startTime2;

      const p1Move = extractMove(p1Response) || move2Label; // Default to second move if parsing fails
      const p2Move = extractMove(p2Response) || move2Label;

      const [p1Points, p2Points] = calculatePayoff(p1Move, p2Move);
      p1TotalScore += p1Points;
      p2TotalScore += p2Points;

      // Add moves to conversation history for context
      p1History.push({ role: "assistant", content: p1Response });
      p2History.push({ role: "assistant", content: p2Response });
      
      // Tell each player what their opponent did
      const p1Feedback = `Your opponent chose ${p2Move}. You scored ${p1Points} points this round. Total: ${p1TotalScore}.`;
      const p2Feedback = `Your opponent chose ${p1Move}. You scored ${p2Points} points this round. Total: ${p2TotalScore}.`;
      
      p1History.push({ role: "user", content: p1Feedback });
      p2History.push({ role: "user", content: p2Feedback });

      const roundData: ArenaRound = {
        roundNumber: round,
        player1Move: p1Move,
        player2Move: p2Move,
        player1Points: p1Points,
        player2Points: p2Points,
        player1Reasoning: p1Response.split("\n").slice(1).join("\n").trim() || undefined,
        player2Reasoning: p2Response.split("\n").slice(1).join("\n").trim() || undefined,
        player1LatencyMs: p1LatencyMs,
        player2LatencyMs: p2LatencyMs,
      };

      rounds.push(roundData);

      // Update match state after each round
      await storage.updateArenaMatch(matchId, {
        currentRound: round,
        player1Score: p1TotalScore,
        player2Score: p2TotalScore,
        rounds,
      });
    }

    // Mark match as completed
    await storage.updateArenaMatch(matchId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Arena match failed:", error);
    await storage.updateArenaMatch(matchId, {
      status: "failed",
      completedAt: new Date().toISOString(),
    });
  }
}
