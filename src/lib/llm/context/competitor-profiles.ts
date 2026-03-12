/**
 * Per-competitor strategic profiles — injected when analyzing that competitor.
 *
 * Each profile answers: WHY does this competitor matter to YOUR COMPANY specifically?
 * Not a fact sheet — a threat model.
 *
 * These are loaded by competitor name when the LLM is classifying intel,
 * generating alerts, or updating battlecards for a specific competitor.
 *
 * Replace these profiles with your actual competitors. The structure below
 * (WHY IT MATTERS, THE SPECIFIC THREAT, CONFIRMED/INFERRED/UNKNOWN, SIGNALS THAT MATTER)
 * is the recommended format — keep it.
 *
 * The example profiles below demonstrate the format using publicly available information.
 */

const KYRIBA_PROFILE = `
COMPETITOR: KYRIBA (Tier 1)
Threatens Claims: [Replace with: which of your positioning claims does Kyriba threaten?]

WHY KYRIBA MATTERS:
Kyriba is the Gartner Magic Quadrant "Leader" for enterprise TMS — 25+ years, 3,400+ clients, 9,900+ bank connections. When a consultant recommends a treasury system, Kyriba is on the shortlist by default. They are the benchmark buyers compare against, even in mid-market deals where Kyriba is objectively overbuilt.

THE SPECIFIC THREAT:
[Replace with: what specific move by Kyriba would threaten your positioning claims?]

CONFIRMED:
- Enterprise pricing: $150K+ ACV, $230K+ year-one TCO including implementation
- Implementation: 12-18 months (consistently cited in G2/Gartner reviews)
- Architecture: Treasury and payments are separate modules, not a unified workflow
- TAI launched as "trust-first AI" with auditability focus
- Euromoney "World's Best TMS 2025"
- G2/Gartner complaints: implementation complexity, dated UI, cost
- Reviewers describe it as "often too complex and costly for most SMBs"

INFERRED:
- TAI is acquired technology, not natively built
- Enterprise DNA makes genuine mid-market pivot culturally and architecturally difficult
- Implementation burden is structural (deep customization model), not operational

UNKNOWN:
- Whether TAI is gaining traction with any mid-market buyers
- Whether Kyriba has created a mid-market pricing tier
- Whether "trust-first AI" framing effectively counters AI-native positioning

SIGNALS THAT MATTER:
- Product pages mentioning mid-market, SMB, or simplified deployment
- TAI case studies featuring mid-market companies
- Pricing page changes or new packaging tiers
- Job postings for mid-market sales roles
- Implementation timeline claims below 6 months (would signal a real shift)
`.trim();

const AIRWALLEX_PROFILE = `
COMPETITOR: AIRWALLEX (Tier 1)
Threatens Claims: [Replace with: which of your positioning claims does Airwallex threaten?]

WHY AIRWALLEX MATTERS:
Airwallex has $902M in funding, global infrastructure, strong APAC presence, and existing mid-market relationships. A single product launch could expand their competitive overlap significantly.

THE SPECIFIC THREAT:
[Replace with: what specific move by Airwallex would threaten your positioning claims?]

CONFIRMED:
- $902M raised. One of the most well-funded fintechs globally.
- Global infrastructure: 150+ countries, multi-currency accounts, competitive FX rates
- Strong APAC brand recognition, especially among fintech-native companies
- Modern API-first platform with strong developer experience
- Currently NO treasury module, NO cash forecasting, NO consolidated multi-bank visibility
- No AI/ML treasury intelligence — purely transactional platform

INFERRED:
- Treasury expansion is strategically logical given their infrastructure and funding
- Developer-centric buyer base partially overlaps with treasury-focused buyer base

UNKNOWN:
- When or whether they will build treasury capabilities
- Whether their developer-centric buyers and your target buyers are the same people

SIGNALS THAT MATTER:
- ANY product page mention of: cash visibility, cash forecasting, treasury management, multi-bank connectivity
- Acquisitions or partnerships adding treasury-adjacent capabilities
- Job postings for: Treasury Product Manager, Cash Management Engineer, Bank Integration Lead
- Language shift from "payments infrastructure" toward "financial platform" or "financial operating system"
- Pricing tiers that bundle analytics or intelligence features above pure payments
`.trim();

const TROVATA_PROFILE = `
COMPETITOR: TROVATA (Tier 2)
Threatens Claims: [Replace with: which of your positioning claims does Trovata threaten?]

WHY TROVATA MATTERS:
Trovata is cloud-native, modern UX, mid-market accessible, rapid deployment. They occupy the "modern treasury for mid-market" space. The differentiation is structural: Trovata does cash management only — no payments, no multi-market licensing, no AI intelligence layer.

THE SPECIFIC THREAT:
[Replace with: what specific move by Trovata would threaten your positioning claims?]

CONFIRMED:
- Cloud-native cash management platform, Series B funded
- Modern UX, rapid deployment (weeks, not months)
- Public pricing: $24K/year base tier (accessible for mid-market)
- No payments capability — cash management and forecasting only
- No multi-market licensing (software platform, not licensed payments entity)

INFERRED:
- Most likely to appear in competitive evaluations alongside modern mid-market treasury tools
- Their limited scope (no payments, no licensing) is a feature for some buyers who only need cash management

UNKNOWN:
- Whether Trovata is building or partnering for payments capability
- How often they appear in your deal cycles

SIGNALS THAT MATTER:
- Product pages mentioning payments, money movement, or cross-border
- Partnership announcements with payments providers
- Job postings for payments engineers or compliance/licensing roles
- Pricing changes (especially upmarket moves)
`.trim();

