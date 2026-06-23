---
name: Aggregate export endpoints and sensitive fields
description: adding a new data source to a bulk/export endpoint can silently leak secrets or PII — re-check auth and strip tokens
---

When you add a new entity to an existing aggregate/export endpoint (e.g. a "download all data" ZIP), the endpoint's existing auth posture and the new entity's secret fields are now coupled.

**Why:** An export route may have been acceptable while it only exposed non-sensitive data, but adding rows that contain emails/PII or capability tokens (e.g. a per-record `submissionToken` that authorizes a public write endpoint) turns a harmless dump into a confidentiality + integrity hole — an unauthenticated caller can harvest tokens and overwrite data via the public token route.

**How to apply:** Whenever you wire a new data source into a bulk export (or any broad read endpoint):
1. Re-confirm the endpoint requires the right auth level; don't assume the old "public" posture is still safe.
2. Strip capability/secret tokens from the payload (destructure them out) — they belong only where strictly needed.
3. For browser downloads triggered by `window.location.href` (can't send headers), pass auth as a `?passcode=` query param and gate on it server-side.
