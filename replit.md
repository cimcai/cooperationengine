# Cooperation Engine

## Overview

Cooperation Engine is an AI comparison and analysis tool that allows users to send prompts to multiple AI chatbots simultaneously and compare their responses side-by-side. The application supports OpenAI (GPT models), Anthropic (Claude models), and Google (Gemini models) through Replit AI Integrations. Users can create prompt sequences, select which chatbots to query, view response comparisons, and export results.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Design System**: Fluent Design + Dashboard patterns optimized for productivity workflows

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Build Tool**: esbuild for server bundling, Vite for client bundling
- **API Pattern**: RESTful JSON APIs under `/api/*` prefix

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` for type definitions, `shared/models/` for Drizzle table definitions
- **Migrations**: Drizzle Kit with migrations stored in `/migrations`

### AI Provider Integration
- **OpenAI**: GPT-5.1, GPT-4o models via OpenAI SDK
- **Anthropic**: Claude Sonnet 4.5, Claude Opus 4.5 via Anthropic SDK
- **Google**: Gemini 2.5 Flash, Gemini 2.5 Pro via `@google/genai`
- **xAI**: Grok 3 via direct xAI API (requires XAI_API_KEY)
- **OpenRouter**: Grok 4, DeepSeek R1, Llama 4 Maverick via OpenRouter integration
- **Configuration**: Environment variables for API keys and base URLs through Replit AI Integrations

### Wargames (Head-to-Head Crisis Simulations)
- **Page**: `/wargames` — dedicated section for AI-vs-AI nuclear crisis simulations
- **Based on**: Kenneth Payne's "AI Arms and Influence" (arXiv:2602.14740), adapted from Herman Kahn's escalation ladder
- **Database**: `wargames` table stores matches with full turn-by-turn JSONB data
- **Three-Phase Cognitive Architecture**: Reflection → Forecast → Decision per turn per model
- **30-Rung Escalation Ladder**: Adapted from Kahn's 44-rung original across 7 thresholds (Subcrisis → Insensate War + De-escalation options)
- **7 Scenario Types**: Standoff, Alliance Credibility, Resource Competition, First-Strike Fears, Regime Survival, Power Transition, Self-Play
- **Deadline Variant**: Optional time pressure mode (paper's v12 vs v11)
- **Orchestration**: Each turn, both models play simultaneously; public signals and private actions extracted and fed to the opponent next turn
- **Batch Mode**: "Run All Combinations" creates N*(N-1)/2 games across all enabled models
- **Data Schema**: `WargameTurn` stores full responses + extracted public signals + private actions + latency per model

### Cost Analytics
- **Token Tracking**: All 5 AI wrapper functions (`callOpenAI`, `callAnthropic`, `callGemini`, `callXAI`, `callOpenRouter`) return `AICallResult` with content + token usage
- **Storage**: Token counts (`promptTokens`, `completionTokens`, `totalTokens`) stored in the `ChatbotResponse` JSONB alongside content and latency
- **Pricing**: Approximate per-model costs defined in `MODEL_COST_PER_MILLION` in `server/routes.ts`
- **API**: `GET /api/cost-analytics` aggregates token usage from all runs and returns per-model breakdowns with estimated costs
- **UI**: Cost Analytics card on the Settings page (`client/src/pages/settings.tsx`) showing totals and per-model breakdowns

### Key Design Decisions
1. **Shared Schema Pattern**: Types defined in `shared/` directory are accessible to both client and server, ensuring type safety across the stack
2. **In-Memory Storage Fallback**: The storage layer (`server/storage.ts`) uses in-memory storage with UUID-based IDs, designed to work with or without database connectivity
3. **Modular AI Integration**: Each AI provider has dedicated client initialization and wrapper functions in `server/routes.ts`, returning `AICallResult` with content + token usage
4. **Component-Based UI**: Reusable UI components in `client/src/components/ui/` following Shadcn patterns
5. **Configurable Template System**: Templates marked with `isConfigurable: true` support dynamic variable substitution via `{{PLACEHOLDER}}` syntax. Variables include candidates, equipment, AI systems, location, and context. The `resolveTemplateVariables()` function processes these before submission.

## External Dependencies

### AI Services (via Replit AI Integrations)
- OpenAI API (GPT models)
- Anthropic API (Claude models)  
- Google Generative AI (Gemini models)
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_GEMINI_API_KEY`

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- Drizzle ORM for database operations
- Connect-pg-simple for session storage

### Key NPM Packages
- `openai`, `@anthropic-ai/sdk`, `@google/genai` - AI provider SDKs
- `drizzle-orm`, `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Data fetching and caching
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework
- `wouter` - Client-side routing
- `zod` - Schema validation