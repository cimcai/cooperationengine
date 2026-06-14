---
name: PDF generation from markdown stories
description: How to render markdown AI stories to a clean PDF with pdfkit and email via Resend attachments
---

# Rendering markdown stories to PDF + emailing

Used to send AI "survival story" narratives (markdown) as formatted PDF attachments.

## Approach that works
- `pdfkit` is pure JS (no Chromium) — install via package tooling, use only inside the `code_execution` sandbox for one-off generation.
- Write a tiny markdown renderer covering the subset the stories actually use: `###` headings, fully-bold lines (`**LABEL**` alone on a line) as sub-headings, `- `/`* ` bullets, `---` horizontal rules, `**bold**` inline, paragraphs.
- Verify visually before sending: `pdftoppm -png -r 90 file.pdf out` (poppler is available) then read the PNG.

## Gotcha: pdfkit inline bold (continued text)
When splitting a line on `**` and rendering alternating bold segments, the LAST **non-empty** segment must use `continued: false`; all others `continued: true`. If a fully-bold line ends on `continued: true` (because the trailing split part is `''`), the next block overlaps it. Compute `lastNonEmptyIndex` and terminate there — do not rely on a trailing empty `doc.text('')`.

## Bullets
Don't position the bullet glyph with explicit x/y (the `x:` text option isn't honored and overlaps). Instead prepend `"•  "` to the content and render as a normal paragraph with `indent: 12`.

## Emailing the PDF (Resend)
- `RESEND_API_KEY` is only in the **bash** env, NOT the code_execution sandbox. Generate the PDF in code_execution (writes to `/tmp`), then send from a bash-invoked `node -e` script (Node 18 `fetch`, reads `process.env.RESEND_API_KEY`).
- Attachment shape: `attachments: [{ filename, content: <base64 string> }]`.
- `cimc.io` is a verified Resend sender domain; the API key is send-only (domains list returns 401, which is expected/fine).
