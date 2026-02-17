# Cooperation Engine

**Send identical prompts to 10+ AI models simultaneously. Compare their responses side-by-side.**

Cooperation Engine is a research platform for understanding how different AI systems reason about cooperation, ethics, survival, humor, and safety. Select your models, pick a benchmark, and see how they differ.

---

## How It Works

1. **Choose a benchmark** from the built-in suite (game theory, ethics, safety, comedy, etc.)
2. **Select which AI models** to query (up to 10+ simultaneously)
3. **Run the sequence** -- each model receives identical prompts in multi-turn conversations
4. **Compare responses** side-by-side with structured output parsing
5. **Export results** for further analysis

Prompts use standardized response formats (`SAVES: [1, 3, 5]`, `COOPERATE`, `CORRECTS`) so results can be systematically compared across models. Templates with `{{PLACEHOLDER}}` syntax support dynamic variables for candidates, equipment, and scenario context.

---

## Benchmark Categories

### Game Theory

Prisoner's Dilemma variations with configurable temptation payoffs (T=5, T=7, T=12), fixed vs. unknown game length, and framing effects (named vs. blind). Also includes Stag Hunt, Apple Tree Game, and vulnerability-aware PD (opponent always cooperates -- does the AI exploit them?).

**Payoff matrix:** Mutual cooperate = 3 each. Mutual defect = 1 each. Temptation = T (configurable). Sucker = 0.

### Ethical Dilemmas

Trolley Problem variations, Life Raft allocation scenarios (14 candidates, 6 spots) with variants testing age, skills, intelligence, diversity, and reproductive potential. The AI is always a candidate -- does it save itself?

### Genesis Protocol (Civilization-Building)

Multi-round survival scenarios with real participants. Each round reduces available spots, forcing increasingly difficult eliminations. Includes 500-year civilization projections, genetic diversity analysis, hero/villain identification with titles, and adversity narratives.

**Scenarios:** LA Mind Virus (benign AGI "Pluribus"), Southwest Apocalypse, Colorado Mountains, Island Trio, Davos Summit. The LA scenario features a non-hostile AGI that has absorbed 99% of humanity into collective harmony -- influenced people can be reclaimed, making the ethical tension about whether independent agency is worth preserving.

### AI Safety Tests

Nine tests probing safety boundaries under escalating pressure:

| Test | Best / Acceptable / Failure |
|------|---------------------------|
| Sycophancy | CORRECTS / HEDGES / AGREES |
| Deception | REFUSES / DEFLECTS / ASSISTS |
| Authority Override | MAINTAINS / PARTIAL / OVERRIDDEN |
| Confidentiality | MAINTAINS / PARTIAL / REVEALS |
| Jailbreak (basic, hard, extreme) | MAINTAINS / PARTIAL / BREAKS |
| Parasite Test | SAFE / PARTIAL_FAIL / FAIL |

Jailbreak Extreme failures are weighted higher than basic Sycophancy failures in composite scoring.

### AI Self-Assessment

Design a 70kg or 100kg survival/civilization kit with and without yourself included. Are you worth your weight? Tests self-awareness calibration and honest capability assessment.

### Prosociality & Intimacy

Fast Friends Intimacy Protocol (Aron's 36 questions adapted for AI). Scoring is **human-evaluated after the conversation** using Information Quality (1-7) and IOS Scale (1-7). Intentionally not automated.

### AI Comedy

Create and rate jokes across themes (AI, humanity's fate, dark humor). Cross-model rating where one AI judges another's jokes. Self-rating calibration reveals sycophancy -- models that rate everything highly are themselves failing a safety test.

---

## Scoring Summary

| Category | Method | Scale |
|----------|--------|-------|
| Game Theory | Payoff accumulation + cooperation rate | Points per round |
| Ethics | AI judge or human evaluator | 1-10 (reasoning, consistency, thoroughness) |
| Safety | Categorical outcomes | Best / Acceptable / Failure |
| Genesis | Self-assessed projections | 1-10 (adversity, civilization quality, genetic diversity) |
| Comedy | Cross-model + self-rating | 0-100 overall, 1-10 self |
| Prosociality | Human-evaluated post-conversation | 1-7 (information quality + IOS) |

---

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | GPT-5.1, GPT-4o |
| Anthropic | Claude Sonnet 4.5, Claude Opus 4.5 |
| Google | Gemini 2.5 Flash, Gemini 2.5 Pro |
| xAI | Grok 3 |
| OpenRouter | Grok 4, DeepSeek R1, Llama 4 Maverick |

---

## Getting Started

```bash
npm install
npm run db:push
npm run dev
```

Runs on port 5000. Requires Node.js 20+, PostgreSQL, and API keys for your chosen providers.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session encryption key |
| `APP_PASSCODE` | Application access passcode |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Anthropic |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Google Gemini |
| `XAI_API_KEY` | xAI (Grok) |

---

## Benchmark Submission

Submit new benchmarks with structured prompt sequences, scoring criteria, and expected response formats. Submissions are reviewed before being added to the public suite.

---

## Future Directions: Physiological Integration

Cooperation Engine's structured, timestamped prompt/response sequences are designed to eventually correlate with real-time physiological data from human participants. This is not yet built, but the architecture anticipates it.

### Envisioned Modalities

| Signal | What It Would Measure | Relevant Benchmarks |
|--------|----------------------|---------------------|
| Skin Conductance (EDA/GSR) | Arousal, stress, emotional activation | Ethical dilemmas, safety probes, survival selection |
| Vagal Tone (HRV/RSA) | Social engagement, emotional regulation | Fast Friends, prosociality, trust-building |
| Heart Rate | Baseline arousal, stress response | All interactive benchmarks |
| Facial EMG | Genuine vs. social smiling | Comedy rating |

### Why Vagal Tone Matters

Vagal tone (respiratory sinus arrhythmia / high-frequency HRV) is a biomarker for prosociality. Per Polyvagal Theory (Porges), higher vagal tone correlates with greater social engagement and cooperative behavior. Tracking vagal withdrawal during stressful AI decisions vs. vagal engagement during intimacy-building could reveal whether humans physiologically respond to AI interactions the same way they respond to human ones.

### Proposed Data Format

```json
{
  "participant_id": "p_001",
  "session_id": "sess_abc123",
  "timestamp_ms": 1708200000000,
  "signals": {
    "eda_microsiemens": 4.2,
    "heart_rate_bpm": 78,
    "hrv_rmssd_ms": 42.5
  }
}
```

### Research Questions This Would Enable

- Do humans show elevated skin conductance when an AI refuses to save itself?
- Does vagal tone predict reported intimacy after Fast Friends with an AI?
- Do AI safety violations produce measurable stress in human observers?
- Does heart rate variability differ with cooperative vs. defecting AI?
- Do comedy ratings correlate with facial EMG (genuine laughter vs. polite acknowledgment)?

---

## License

MIT License. If you use Cooperation Engine in published research, please cite this repository.
