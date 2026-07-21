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

## The five questions

**What did you build?** A Next.js app (API routes as the backend, React and shadcn/ui for the frontend) that uploads a receipt image or PDF, sends it to Gemini for combined classification and structured extraction, validates and deterministically checks the result, persists it to SQLite, and presents a two-pane correction screen with inline editing, live arithmetic reconciliation, custom fields, and a reupload-and-merge flow for replacing a bad photo with a better one without losing edits already made.

**Biggest tradeoffs:** (1) One combined classify+extract Gemini call instead of two separate calls — better latency and cost, at the price of coupling the two failure modes together (a bad extraction schema means re-running the classification too). (2) I initially built image highlight-sync — clicking a field would draw a box on the receipt image showing where the model read it from, per the original spec. Testing it against the sample receipts showed the model's spatial grounding for line items specifically was not reliable enough to trust as UI: boxes would land on the wrong row of a tightly-packed item list. I tried two engineering fixes (asking for one bbox around the whole item list instead of per-row boxes, then deriving exact row boundaries from real pixel analysis instead of assuming equal row heights), and while both measurably improved things, I ultimately pulled the feature rather than ship something that looks precise but occasionally isn't — a flagged-field list conveys the same "trust but verify" information without a visual claim that could be wrong. (3) Model choice — Gemini 2.5 Pro isn't available on new API keys at the time of writing, so I benchmarked Flash generations directly against the sample receipts and found `gemini-3.5-flash` noticeably faster and more accurate than `gemini-2.5-flash`, which is why it's the default. The broader point holds regardless of tier: accuracy traded for cost/latency is recoverable specifically because the correction flow exists — the human catches marginal errors, and that's the whole premise of this product, not an afterthought.

**Where you used an LLM:** Claude Code scaffolded the app and UI from a detailed spec I wrote up front (data model, pipeline stages, merge precedence rules, correction-flow behavior). I designed the extraction schema, the deterministic-check tolerances, the field/line-item merge precedence for the reupload flow, and the overall validation/salvage strategy. Prompt iteration and the decision to drop image highlight-sync were both driven by testing against the real sample receipts in `./samples/`, including a deliberately blurry one and one with overlapping/duplicated text, to check that quality detection and the arithmetic check actually catch what they're supposed to.

**Another week:** In priority order — (1) calibrate confidence scoring against a small labeled receipt set, since right now "high/medium/low" is the model's own self-assessment with no ground truth to check it against; (2) revisit image highlight-sync backed by a dedicated OCR pass, if the value clearly justifies that added complexity; (3) multi-currency handling within a single receipt and itemized tax (currently one currency and one tax figure per receipt); (4) batch upload, since right now it's one receipt at a time; (5) category tagging feeding a spend dashboard, which is the actual use case this feeds into; (6) mobile capture UX with client-side edge detection/cropping, since a phone camera is the realistic capture device for this product, not a desktop drag-and-drop.

**Push back on:** the spec's field list — merchant, date, line items, total — is worth questioning for a personal-finance product. Payment method and category are arguably more valuable than line items for most receipts: spend analytics needs "$1,200, dining, credit card" far more than it needs every dish name, and line-item extraction is simultaneously the least reliable field (per this build's own flagging) and the most correction-heavy for the user. I'd ask the PM whether line items are needed for v1 at all, or only for specific categories like groceries, and whether the product is optimizing for expense-logging speed or itemized detail — those pull the UI in different directions. Separately: the spec says "photo" but doesn't address multi-page receipts or emailed PDF invoices, which are increasingly the common case for anything above a convenience-store purchase.

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
