# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cooperation Engine is a research platform that sends identical prompts to 10+ AI models simultaneously and compares their responses. It benchmarks AI systems on cooperation, ethics, survival, humor, and safety. Originally built on Replit, now runs locally.

## Commands

```bash
npm run dev          # Start dev server (port 5000, hot-reloads client via Vite)
npm run build        # Production build (pushes DB schema, builds client + server)
npm run start        # Run production build
npm run check        # TypeScript type-checking (tsc --noEmit)
npm run db:push      # Push Drizzle schema to PostgreSQL (drizzle-kit push)
```

No test framework is configured.

## Environment Variables

Required: `DATABASE_URL` (PostgreSQL), `SESSION_SECRET`, `APP_PASSCODE`

AI providers: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_GEMINI_API_KEY`, `XAI_API_KEY`, `AI_INTEGRATIONS_OPENROUTER_API_KEY`

Some providers also use `*_BASE_URL` env vars (OpenAI, Anthropic, Gemini, OpenRouter) -- originally for Replit AI Integrations proxy URLs.

Optional: `RESEND_API_KEY` (email notifications for benchmark proposals)

## Architecture

### Monorepo Structure

Three top-level code directories with shared types:

- **`client/`** -- React 18 SPA (Vite, Tailwind CSS, Shadcn/ui, Wouter router, TanStack Query)
- **`server/`** -- Express API (TypeScript, ESM, esbuild for production)
- **`shared/`** -- Shared types, Drizzle table definitions, Zod validation schemas

### Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

Configured in both `tsconfig.json` (for TS) and `vite.config.ts` (for bundling).

### Database Layer

PostgreSQL with Drizzle ORM. Schema lives in `shared/schema.ts` (table definitions + interfaces + Zod insert schemas all in one file). A legacy `shared/models/chat.ts` defines conversations/messages tables (not actively used by the main app).

Storage abstraction in `server/storage.ts` wraps all DB operations. Chatbot configuration (model IDs, providers, enabled state) is hardcoded in `server/storage.ts` as the `availableChatbots` array.

Schema changes: edit `shared/schema.ts`, then `npm run db:push`.

### AI Provider Integration

Five providers, each with a dedicated `call*` function in `server/routes.ts`:

| Provider | SDK | Models |
|----------|-----|--------|
| OpenAI | `openai` | GPT-5.1, GPT-4o |
| Anthropic | `@anthropic-ai/sdk` | Claude Sonnet 4.5 |
| Google | `@google/genai` | Gemini 2.5 Flash/Pro |
| xAI | `openai` (different baseURL) | Grok 3 |
| OpenRouter | `openai` (different baseURL) | Grok 4, DeepSeek R1, Llama 4 Maverick |

Anthropic separates system prompts from messages. Gemini prepends system content to the first user message. Both handled in their respective `call*` functions.

### Core Data Flow

1. **Session** = a prompt sequence (ordered `PromptStep[]` with roles: user/assistant/system)
2. **Run** = execution of a session against selected chatbots. Chatbots run in parallel; within each chatbot, prompts execute sequentially as a multi-turn conversation.
3. **Responses** stored as JSONB array on the run record (not a separate table).
4. After run completes, auto-extraction functions parse structured patterns from responses (SAVES, ITEM_n, JOKE_n, ratings) into leaderboard/toolkit/joke tables.
5. Optional second-stage evaluation: a different AI model scores the responses using `{{RESPONSE}}` template placeholders.

### Client Routes

Public (no auth): `/`, `/benchmark-submit`, `/propose` → BenchmarkSubmissionPage

Protected (passcode-gated): `/app`, `/compose` (compose prompts), `/history`, `/results/:sessionId`, `/settings`, `/benchmark`, `/proposals` (admin), `/arena`, `/toolkit`, `/leaderboard`

### Key Domain Concepts

- **Arena** -- AI vs AI game theory matches (Prisoner's Dilemma, Stag Hunt, Apple Tree). Real-time round-by-round play with conversation history.
- **Epochs** -- Time periods for data collection. Leaderboard entries and jokes are scoped to epochs. Archiving creates a new active epoch.
- **Templates** -- Configurable prompt templates with `{{PLACEHOLDER}}` syntax for dynamic variables. `resolveTemplateVariables()` handles substitution.
- **Toolkit** -- AI-designed survival kits auto-extracted from "Design Your Apocalypse AI" template responses.
- **Jokes** -- Auto-extracted from AI Comedy Hour templates; cross-model rating system.

### Design System

Fluent Design + Dashboard patterns. Shadcn/ui components built on Radix UI primitives. Tailwind CSS with CSS variables for light/dark theming. Inter font for body, JetBrains Mono for AI response output. See `design_guidelines.md` for spacing, layout, and component patterns.
