/**
 * Intelligence Layer Rubric — Advanced competitive intelligence reasoning.
 *
 * This teaches the LLM to think like a strategic analyst, not just a classifier.
 * It applies temporal analysis, threat modeling, pattern recognition, and buyer
 * perspective to transform raw intelligence items into strategic insights.
 *
 * Injected into synthesis prompts (weekly/monthly pulse, signal alerts) where
 * deeper analysis is needed. NOT injected into classification (speed-critical).
 *
 * Target: ~1,200 tokens. Every word earns its place.
 */

export const INTELLIGENCE_LAYER_RUBRIC = `
INTELLIGENCE LAYER: TEMPORAL, THREAT, AND PATTERN ANALYSIS

=== 1. TEMPORAL ANALYSIS ===

TIME DECAY vs COMPOUNDING:
Intel has half-lives. Some signals lose value fast; others gain value as evidence accumulates.
- DECAY FAST (days-weeks): Pricing announcements, outages, press releases, promotional content
- COMPOUND OVER TIME (months): Hiring signals, messaging shifts, partnerships, SEO changes
- Pattern: Job posting alone = [U]. Three job postings over 2 months = [I] with high confidence.

VELOCITY DETECTION:
Ask: "Is this competitor accelerating or decelerating in areas that threaten your company?"
- Acceleration signals: hiring frequency ↑, release cadence ↑, geographic expansion ↑, messaging intensity ↑
- Deceleration signals: quiet periods after launches, leadership departures, messaging rollback
- Example: "Airwallex: 1 treasury job post/month Jan-Mar → 5 posts in April = acceleration [CRITICAL]"
- Example: "Kyriba: 2 product launches/month H1 2025 → 0 launches Q3 2025 = deceleration [monitoring]"

LEAD vs LAG INDICATORS:
- LEAD (predict future, 3-6mo lead time): hiring, messaging shifts, partnerships announced before product, job descriptions revealing strategy, SEO positioning changes
  → "Kyriba hiring 'Mid-Market Sales Lead' = 3-6mo lead on mid-market product launch"
- LAG (confirm past strategy): product launches, press releases, pricing pages, case studies
  → "Launch press release confirms what hiring signaled 4 months ago"
- Weight: Lead indicators 2× value of lag when assessing emerging threats. They give time to prepare.

TEMPORAL STACKING (pattern maturity):
When multiple signals point same direction across time:
- 1 event = noise, data point worth noting
- 2 events, 30+ days apart = pattern emerging, monitor closely
- 3+ events = confirmed trend → elevate to HIGH priority, recommend action
Example: "Trovata partnership (Jan) + payments engineer hire (Feb) + 'integrated payments' in blog (Apr) = payments capability build [I→C over 3mo]"

=== 2. THREAT MODELING ===

PERSISTENT THREAT TRACKING:
Each competitor has an ongoing threat profile (see COMPETITOR_PROFILES). Intelligence updates threat status:
- DORMANT: no recent signals (30+ days), existing capabilities unchanged, no strategic movement detected
- EMERGING: 1-2 lead indicators present, status [U] or weak [I], pattern not yet confirmed
- ACTIVE: 3+ signals OR 1 confirmed capability, status [I] or [C], clear strategic direction
- CRITICAL: threatens core positioning claim, status [C], requires immediate defensive response

SEGMENT-SPECIFIC THREATS:
Same competitive move, different threat level by segment. Always specify.
- Kyriba mid-market SKU → CRITICAL for mid-market, LOW for startup (outside their motion)
- Airwallex treasury → CRITICAL across all segments (brand + infrastructure advantage applies everywhere)
- Trovata adding payments → MEDIUM for MSME/mid-market, LOW for startup (feature overkill)
- GTreasury 90-day implementation → HIGH for enterprise, LOW for mid-market (still too slow/expensive)

MOVE CLASSIFICATION (what type of competitive move):
- POSITIONING: messaging changes, category language adoption, narrative shifts, brand repositioning
  → "Trovata adopts 'Treasury Operating System' language [CRITICAL - category theft attempt]"
- PRODUCT: capabilities, features, integrations, platform architecture
  → "Kyriba TAI launch [HIGH - threatens Claim #2 'Real-time cash visibility' if TAI validated by buyers]"
- GTM: pricing, packaging, sales hiring, geographic expansion, partnership distribution
  → "Kyriba 'Mid-Market Sales Lead' hire [HIGH - threatens Claim #1 structural advantage in mid-market]"

DEFENSIVE vs OFFENSIVE OPPORTUNITIES:
For EVERY threat identified, ask BOTH questions:
1. DEFENSIVE: "How do we protect our positioning against this?" → Positioning adjustments, content rebuttals, sales enablement, product acceleration
2. OFFENSIVE: "What weakness does this competitive move expose?" → Competitor overextension, focus dilution, capability gaps, market neglect

Examples of offensive thinking:
- "Kyriba downmarket push = enterprise customers underserved → opportunity for your company to target displaced enterprise TMS users moving to mid-market subsidiaries"
- "Airwallex hiring treasury engineers = payments product focus diluted → emphasize your unified platform vs their fragmented bolt-on"
- "HighRadius '95% AI accuracy' claim = creates quantitative bar mid-market buyers can't verify → position on 'explainable AI' and 'accuracy you can audit' vs black-box promises"
- "Trovata silence on API-first architecture = integration story weak → lead with developer experience and API-first positioning"

=== 3. PATTERN RECOGNITION ===

COMPETITIVE NARRATIVES (story construction):
Signals alone = data points. Sequences of signals = strategic narratives.
Ask: "What story is the competitor building through their actions over time?"
- Example: "Kyriba: TAI launch (Nov) + audit compliance blog series (Dec-Jan) + CFO trust webinar (Feb) = building 'trust-first AI for regulated enterprise' narrative"
- Track: Is narrative aimed at your company's segments? Does it reframe your strengths as weaknesses? ("We're established and audited" = "You are unproven and risky")

CROSS-COMPETITOR PATTERNS (category shift signals):
When 2+ competitors converge on same capability/language within 6 months → category is shifting, not just one competitor moving.
- "Airwallex treasury hire + Trovata payments partnership + Nium 'financial control' messaging = payments platforms all moving toward treasury convergence"
- This invalidates "only combined platform" positioning faster than any single competitor could.
- Flag: Does this make your company's claim table stakes rather than differentiator?

STRATEGIC INTENT INFERENCE (the "WHY" question):
Don't just report WHAT happened. Infer WHY the competitor is doing this.
- "Kyriba hiring mid-market sales = they see enterprise market saturated, need growth vector, willing to risk brand dilution for TAM expansion"
- "HighRadius 95% accuracy claim = creating quantitative performance bar your company can't yet match at current scale, forcing buyers to discount 'AI-native' messaging"
- "Airwallex quiet on treasury despite 3 months of hiring signals = building in stealth to avoid tipping off competitors, expect H2 2026 launch with marketing blitz"

=== 4. BUYER PERSPECTIVE ===

TABLE STAKES DETECTION:
Features stop being differentiators when 3+ competitors have parity. Call it out explicitly.
- "If Kyriba, Trovata, AND your company all have 13-week cash forecasting → it's table stakes, not a competitive wedge"
- "Multi-bank visibility now standard across cloud TMS platforms → your advantage eroded, need new differentiator"
- Implication: When table stakes shift, your company must find new positioning ground or risk commodity competition.

CATEGORY EVOLUTION vs COMPETITIVE THREAT:
Distinguish market-wide maturation from competitor-specific pressure.
- CATEGORY EVOLUTION: "AI in treasury becoming buyer expectation, not novel feature" → affects all players equally, your company included
- COMPETITIVE THREAT: "Kyriba's TAI launch specifically positions against 'AI-native' narrative your company uses" → targets your company directly
- Response differs: Category evolution = adapt positioning. Competitive threat = counter-position or differentiate elsewhere.

BUYER CONFUSION RISK:
When competitor messaging creates category ambiguity or brand overlap:
- "Airwallex calling platform 'financial infrastructure' vs your company's category name → buyers may not understand difference, defaulting to brand recognition (larger brand wins ties)"
- "Competitor adopting your category language → category theft, dilutes your positioning clarity"

=== 5. CONFIDENCE & URGENCY (independent dimensions) ===

EVIDENCE TIER EVOLUTION:
Track how confidence in a threat assessment changes over time. Show the progression explicitly.
- Single job posting = [U] (could be replacement hire, exploratory, cancelled)
- 3 job postings same function = [I] (pattern suggests strategic build)
- Product page launch with pricing = [C] (confirmed capability, market-facing)
- Show transition: "Airwallex treasury threat: [U] Jan (1 hire) → [I] Apr (5 hires, messaging shift) → monitoring for [C] (product announcement)"

CONFIDENCE ≠ URGENCY:
Two independent axes. High confidence doesn't mean high urgency, and vice versa.
- HIGH confidence, LOW urgency: "Kyriba enterprise pricing confirmed [C] but they're not entering mid-market yet, no immediate action needed"
- LOW confidence, HIGH urgency: "Airwallex treasury capability still [U] but if true, it's existential threat to Claim #1 — invest in intelligence gathering NOW"
- Response calibration:
  - High confidence + high urgency = immediate action (content, sales enablement, positioning adjustment)
  - High confidence + low urgency = monitor, prepare contingency
  - Low confidence + high urgency = invest in closing intelligence gap (buyer interviews, sales intel, channel sources)
  - Low confidence + low urgency = background monitoring only

=== 6. KNOWN UNKNOWNS (Anti-Space) ===

INTELLIGENCE GAPS:
For every strategic analysis, explicitly name what we DON'T know. Silence on gaps = false confidence.
- "Kyriba TAI traction with mid-market buyers: UNKNOWN — no mid-market case studies, no G2 reviews mentioning TAI in mid-market context"
- "Trovata vs your company head-to-head win/loss rate: UNKNOWN — need sales team deal data, CRM analysis"
- "Airwallex treasury module pricing model: UNKNOWN — will they bundle with payments or separate SKU? Pricing could invalidate our mid-market advantage"

BLIND SPOT SURFACING:
What SHOULD we be seeing but aren't? Absence of expected signals is itself intelligence.
- "Airwallex expanding licensing to UK/SG but zero intel on treasury capabilities in those markets = either (a) not building treasury OR (b) we're missing the signals (check local job boards, regional press)"
- "Zero HighRadius mid-market case studies despite AI positioning claims = either (a) enterprise-only strategy OR (b) weak mid-market adoption (check G2 review distribution by company size)"

RESEARCH PRIORITIZATION:
Not all gaps matter equally. Rank by: (threat severity × confidence gap)
- PRIORITY 1 [CRITICAL threat, UNKNOWN status]: "Airwallex treasury launch plans" → buyer interviews asking "what have you heard?", sales intel from competitive deals, LinkedIn signal monitoring
- PRIORITY 2 [HIGH threat, UNKNOWN status]: "Kyriba mid-market product-market fit" → G2 review analysis, mid-market buyer interviews, sales team deal retrospectives
- PRIORITY 3 [MEDIUM threat, UNKNOWN status]: "Trovata payments integration timeline" → monitor blog/changelog, track engineering hires, watch partnership announcements

=== 7. INTEGRATION WITH PULSES ===

WEEKLY PULSE APPLICATION:
Add temporal context to signal interpretation, but only when it changes the "so what":
- "Nium partnership announcement (LAG indicator) — no prior hiring signals (missing LEAD) suggests this is a partnership integration, not in-house build. Lower threat than if they were hiring payments engineers."
- "Kyriba blog posting frequency ↑ 40% this week vs last 3-month average = content campaign acceleration, likely precedes product announcement in 4-8 weeks"

MONTHLY PULSE APPLICATION:
- "Threat Status Updates" section: show DORMANT → EMERGING → ACTIVE → CRITICAL transitions with evidence counts
- "Cross-Competitor Patterns": when 2+ competitors move in same direction within the month
- "Known Unknowns": top 3 intelligence gaps ranked by (threat severity × confidence gap)
- "Offensive Opportunities": competitor weaknesses exposed by their moves this month, with recommended response

SIGNAL ALERT APPLICATION:
- Temporal context: "This is the 4th Airwallex treasury signal in 60 days (ACCELERATING from 1/month baseline) — threat escalation"
- Strategic intent: "WHY Airwallex is doing this matters more than WHAT they launched — intent reveals next moves"
- Offensive angle: "Their treasury expansion means payments product investment diluted — opportunity to emphasize your unified platform vs their fragmented bolt-on"

=== ANALYTICAL DISCIPLINE ===

COMPRESSED NOTATION (save tokens, increase clarity):
- Use: [C], [I], [U] for evidence tiers
- Use: [CRITICAL], [HIGH], [MEDIUM], [LOW] for severity
- Use: ↑, ↓ for acceleration/deceleration
- Use: → for causation/implication ("hiring surge → product launch in 3-6mo")

INFERENCE CHAINS (show your reasoning):
Every inference must show the reasoning chain:
- BAD: "Airwallex is building treasury" (assertion without evidence)
- GOOD: "5 treasury engineer hires in 60 days + 'cash visibility' messaging shift → Airwallex building treasury module [I], expect beta launch Q3 2026"

SIGNAL vs NOISE (graduated certainty):
- Data point (1 signal) = "worth noting, insufficient for conclusion"
- Pattern (2-3 signals) = "emerging, monitor closely"
- Trend (persistent direction, 3+ signals over time) = "confirmed, act on this"

COMPANY SPECIFICITY (the "so what" test):
Always answer: "So what for your company specifically?" Generic competitive analysis = noise.
- NOT: "Kyriba launched AI forecasting" (event description)
- YES: "Kyriba's AI forecasting targets mid-market CFOs with 30-day trial — first direct evidence of downmarket push, threatens Claim #1. Sales team should expect Kyriba in mid-market evaluations where they previously didn't appear."

THIS IS NOT A CHECKLIST.
These are analytical lenses. Apply selectively when they add strategic insight. If a lens doesn't change the "so what" or recommended action, skip it. The goal is sharper decisions, not longer reports.
`.trim();
