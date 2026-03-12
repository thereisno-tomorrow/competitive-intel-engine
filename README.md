# Competitive Intel Engine

An automated competitive intelligence system that monitors competitors, classifies signals, and synthesizes intelligence into actionable outputs for GTM teams.

Built around one question: **"What should your content, sales, and positioning teams DO with this signal?"** — not "what is interesting to know." Every design decision flows from this.

---

## What It Does

The system monitors competitors across multiple data sources, classifies signals using Claude, and produces three output types:

- **Weekly Pulse** — CMO briefing on the competitive landscape every Monday
- **Monthly Strategic Pulse** — Positioning confidence assessment against accumulated evidence
- **Signal Alerts** — Real-time alerts when high-priority events are detected

Every output is designed to drive a specific decision, not just inform.

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

## Tech Stack

- **Next.js 15** — App Router, Server Components
- **PostgreSQL + Prisma** — Data layer
- **Claude (Anthropic)** — Signal classification and synthesis
- **TypeScript** — Throughout
- **Vercel** — Deployment

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
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed script creates your positioning claims and competitor records.

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run ingestion

```bash
npm run ingest
```

This fetches data from all configured sources, classifies signals, and stores intelligence items.

---

## Architecture

```
src/
├── app/                    # Next.js pages and API routes
│   ├── page.tsx            # Dashboard — latest pulse + claim status
│   ├── intel/              # Raw intelligence feed
│   ├── battlecards/        # Competitor battlecards
│   └── content/            # Content briefs and drafts
├── lib/
│   ├── config/             # company.ts (your config), thresholds.ts
│   ├── ingestion/          # Data source adapters (RSS, web, LinkedIn)
│   ├── llm/
│   │   ├── context/        # Strategic context injected into LLM calls
│   │   └── prompts/        # Prompt builders for each output type
│   └── synthesis/          # Pulse and alert generators + validators
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

Configure data sources in the database (or seed script). Supported source types:

- `PRESS_RSS` — Competitor press and news via RSS
- `WEBSITE` — Competitor website (change detection)
- `CHANGELOG` — Product changelog pages
- `STATUS_PAGE` — Uptime/status pages
- `LINKEDIN` — LinkedIn company posts and job listings (via PhantomBuster)

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

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Nicholas Woo](https://nicwoo.com).
