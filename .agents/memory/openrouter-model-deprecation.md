---
name: OpenRouter model slug deprecation
description: OpenRouter model slugs get retired and start returning 404 errors; verify before relying on them
---

OpenRouter periodically deprecates model slugs. A deprecated slug returns a 404 whose body names the replacement (e.g. "Grok 4 is deprecated... switch to Grok 4.3 / x-ai/grok-4.3").

**Why:** The OpenRouter-backed entries in `availableChatbots` (server/storage.ts) hardcode model slugs. When xAI/OpenRouter retire a version, every run silently produces empty content + a 404 error for that model only, while other providers succeed — easy to miss unless you inspect the per-response `error` field.

**How to apply:** If one OpenRouter model returns empty/`error` while others succeed, check the response's `error` field for a deprecation 404, then update the `model:` slug (and `displayName`) in server/storage.ts. Restart the workflow so the in-memory `availableChatbots` reloads.
