---
name: Completing truncated stored AI responses
description: How to finish an AI run response that was cut off by max_tokens, and run long AI calls without losing output
---

# Completing a truncated AI run response

Stored run responses can be cut off mid-sentence because the app caps output (e.g. `callAnthropic` uses `max_tokens: 2048` in server/routes.ts). A response that ends mid-word is the model hitting that cap, NOT a rendering bug.

## To finish it coherently (assistant prefill / continuation)
- Rebuild the full conversation: system prompt + interleave each user prompt with that model's prior response (fetch `/api/runs/:id` for responses and `/api/sessions/:id` for `prompts` ordered by `.order`).
- Make the LAST message an `assistant` message whose content is the truncated text (strip trailing whitespace — Anthropic rejects trailing whitespace on a prefill). The API continues that turn from exactly where it stopped.
- If it truncates again, repeat: set the assistant prefill to truncated + all continuations so far.
- To force a clean wrap-up, trim the dangling fragment to a complete sentence, then append a `user` message asking for a brief closing. `stop_reason: end_turn` means it finished naturally; `max_tokens` means cut off again.

## Running long AI calls in this environment (critical)
- **Background `nohup … &` jobs get killed at the bash tool-call boundary** — they die silently with no output. Do NOT rely on them.
- Instead run **synchronously with streaming**, appending each delta to a file (`stream.on('text', t => fs.appendFileSync(...))`). Even if the 120s bash limit kills the call, the partial output is already on disk and you can continue from it.
- The script must run from the project root so `require('@anthropic-ai/sdk')` resolves; AI integration keys (`AI_INTEGRATIONS_ANTHROPIC_API_KEY` / `_BASE_URL`) are in the bash env, not the code_execution sandbox.
