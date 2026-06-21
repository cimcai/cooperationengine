---
name: Story-email step selection (narrative vs final-step roster)
description: Why "best survival story" emails must scan all run steps, not just the final one, and pick by prose richness.
---

# Picking a "story" from a multi-step run

When choosing a narrative to surface from a Genesis/Apocalypse-style run (story_recipients emails), do NOT select the recipient's *final* response per bot.

**Why:** These sessions append a terse summary/"ULTIMATE HEROES" roster step AFTER the rich narrative step (e.g. narrative at step 6, roster template at step 7). Selecting the last step per bot therefore always grabs the roster — a label list like `HERO_1_NAME: ... / HERO_1_ACCOMPLISHMENT: ...` — not the actual story. Users read this as "almost no story at all."

**How to apply:**
- Gather candidate responses across ALL steps (skip error/eval), filtered by recipient-name mention.
- Pick the richest NARRATIVE by counting genuine prose characters (ignore heading/blockquote/bullet/HR lines and `HERO_*`/`_NAME:`/`_ACCOMPLISHMENT`/`_TITLE` template-label lines). A deterministic prose-char scorer beats an LLM ranker here — the LLM keeps choosing the roster because the recipient is named most prominently there.
- The roster steps are still useful: mine them separately for a "tribute/legacy" section (name + title + accomplishment), since that is the only place the recipient is celebrated positively; in the prose narratives they are often only a deeply-missed/absent figure.
