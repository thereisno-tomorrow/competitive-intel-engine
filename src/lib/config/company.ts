/**
 * Company configuration — the single file you edit to adapt this system to your company.
 *
 * Replace all placeholder values with your company's information before running.
 * The strategic context and competitor profiles are the most important inputs:
 * they turn a generic LLM into an analyst that understands your specific positioning.
 *
 * See: docs/setup.md for a full configuration guide.
 */

export const COMPANY_NAME = "Your Company";

/**
 * Core strategic context — injected into every LLM call.
 *
 * This is the "onboarding document" that turns a generic LLM into your competitive
 * intelligence analyst. Without it, the LLM produces competent summaries. With it,
 * the LLM produces intelligence.
 *
 * Keep this under ~2,800 tokens. Every word here costs tokens on every call.
 * Earn every sentence. Use compressed shorthand: [C]=Confirmed, [I]=Inferred, [U]=Unknown.
 *
 * Structure to follow:
 * - WHAT YOUR COMPANY IS: category, product, funding, team size
 * - PRODUCT CAPABILITIES: key features and differentiators
 * - YOUR HONEST POSITION: strong areas [C], weak areas [C]
 * - THREE POSITIONING CLAIMS: the analytical spine of the system
 * - TARGET SEGMENTS: who buys, at what price, how
 */
export const COMPANY_STRATEGIC_CONTEXT = `
[YOUR COMPANY]: STRATEGIC CONTEXT

WHAT [YOUR COMPANY] IS
[Replace with: your company's category, what it does, funding stage, team size, HQ.]

PRODUCT CAPABILITIES
[Replace with: your key product capabilities, listed as bullet points.]

YOUR HONEST POSITION:
Strong [C]:
[Replace with: your confirmed competitive strengths — what buyers have told you, what data supports.]

Weak [C unless noted]:
[Replace with: your confirmed or inferred weaknesses. Be honest — the LLM needs this to calibrate threat priority.]

Analytical rule: threats targeting YOUR WEAK areas are more urgent than threats targeting STRONG areas.

THREE POSITIONING CLAIMS (the system's analytical spine)
1. "[Replace with Claim #1]"
   Threats: [What moves by competitors would invalidate this claim?]
2. "[Replace with Claim #2]"
   Threats: [What moves by competitors would invalidate this claim?]
3. "[Replace with Claim #3]"
   Threats: [What moves by competitors would invalidate this claim?]

TARGET SEGMENTS:
[Replace with your buyer segments — who buys, company size, revenue range, buyer persona, ACV]

INTELLIGENCE CONSUMER:
[Replace with: who receives this intelligence, their role, what they care about, their decision criteria]

EVIDENCE GAPS:
[Replace with: what you don't know yet that would sharpen your competitive analysis]
`.trim();

/**
 * Extended geographic and temporal context — injected into synthesis prompts only.
 *
 * NOT injected into classification prompts (those need speed, not depth).
 * Used by: weekly-pulse, monthly-pulse, signal-alert, claim-assessment.
 *
 * Target: ≤800 tokens. Tables > prose.
 */
export const COMPANY_EXTENDED_CONTEXT = `
GEOGRAPHIC CONTEXT:
[Replace with a table of your key markets, licenses/presence, key threats per market, and your position.]

| Market   | License/Presence | Key Threats     | Your Position |
|----------|-----------------|-----------------|---------------|
| [Market] | [License]       | [Competitor]    | [Position]    |

Rule: weight signals by geographic relevance.

EVIDENCE FRESHNESS:
- Product capabilities: valid until contradicted. Flag if >6mo stale.
- Competitor positioning: volatile. Weight recent signals over defaults.
- Pricing: semi-stable. Flag if >3mo stale.
- Licensing/regulatory: stable. Changes slow and public.

PATTERN ACCUMULATION:
1 signal = data point (note). 2 = emerging (mention in pulse). 3+ = trend (lead with it, recommend action).
Contradictory signals: present both, state which is stronger and why.
`.trim();
