---
name: drizzle-kit push interactive TUI
description: db:push prompts can't be answered by piping stdin; apply the constraint via direct SQL instead
---

When `npm run db:push` (drizzle-kit) detects a risky change (e.g. adding a UNIQUE constraint to a table that already has rows), it shows an interactive select prompt ("add without truncating" vs "truncate"). This TUI does NOT read from piped stdin — `printf '\n' | npm run db:push` and similar just re-display the prompt and hang.

**Why:** drizzle-kit's prompt reads the raw TTY, not stdin, so piping/echoing keystrokes does nothing in this sandbox.

**How to apply:** For a single additive constraint/index, skip the prompt and run the equivalent SQL directly against `$DATABASE_URL` with psql, e.g.
`psql "$DATABASE_URL" -c "ALTER TABLE t ADD CONSTRAINT t_col_unique UNIQUE (col);"`
The schema file edit (.unique() / index) still matters so the Drizzle schema and DB stay in sync — just apply the DB side manually when push blocks on a prompt.