const NIUM_PROFILE = `
COMPETITOR: NIUM (Tier 2)
Threatens Claims: [Replace with: which of your positioning claims does Nium threaten?]

WHY NIUM MATTERS:
Singapore-based, $300M+ raised, cross-border payments in 100+ countries. Strong licensing portfolio across multiple jurisdictions. If they move into adjacent capabilities, their licensing breadth + payments reach makes them a structural competitor.

THE SPECIFIC THREAT:
[Replace with: what specific move by Nium would threaten your positioning claims?]

CONFIRMED:
- $300M+ raised, Singapore HQ
- Cross-border payments infrastructure, 100+ countries
- Strong licensing portfolio across multiple jurisdictions
- Public status page (only competitor with one — useful for outage monitoring)
- Comprehensive developer documentation / API changelog

SIGNALS THAT MATTER:
- Product announcements expanding into adjacent capabilities
- Expansion into markets where you are licensed
- Partnerships with players in your category
`.trim();

const HIGHRADIUS_PROFILE = `
COMPETITOR: HIGHRADIUS (Tier 2)
Threatens Claims: [Replace with: which of your positioning claims does HighRadius threaten?]

WHY HIGHRADIUS MATTERS:
HighRadius is the AI credibility threat. $1B+ funded, they claim 95% forecast accuracy in their AI-powered treasury and O2C solutions. If buyers believe these claims, it raises the bar for any competing AI-native positioning.

THE SPECIFIC THREAT:
[Replace with: what specific move by HighRadius would threaten your positioning claims?]

CONFIRMED:
- $1B+ funded, large enterprise customer base
- AI-powered O2C (Order to Cash) + treasury solutions
- Claims 95% cash forecast accuracy
- "What's New" page provides regular product updates

INFERRED:
- AI claims may be overstated or specific to narrow use cases (common in enterprise AI marketing)
- Their O2C focus means treasury is one module, not the entire platform

SIGNALS THAT MATTER:
- Independent validation of the 95% accuracy claim (analyst reports, case studies)
- Expansion of AI capabilities into overlapping areas
- Mid-market go-to-market moves
- G2/Gartner reviews mentioning AI quality
`.trim();

const GTREASURY_PROFILE = `
COMPETITOR: GTREASURY (Tier 2)
Threatens Claims: [Replace with: which of your positioning claims does GTreasury threaten?]

WHY GTREASURY MATTERS:
PE-backed legacy TMS that claims 90-day implementation — directly countering the "legacy TMS = slow implementation" narrative. If their 90-day claim is real, it undermines any differentiation based on implementation speed vs. traditional TMS.

THE SPECIFIC THREAT:
[Replace with: what specific move by GTreasury would threaten your positioning claims?]

CONFIRMED:
- PE-backed, established enterprise player
- Claims 90-day implementation (vs. Kyriba's 12-18 months)
- Treasury management for corporates

SIGNALS THAT MATTER:
- Evidence validating or challenging the 90-day implementation claim
- Mid-market pricing or packaging moves
- Press/analyst coverage positioning them as Kyriba alternative
`.trim();

const STATUS_QUO_PROFILE = `
COMPETITOR: STATUS QUO — Spreadsheets + Existing Tools
Threatens Claims: All claims (prevents evaluation entirely)
Most frequent competitive loss across all segments. Not a company — inertia.

THE THREAT: Switching feels riskier than staying. Status quo has zero sales team, zero budget, wins by default.

WHAT IT LOOKS LIKE:
[Replace with: what does the status quo look like for your specific buyers? What manual processes do they use?]

WHY IT PERSISTS:
- Sunk cost, familiarity, invisible distributed pain, "good enough" inertia

WHAT BREAKS IT:
[Replace with: what events force buyers off the status quo in your market?]

SIGNALS TO WATCH:
- Existing tools improving in ways that overlap with your category
- "Do you really need [your product category]?" narrative in press
- Budget freezes (delay = status quo win)
`.trim();

export const COMPETITOR_PROFILES: Record<string, string> = {
  Kyriba: KYRIBA_PROFILE,
  Airwallex: AIRWALLEX_PROFILE,
  Trovata: TROVATA_PROFILE,
  Nium: NIUM_PROFILE,
  HighRadius: HIGHRADIUS_PROFILE,
  GTreasury: GTREASURY_PROFILE,
  "Status Quo": STATUS_QUO_PROFILE,
};

/**
 * Returns the strategic profile for a competitor, or a minimal fallback.
 */
export function getCompetitorProfile(competitorName: string): string {
  return (
    COMPETITOR_PROFILES[competitorName] ??
    `COMPETITOR: ${competitorName}\nNo strategic profile available. Classify based on general competitive context.`
  );
}

/**
 * Returns all competitor profiles concatenated — used for synthesis prompts
 * that need the full competitive landscape view (monthly pulse, claim assessment).
 */
export function getAllCompetitorProfiles(): string {
  return Object.values(COMPETITOR_PROFILES).join("\n\n---\n\n");
}
