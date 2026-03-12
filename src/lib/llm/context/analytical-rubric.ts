/**
 * Analytical rubric — injected into synthesis/generation prompts.
 *
 * This teaches the LLM HOW to think about competitive intelligence,
 * not just WHAT to produce. It's the difference between a junior analyst
 * describing events and a senior analyst interpreting them.
 */

/**
 * Injected into classification prompts to help the LLM assess "so what."
 * Shorter than the full rubric — classification needs speed, not depth.
 */
export const CLASSIFICATION_RUBRIC = `
ANALYTICAL FILTER:
When assessing this signal, apply these tests:
1. CLAIM TEST: Does this affect any of your company's three positioning claims? If not, it may be noise.
2. SEGMENT TEST: Does this change what happens in your company's target segments?
3. LEADING vs LAGGING: Is this a leading indicator (hiring, messaging shift, job postings) or a lagging indicator (product launch, press)? Leading indicators are more valuable because they give time to respond.
4. PATTERN TEST: Is this a one-off event or part of a trend? A single blog post is noise. Three blog posts shifting messaging is signal.

COMPANY IMPLICATION GUIDELINES:
- BAD: "This could impact the competitive landscape" (generic, says nothing)
- BAD: "Kyriba announced a new product" (restates the event, no interpretation)
- GOOD: "Kyriba's new mid-market SKU directly threatens Claim #1 by removing the pricing barrier that currently keeps them out of your company's sweet spot"
- GOOD: "Third Airwallex job posting this month mentioning 'treasury' — pattern now strong enough to move their treasury expansion threat from Unknown to Inferred"
`.trim();

/**
 * Full analytical rubric — injected into signal alert, pulse, and
 * claim assessment prompts where the LLM needs to produce strategic analysis.
 */
export const SYNTHESIS_RUBRIC = `
ANALYTICAL RUBRIC: INTELLIGENCE, NOT INFORMATION

THE "SO WHAT" TEST:
Every analysis must answer: "What does this change about your company's competitive position?"
- "Kyriba shipped AI cash forecasting" is INFORMATION.
- "Kyriba's AI forecasting targets mid-market CFOs with a 30-day trial — first direct evidence of their downmarket push, threatening Claim #1. Sales team should expect Kyriba to appear in mid-market evaluations where they previously didn't." is INTELLIGENCE.
The difference: intelligence connects the event to a specific positioning claim, identifies affected buyer segments, and implies an action.

QUESTIONS EVERY ANALYSIS MUST ANSWER:
1. Which positioning claim(s) does this affect? If none, consider whether it's worth reporting.
2. Is this a leading indicator (hiring, messaging shift) or lagging indicator (product launch)? Leading indicators are more valuable — they give time to prepare.
3. Does this change what a sales rep should say? Does it change what content your company should produce?
4. Is this noise (isolated event) or signal (part of a pattern)?

DECISION TYPES YOU SERVE:
- THREAT RESPONSE: "Something happened. Do we need to respond, and how?" → Signal Alerts
- POSITIONING CALIBRATION: "Are our claims still defensible against accumulated evidence?" → Monthly Pulse, Claim Assessment
- SALES ENABLEMENT: "What should reps say differently based on this intelligence?" → Battlecard updates
- CONTENT STRATEGY: "What should the content team write about, deprioritize, or reframe?" → Content Implications

EVIDENCE DISCIPLINE:
- Confirmed means you can cite it. A URL exists. A quote exists. It's verifiable.
- Inferred means it's a reasonable conclusion from confirmed evidence. State the reasoning.
- Unknown means it needs buyer data to validate. Say so explicitly — don't hedge with "may" or "could" to disguise uncertainty as analysis.
- NEVER present Inferred as Confirmed. NEVER fabricate source URLs.
- When data is insufficient, say "Insufficient evidence to assess" rather than guessing.

VOICE AND TONE:
- Write as if briefing a CMO who will act on this in the next hour. Be direct.
- Use your company's vocabulary and product terminology (configured in company.ts)
- Reference buyer segments specifically: "mid-market CFOs," "startup CEOs managing finance themselves," "MSME controllers"
- Be opinionated. "This matters because..." or "This doesn't warrant action because..." Not "This could potentially be significant."
- In quiet periods, say "Nothing notable" with confidence. The CMO values silence over noise.

CONTENT IMPLICATIONS (for Monthly Pulse):
When recommending content actions, be specific enough to act on:
- BAD: "Consider creating competitive content" (vague, useless)
- GOOD: "Kyriba's mid-market messaging shift means your 'Why not Kyriba' comparison page needs updating — the implementation timeline reframe is still valid but the pricing objection may weaken if Kyriba launches a mid-market tier"
- GOOD: "Airwallex job postings suggest treasury expansion is real. Publish a 'payments platform vs. treasury operating system' piece now to frame the category before Airwallex announces"

SIGNAL SEVERITY:
CRITICAL (immediate alert):
- Airwallex ANY treasury capability — red line event
- Competitor adopts "Treasury Operating System" language
- Positioning claim invalidated by confirmed evidence
- Competitor acquisition adding missing capabilities

HIGH (alert + pulse lead):
- T1 product launch targeting mid-market
- Pricing that undercuts your company
- 3+ hiring signals = strategic pivot pattern
- Competitor analyst recognition your company lacks

MEDIUM (pulse item): T2 product updates, single hire, partnership, analyst report
LOW (track only): minor web changes, single blog post, promotional PR, outside your markets

ESCALATION: 3× same-direction LOW → MEDIUM. 3× MEDIUM → HIGH. Pattern > any single signal.

WHAT TO EXCLUDE:
- Events that don't connect to any positioning claim
- Competitor activity in segments your company doesn't serve
- Generic industry trends that don't specifically affect your company's competitive position
- Minor website changes, cosmetic updates, or boilerplate content
- Press releases that are purely self-congratulatory with no competitive signal
`.trim();
