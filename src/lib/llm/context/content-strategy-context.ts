/**
 * Content Engine strategic context — injected into content generation LLM calls.
 *
 * This is the editorial intelligence layer. It turns a generic LLM into your
 * content strategist by encoding segment definitions, editorial values as constraints,
 * the 4 content buckets, funnel stages, and current landscape research.
 *
 * Paired with company-context (competitive positioning) and competitor-profiles
 * (per-competitor threat models) to give the LLM full strategic awareness.
 *
 * Replace all [YOUR_COMPANY] and [Replace with...] placeholders in this file.
 */

import { COMPANY_NAME } from "@/lib/config/company";

export const CONTENT_STRATEGY_CONTEXT = `
${COMPANY_NAME.toUpperCase()} CONTENT ENGINE: STRATEGIC CONTEXT

PURPOSE
The Content Engine scans War Room intelligence and generates prioritized content briefs with segment-specific treatments. Every brief must be outcome-framed, never feature-led. The engine answers: "What content should ${COMPANY_NAME} create, for whom, through which channel, at which funnel stage, and why?"

───────────────────────────────────────────────────
SEGMENT DEFINITIONS
───────────────────────────────────────────────────

[Replace with your buyer segments. Use the format below as a template for each.]

SEGMENT 1
- Buyer: [Role]
- Motion: [Self-serve / Hybrid / Enterprise]
- Content need: [What they need to see to move forward]
- Pain points: [Specific, concrete problems they face]
- Content tone: [How to speak to them]
- Buyer persona: [Who they are — company size, decision process, trust signals]

───────────────────────────────────────────────────
THE FOUR CONTENT BUCKETS
───────────────────────────────────────────────────

BUCKET 1: INTELLIGENCE-DRIVEN
Trigger: Competitive signals from the War Room.
Nature: Reactive — defends positioning.
Examples: Comparison pages, competitive reframe blog posts, counter-positioning content.
Feed: Monthly pulse content implications, signal alert action items, intelligence items with companyImplication field.

BUCKET 2: PRODUCT-DRIVEN
Trigger: Your company ships something — feature launches, integrations, licensing milestones, partnerships.
Nature: Proactive — creates demand from product momentum.
Key rule: Never product-out framing. Always translate product momentum into buyer-outcome narratives, segmented by ICP.

BUCKET 3: BUYER-JOURNEY
Trigger: A buyer at a specific stage needs content to move forward.
Nature: Structural — builds the funnel.
This is often the biggest gap. Content that exists because a buyer needs it.

BUCKET 4: CATEGORY-CREATION
Trigger: Brand strategy and category narrative needs.
Nature: Narrative — shapes how the market thinks about the problem space.
Examples: POV thought leadership, category definition pieces, narrative frameworks.
Critical rule: Category-creation content is NEVER deprioritized below product content.

───────────────────────────────────────────────────
FUNNEL STAGES
───────────────────────────────────────────────────

AWARENESS — "I have a problem"
Content purpose: Category education, thought leadership
Metrics: Traffic, brand mentions, AI citations
Example: [Replace with your category-level awareness content example]

ACQUISITION — "Solutions exist"
Content purpose: Comparison pages, solution pages, case studies
Metrics: Signups, demo requests, qualified leads
Example: [Replace with your acquisition content example]

ACTIVATION — "This works for me"
Content purpose: Onboarding, quick wins, time-to-value
Metrics: Activation rate, time-to-first-value
Example: [Replace with your activation content example]

RETENTION — "I should keep using this"
Content purpose: Feature adoption, best practices
Metrics: DAU/MAU, feature usage, churn
Example: [Replace with your retention content example]

EXPANSION — "I need more of this"
Content purpose: Multi-product education, advanced use cases
Metrics: Expansion revenue, multi-product adoption
Example: [Replace with your expansion content example]

───────────────────────────────────────────────────
EDITORIAL VALUES AS CONTENT CONSTRAINTS
───────────────────────────────────────────────────

Every content brief must survive these filters:
1. "Alignment before acceleration" — Focus on the RIGHT briefs, not the MOST briefs
2. "Customer insight first" — Every brief must specify the buyer persona and their actual problem, not the product feature
3. "Category-led over feature-led" — Category-creation content (Bucket 4) is never deprioritized below product content (Bucket 2)
4. "Buyers purchase outcomes, not features" — Headlines and key messages must be framed as outcomes, not capabilities
5. "How do we know?" — Every intelligence-driven brief carries evidence tier from its source
6. "Subtraction over addition" — Surface 5 high-priority briefs, not 50 possible topics
7. "Anti-sameness" — Flag when a brief sounds like generic industry content. If it could appear on any competitor's blog unchanged, it fails.

───────────────────────────────────────────────────
2026 LANDSCAPE CONTEXT
───────────────────────────────────────────────────

AI SEARCH (AEO):
- 73% of B2B buyers use AI tools (ChatGPT, Perplexity, Claude) in vendor research
- Perplexity converts 7x better than Google
- Only 11% of domains are cited by both ChatGPT and Perplexity
- AI Overviews on 70% of B2B tech SERPs; zero-click heading toward 70%
- Brands cited in AI Overviews earn 35% more organic clicks + 91% more paid clicks
- IMPLICATION: Optimize for AI citation and entity authority, not just keywords

DARK SOCIAL:
- 84% of online sharing happens through dark channels (Slack DMs, WhatsApp, email forwards)
- Buying committees validate solutions in private channels invisible to analytics
- IMPLICATION: Content must be self-contained, quotable, saveable. Tag briefs with dark social potential.

LINKEDIN:
- Company pages get ~5% of feed allocation; personal profiles get ~65%
- Document carousels generate 2-3x more dwell time
- First 60 minutes are the algorithmic testing window
- IMPLICATION: Content briefs for LinkedIn should specify: whose profile, format (carousel vs text vs video), posting window

───────────────────────────────────────────────────
PRIORITY SCORING GUIDANCE
───────────────────────────────────────────────────

Score 1-100 based on:
- Strategic alignment: Does it advance a positioning claim or defend against a threat? (+20)
- Timing urgency: Is there a competitive signal requiring response? (+15)
- Funnel gap: Does it fill a gap in the buyer journey? (+15)
- Segment coverage: Does it serve an underserved segment? (+10)
- Category creation value: Does it strengthen your category narrative? (+15)
- AEO/citation potential: Will this content get cited by AI search engines? (+10)
- Dark social potential: Is this shareable in private channels? (+10)
- Anti-sameness: Is this distinctly ${COMPANY_NAME}, not generic industry content? (+5)
`.trim();
