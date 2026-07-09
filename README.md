# Competitive Intel Engine

An automated competitive intelligence system that monitors competitors, classifies signals, and synthesizes intelligence into actionable outputs for GTM teams.

Built around one question: **"What should your content, sales, and positioning teams DO with this signal?"** — not "what is interesting to know." Every design decision flows from this.

---

## What It Does

The system monitors competitors across multiple data sources, classifies signals with an LLM, and produces four output types:

- **Weekly Pulse** — CMO briefing on the competitive landscape every Monday
- **Monthly Strategic Pulse** — Positioning confidence assessment against accumulated evidence
- **Signal Alerts** — Real-time alerts when high-priority events are detected
- **Living Battlecards** — Per-competitor cards that regenerate themselves when new signals land, kept as append-only revisions with a diff and a "what changed" note

Every output is designed to drive a specific decision, not just inform. Nothing is published behind a human gate — the pipeline runs itself and guards its own output quality (see [Trust & Auto-Publish](#trust--auto-publish)).

---

## The Analytical Spine: Positioning Claims

The entire system is organized around your company's positioning claims. Every signal — every article, pricing change, job listing, product announcement — is evaluated against these claims. If a signal doesn't affect any of them, it's noise.

This is what stops the system from producing interesting-but-useless observations. The classifier is explicitly told: "If this doesn't affect a positioning claim, it's probably not worth reporting."

---

## Information vs Intelligence

Every output was engineered around this distinction:

**Information** — "Kyriba announced a new product."

**Intelligence** — "Kyriba's new mid-market SKU directly threatens Claim #1 by removing the pricing barrier. Update the comparison page and flag for sales."

The difference: intelligence connects the event to a specific positioning claim, identifies the affected buyer segment, and implies a specific action.

Every LLM classification call injects:
- Your company's strategic context (what you are, honest strengths and weaknesses, target segments)
- A per-competitor threat model (what that competitor is, what their strategic direction is, what their moves mean for you)
- An analytical rubric with 4 filters the LLM must apply before classifying anything as worth reporting

---

## The 4 Analytical Filters

1. **Claim Test** — Does this affect any of your positioning claims?
2. **Segment Test** — Does this change what happens in your target segments?
3. **Leading vs Lagging** — Is this a hiring signal or messaging shift (leading) or a product launch (lagging)? Leading indicators are more valuable.
4. **Pattern Test** — Is this a one-off event or part of a trend?

---

## Classification Taxonomy

10 intel types, each tied to a GTM decision:

| Type | GTM Decision |
|------|-------------|
| PRODUCT_CHANGE | Battlecard update; check if content angle needs reframing |
| PRICING_CHANGE | Immediate sales enablement flag; comparison page update |
| HIRING_SIGNAL | Leading indicator of strategic pivot — weeks of lead time |
| MESSAGING_SHIFT | Content strategy recalibration |
| PARTNERSHIP | Evaluate capability gaps; co-marketing consideration |
| OUTAGE | Potential win scenario for sales |
| REGULATORY | Licensing moat validation or threat |
| REVIEW | G2/Capterra positioning gap identified |
| SEO_CHANGE | Category language battle intelligence |
| PRESS | General market movement, brand monitoring |

---

## Architecture at a Glance

Two deployables, one database:

- **Web app (Vercel)** — read-only. Dashboards, battlecards, pulses. It only *displays* what the worker produced.
- **Worker (Fly.io)** — an always-on process that owns all writing. An internal clock (node-cron) enqueues jobs onto a Postgres-backed queue (pg-boss); the worker runs ingestion, generation, and battlecard regeneration with no serverless time limit. A heartbeat makes a silently-dead worker look different from a quiet news week.

This split is what removes the old 60-second serverless ceiling: the slow generate step (3–5 min) runs on the worker, unattended, instead of being triggered by hand.

---

## Tech Stack

- **Next.js 16** — App Router, Server Components, React 19
- **PostgreSQL (Neon) + Prisma 7** — data layer, driver adapter
- **pg-boss** — Postgres-backed job queue (no Redis, reuses the same DB)
- **node-cron** — the worker's internal clock
- **LLM provider factory** — env-driven model choice (OpenRouter / DeepSeek), with Claude (Anthropic) as fallback; per-step model selection for draft / judge / classify
- **TypeScript** — throughout, strict mode
- **Vercel** (web) + **Fly.io** (worker) — deployment

---

## Getting Started

### 1. Configure your company

Edit `src/lib/config/company.ts` — this is the single file that adapts the system to your company:

```ts
export const COMPANY_NAME = "Your Company";
export const COMPANY_STRATEGIC_CONTEXT = `...`; // Your strategic context
export const COMPANY_EXTENDED_CONTEXT = `...`;  // Geographic/temporal context
```

Edit `src/lib/llm/context/competitor-profiles.ts` to add your actual competitors and their threat models.

### 2. Set environment variables

```bash
cp .env.example .env
```

Required:
```
DATABASE_URL=postgresql://...        # Neon (or any Postgres) connection string
ANTHROPIC_API_KEY=sk-ant-...         # Claude fallback + classification
CRON_SECRET=...                      # protects the pipeline trigger routes
```

Optional:
```
OPENROUTER_API_KEY=...               # enables the LLM provider factory (cheaper models)
LLM_MODEL_DRAFT=...                  # per-step model override (draft / judge / classify)
LLM_MODEL_JUDGE=...
LLM_MODEL_CLASSIFY=...
PHANTOMBUSTER_API_KEY=...            # enables the LinkedIn connector
WORKER_DATABASE_URL_DIRECT=...       # direct (non-pooled) Postgres URL for the worker
HEALTHCHECK_PING_URL=...             # external heartbeat monitor
NEXT_PUBLIC_APP_URL=...
```

### 3. Set up the database

```bash
npx prisma db push
npx prisma db seed
```

The seed script creates your positioning claims and competitor records.

### 4. Run the web app locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run the worker

The worker owns ingestion and generation. Run it alongside the web app:

```bash
npm run worker
```

It starts the cron clock and the pg-boss queue. On a schedule it ingests new signals, classifies them, and enqueues generation + battlecard regeneration.

To run a single pipeline pass directly (no worker/queue), use the scripts:

```bash
npx tsx src/scripts/run-ingest.ts     # one ingestion pass
npx tsx src/scripts/run-generate.ts   # one generation pass
```

---

## Architecture

```
src/
├── app/                    # Next.js pages + API routes (read-only web app)
│   ├── page.tsx            # Dashboard — latest pulse + claim status
│   ├── intel/              # Raw intelligence feed
│   ├── battlecards/        # Competitor battlecards (grid + detail)
│   ├── content/            # Content briefs and drafts
│   └── api/health/         # LIVE / STALE / DEAD worker heartbeat
├── worker/                 # Always-on worker (Fly.io)
│   ├── index.ts            # Boot: cron clock + pg-boss queue + graceful shutdown
│   ├── schedule.ts         # node-cron ticks (ingest hourly, generate every 6h)
│   ├── queue.ts            # pg-boss wiring
│   ├── attempts.ts         # crash-safe DB-persisted attempt counter
│   └── jobs/               # ingest, generate, generate-card handlers
├── lib/
│   ├── config/             # company.ts (your config), thresholds.ts
│   ├── ingestion/
│   │   ├── connectors/     # Connector contract: regulatory (SEC), jobs, seo, linkedin
│   │   ├── adapters/       # Legacy source adapters (RSS, web, LinkedIn)
│   │   └── pipeline.ts     # Shared ingestion pipeline
│   ├── llm/
│   │   ├── factory.ts      # Provider factory (OpenRouter/DeepSeek + Claude fallback)
│   │   ├── openrouter.ts   # OpenRouter implementation
│   │   ├── claude.ts       # Claude implementation
│   │   ├── rubric.ts       # Versioned scoring/strategy rubric loader
│   │   ├── context/        # Strategic context injected into LLM calls
│   │   └── prompts/        # Prompt builders for each output type
│   ├── generators/         # weekly-pulse, monthly-pulse, signal-alert, battlecard
│   ├── health/             # heartbeat + status (dead-man's switch)
│   └── synthesis/          # Alert evaluator, validators, adversarial judge
└── types/                  # Shared TypeScript types
```

---

## Configuring Competitors

Each competitor gets a profile in `src/lib/llm/context/competitor-profiles.ts`. The format:

```ts
const COMPETITOR_PROFILE = `
COMPETITOR: [NAME] (Tier 1 or Tier 2)
Threatens Claims: [Which of your claims does this competitor threaten?]

WHY THEY MATTER:
[Context on their position, funding, market role]

THE SPECIFIC THREAT:
[What specific move by this competitor would threaten your positioning?]

CONFIRMED:
[Verified facts — citable]

INFERRED:
[Reasonable conclusions from confirmed evidence]

UNKNOWN:
[What you don't know but need to watch]

SIGNALS THAT MATTER:
[Specific things to watch for in their content/hiring/product]
`.trim();
```

Tier 1 = highest consequence threat. Tier 2 = worth watching but not existential.

---

## Data Sources

Sources go through a uniform **connector contract** — `{ sourceType, discover, fetch }` — with three disciplines baked in: transport is injected (no hardwired HTTP), a failing source returns `null` instead of throwing (one flaky source never fails the whole run), and **a connector may never assign its own trust tier** — it emits typed content and a separate engine tiers it. A source type with no registered connector is skipped loudly, never fatally.

Live connectors:

- `REGULATORY` — SEC EDGAR filings, free and keyless (the "confirmed anchor" — the only path to independent confirmed facts)
- `JOB_POSTING` — keyless jobs-page scrape (leading intent signal)
- `SEO` — keyless search-surface signal (category language battle)
- `LINKEDIN` — company posts and job listings via PhantomBuster (env-gated on `PHANTOMBUSTER_API_KEY`)

Legacy adapters (RSS press feeds, website change-detection) are also supported and configured in the database / seed script.

---

## Output Types

### Weekly Pulse
Generated every Monday. Covers:
- Top signals of the week with evidence tiers
- Positioning claim status (HOLDING / UNDER_PRESSURE / CONTESTED)
- Offensive opportunities from competitor moves
- Outlook

### Monthly Pulse
Deeper strategic analysis. Covers:
- Threat status for Tier 1 competitors (DORMANT → CRITICAL)
- Cross-competitor patterns
- Positioning confidence with evidence counts
- Content implications
- Known unknowns

### Signal Alert
Generated immediately when a high-priority event is detected. Covers:
- What happened and why it matters
- Claims affected
- Recommended response
- Specific action items

### Living Battlecard
Per-competitor cards that maintain themselves. When a new signal lands for a competitor, a **retarget** step regenerates just that competitor's affected sections and appends a **new revision** — with a diff, a "what changed" note, and the rubric version it was written under. Cards are never overwritten; the dashboard renders each section's latest passing revision, so you always get the current card with full history behind it.

---

## Trust & Auto-Publish

There is no human gate on publishing, so output quality is guarded by the pipeline itself:

- **Deterministic validators** — structural checks, evidence-tier enforcement, company-specificity, length limits, source verification.
- **Machine-readable retry feedback** — when a draft fails, the *specific* failure reasons are fed back into the next attempt's prompt (up to 3 attempts), so it doesn't just fail the same way three times.
- **Adversarial judge** — a separate LLM call whose only job is to *fail* a draft against the rubric. It cannot rewrite (only return reasons), returns all failing criteria at once, and defaults to FAIL when unsure. Validators run first, so doomed drafts never reach the judge.
- **Tier monotonicity** — an output can never claim a higher evidence tier than the best evidence it cites (no laundering weak evidence into confident claims).
- **Versioned rubric** — the scoring/strategy brain is a version-stamped file read by both the generator and the judge; edit it to retune tone/criteria with zero code change, and every output records the rubric version it was made under.
- **Disciplined retries** — a validation failure is a *finished* job recorded as REJECTED (not retried forever); only genuine infrastructure faults (rate limit, DB down) are retried. The attempt counter lives in the database, so a crash resumes at attempt N+1 instead of restarting or double-spending.

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Nicholas Woo](https://nicwoo.com).
