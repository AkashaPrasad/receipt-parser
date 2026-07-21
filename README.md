# Receipt Parser

A local, single-user tool that turns a photo (or PDF) of a receipt into structured, editable data.

## What this is

You drop in a receipt, it's classified and parsed by Gemini in one call, a set of deterministic checks flag anything that looks off (math that doesn't add up, an implausible date, a missing total), and you land on a two-pane review screen where you can fix whatever the model got wrong. Corrections are saved to a local SQLite database. Nothing leaves your machine except the image sent to Gemini for parsing.

## Setup

Prerequisites: Node.js ≥ 20.

```bash
cp .env.example .env
# then edit .env and set GEMINI_API_KEY (get one at https://aistudio.google.com/apikey)
npm install
npm run dev
```

Open http://localhost:3000 — that's it.

Environment variables (all in `.env`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | Your Gemini API key. |
| `GEMINI_MODEL` | no | `gemini-3.5-flash` | Any Gemini model name works as a drop-in swap. |

## How it works

```
 upload (image or PDF)
        │
        ▼
 classify + extract  ──▶  one Gemini call, structured JSON output
        │                 (document type, image quality, fields,
        │                  line items — each with a confidence score)
        ▼
 Zod validation  ──▶  one retry with the error appended to the prompt;
        │             if that also fails, salvage whatever parses field-
        │             by-field and mark the rest low-confidence / null
        ▼
 deterministic checks  ──▶  arithmetic reconciliation, date sanity,
        │                   amount/quantity sanity — computed in code,
        │                   never trusted from the model
        ▼
 SQLite (receipts, line_items, field_meta)
        │
        ▼
 correction UI  ──▶  two-pane review: receipt image on the left,
                      editable fields and flags on the right
```

Everything the model marked low-confidence, or that fails a deterministic check, is flagged in the UI with a reason. The correction screen is the safety net — it's designed to be fast to scan and fast to fix, because the whole premise of the product depends on a human catching what the model misses.

## Decisions I made (and why)

**What counts as a line item?**
- Only things actually purchased. Tax, tip, discount, subtotal are their own fields, not line items.
- Keeps the math check honest — items + tax − discount should equal the total. Mixing tax into the item list breaks that.

**Malformed LLM output?**
- One retry, with the validation error fed back into the prompt.
- Still broken → keep whatever fields did parse, leave the rest blank, and let the user fix it in the UI. No dead-end error screen — the correction flow *is* the fallback.

**Low-confidence extractions?**
- Don't trust the model's self-reported confidence alone. Check the math too: does total = items + tax, is the date real, anything negative that shouldn't be.
- Anything that fails either check gets flagged. If the photo itself is too blurry to trust, say so upfront and let the user decide to continue or reupload, instead of quietly guessing.

**How does the user know what to correct?**
- Flagged fields get an amber highlight with a tooltip saying why (low confidence / doesn't match total / not found).
- A banner shows up when the numbers don't reconcile, with the actual gap ("items add up to $512, total says $572").
- I also tried highlighting the spot on the *image* where a field was read from. Had to abandon it has the accuracy will take more than 4hrs to solve and also increases token usage.

**Which model, and why?**
- Went with Gemini's Flash tier. Pro wasn't available on new API keys at the time, so I benchmarked Flash generations directly against my sample receipts — `gemini-3.5-flash` came out faster *and* more accurate than `2.5-flash`, so that's the default now.
- Flash over Pro generally: you give up a bit of accuracy for a lot less cost and latency, and that's fine here specifically because the correction flow exists to catch what the model misses. That tradeoff doesn't work without a good correction UI, but with one, it's an easy call.

---

## The five questions

**What did you build?**
A Next.js app (API routes as backend, React + shadcn/ui frontend) that takes a receipt photo or PDF, sends it to Gemini for classification + structured extraction in one call, runs it through validation and arithmetic sanity checks, saves it to SQLite, and shows a two-pane review screen for corrections — inline editing, live reconciliation, custom fields, and a reupload flow that merges a better photo in without losing edits you already made.

**Biggest tradeoffs:**
- One combined classify + extract call instead of two. Cheaper and faster, but it couples the failure modes — a bad extraction means re-running the classification too.
- Cut image highlight-sync. Tried it, tried fixing it twice (one box per item list instead of per row, then deriving row positions from actual pixel analysis), it got better but not trustworthy enough. A flagged-field list gives the same "check this" signal without a visual that could point at the wrong line.
- Model tier over model brand. The real tradeoff wasn't "which company" so much as "how much accuracy am I willing to trade for speed and cost" — and that trade only makes sense because there's a human correcting mistakes downstream.

**Where did you use an LLM?**
Claude Code built the app from a spec I wrote upfront — data model, pipeline stages, merge rules, correction-flow behavior. I made the actual decisions: the extraction schema, the arithmetic tolerances, the merge precedence for reuploads, the validation/fallback strategy. Prompt tuning and the call to drop highlight-sync both came from testing against real sample receipts, including a deliberately blurry one and one with duplicated/overlapping text. **Also used Shadcn MCP hook for real inspired UI elements and playwright CLI so Claude can access the browser to see the UI errors and fix instead of relying on DOM only.**

**What would you do with another week?**
1. Calibrate confidence against a small labeled set — right now "high/medium/low" is just the model grading itself, no ground truth behind it.
2. Revisit image highlighting, backed by **real OCR instead** of the model's own guess, if it's worth the added complexity.
3. Multi-currency and itemized tax per receipt (right now it's one currency, one tax figure).
4. Batch upload instead of one at a time.
5. Category tagging, since that's what actually feeds a spend dashboard.
6. Mobile capture with edge detection/cropping — a phone camera is the real capture device here, not a desktop drag-and-drop.

**What would you push back on?**
The field list itself — merchant, date, line items, total. For a personal-finance product, payment method and category probably matter more than line items for most receipts: "$1,200, dining, credit card" is more useful than every dish name, and line items are both the least reliable field to extract and the most correction-heavy for the user. I'd ask whether v1 needs itemization at all, or only for categories where it earns its keep, like groceries.

**Feature to be noted**: When you re-upload a photo it stiches the previous photo info with the new photo info and enters the best of two accurate details found.

## Known limitations

- The reupload/merge feature is a heuristic: line-item matching is normalized-name token overlap plus amount proximity, not true fuzzy string matching, so a badly-misspelled OCR read on one photo and a clean read on the other may not match and will show up as two line items rather than one merged item. It supports exactly two photos per receipt (no third re-upload).
- PDFs are rasterized to their first page only for the review-UI image; multi-page PDFs are not supported.
- Currency is a single code per receipt; there's no per-line-item currency or itemized tax breakdown.
- No image highlight-sync (see "Biggest tradeoffs" above) — flags tell you *what* to check, not *where* on the image.
- No authentication and no deployment config, by design — this is a local, single-user tool.

## Testing

Unit tests (deterministic checks, Zod salvage path, merge precedence):

```bash
npm run test:unit
```

End-to-end tests (Playwright, drives the real app — needs `GEMINI_API_KEY` set and the dev server startable):

```bash
npm run test:e2e
```

The E2E suite uploads a real sample from `./samples/` and exercises the full correction flow (edit → live reconciliation → save → reload → persisted), add/delete line items and custom fields, non-receipt rejection, and list/delete. It starts the dev server itself if one isn't already running.
