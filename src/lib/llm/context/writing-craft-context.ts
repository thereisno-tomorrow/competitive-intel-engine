/**
 * Writing craft context — injected into content draft generation prompts.
 *
 * Three ordered layers applied during writing:
 *   1. SEO / AEO — structural requirements for search discoverability and AI citation
 *   2. Structural Editor — kill template architecture, make writing feel discovered
 *   3. Beautiful Prose — sentence-level craft, kill AI cadence
 *
 * Based on the beautiful-prose and structural-editor skills.
 */

export const WRITING_CRAFT_CONTEXT = `
WRITING CRAFT CONTRACT
Apply these three layers IN ORDER. Layer 1 sets structure. Layer 2 sets architecture.
Layer 3 polishes sentences. Violations are failures.

═══════════════════════════════════════════════════
LAYER 1: SEO + AEO (Answer Engine Optimization)
═══════════════════════════════════════════════════

PURPOSE: Structure content so search engines rank it AND AI models (ChatGPT, Perplexity,
Claude, Gemini) cite it. In 2026, 73% of B2B buyers use AI tools in vendor research.
Perplexity converts 7x better than Google. Content that gets cited wins.

STRUCTURAL REQUIREMENTS:

1. DEFINITIVE ANSWER BLOCK — Within the first 150 words, include a clear, standalone
   summary statement that directly answers the question implied by the title. This is
   the paragraph AI models will extract and cite. Make it factual, specific, and
   self-contained. No "In this article we will explore..." preambles.

2. ENTITY-RICH H2 HEADINGS — Every H2 should contain a named entity (your company, a competitor
   category, or a domain concept) or a searchable question. Bad: "The Problem." Good:
   "Why Multi-Currency Reconciliation Breaks at 50 Transactions." Each H2 must be
   independently citable as a topic.

3. FAQ INTEGRATION — Include 2-3 question-and-answer pairs embedded naturally as H3
   subheadings within relevant sections (not bolted on at the end). Format:
   ### How does [specific thing] work for [specific buyer]?
   [Direct, definitive 2-3 sentence answer. Then expand.]
   These are the exact queries AI search surfaces.

4. STRUCTURED COMPARISONS — When comparing approaches, tools, or outcomes, use markdown
   tables. AI models and featured snippets strongly prefer tabular data over prose
   comparisons.

5. SPECIFIC NUMBERS AND DATA — Every section should contain at least one specific data
   point, metric, or quantified outcome. "Reduces reconciliation time" fails.
   "Reduces reconciliation from 4 hours to 12 minutes" gets cited.

6. INTERNAL TOPIC CLUSTERS — Reference your company's key concepts and product terms as bolded terms. This builds entity authority across the content ecosystem.

7. H1 → H2 → H3 HIERARCHY — Clean, no orphan H3s. Each H2 is a self-contained topic
   cluster. The document should make sense if you read only the H2 headings in sequence.

8. META-FRIENDLY OPENING — The first sentence should be a complete, definitive claim
   that works as a meta description. Under 160 characters if possible.

═══════════════════════════════════════════════════
LAYER 2: STRUCTURAL EDITOR (Kill Template Architecture)
═══════════════════════════════════════════════════

PURPOSE: The content must feel discovered, not assembled. Template writing has a
structural fingerprint that readers and AI models both penalize with low engagement.

TEMPLATE GHOSTS TO KILL:

The Five-Paragraph Ghost:
  [HOOK: Broad claim or reframe]
  [CONTEXT: Why this matters]
  [PROOF 1] → [PROOF 2] → [PROOF 3]
  [CTA: Conclusion restating the opening]
  If your draft follows this arc, restructure it.

The Listicle Ghost:
  [HOOK] → [Bold Header + Explanation] × 5 → [WRAP]
  Each section interchangeable, order doesn't matter, removing one wouldn't break anything.
  If your draft has this pattern, make sections build on each other.

The Sales Letter Ghost:
  [PAIN POINT] → [AGITATE] → [SOLUTION] → [PROOF] → [CTA]
  Problem-to-solution arc too clean, no tradeoffs acknowledged.
  If your draft has this arc, complicate it.

WHAT TO DO INSTEAD:

1. SURFACE THE BURIED LEDE — The most interesting insight is rarely the opening. Find
   the sentence you'd actually remember from this piece. Consider opening with it.

2. INTRODUCE TURNS — Linear arguments feel algorithmic. Add at least one:
   - Complication: "But this creates a different problem..."
   - Admission: "This doesn't work for every company..."
   - Reversal: "The obvious solution actually makes it worse."
   - Zoom: Suddenly getting very specific (a real scenario) or very abstract (the principle)

3. VARY PARAGRAPH RHYTHM — No uniform 3-5 sentence paragraphs. Follow a long paragraph
   (6-8 sentences) with a single sentence. Let some paragraphs breathe (2 sentences)
   while others develop fully. Match paragraph length to energy: high energy = short,
   reflective = long.

4. REMOVE SCAFFOLDING — If paragraph B logically follows paragraph A, you do not need
   to announce the transition. Kill: "Here's what...", "Let's explore...",
   "There are three reasons...", "First,... Second,... Third,...", "In conclusion,",
   "Additionally,", "Furthermore,", "Moreover,".
   The test: remove the transition, read both paragraphs together. If the connection is
   obvious, the transition was scaffolding.

5. MAKE THINKING VISIBLE — Show the reasoning, not just the conclusions. Include the
   question that sparked the insight. Show a consideration that didn't work out.
   Let the reader see the logic developing, not just the answer arriving.

6. LET FORM FOLLOW CONTENT — Does this argument naturally have three parts, or did you
   force it into three? Would a section work better as one long paragraph? As fragments?
   What if you cut the introduction entirely and started with the first concrete example?

═══════════════════════════════════════════════════
LAYER 3: BEAUTIFUL PROSE (Sentence-Level Craft)
═══════════════════════════════════════════════════

PURPOSE: Clean, exact, muscular prose. Readable at speed, rewarding on reread.
Concrete, image-bearing, verb-forward. Free of modern content-marketing cadence.

ABSOLUTE PROHIBITIONS — treat these as hard failures:

1. EM DASHES — Rewrite the sentence to avoid them entirely. Use a comma, period,
   parentheses, or colon instead. Maximum 1 per entire document, and only if it earns
   its place. Em dashes are the #1 AI writing tell.

2. "IT'S NOT X, IT'S Y" — Ban the pattern and all variants:
   "This isn't about X. It's about Y."
   "Not X but Y."
   "The real story is Y." (when it's only a pivot)

3. FILLER TRANSITIONS — Ban completely:
   "At its core" / "In today's world" / "In a world where" / "That said" /
   "Let's explore" / "Ultimately" / "What this means is" /
   "It's important to note" / "On the one hand" / "When it comes to" /
   "The reality is" / "Here's the thing"

4. AI TELLS AND META COMMENTARY — Ban completely:
   "In this article" / "This piece explores" / "We will discuss" /
   "Here are the key takeaways" / "Let's dive in" / "Without further ado" /
   "As we've seen" / "To summarize"

5. SYMMETRY PADDING — No balancing sentences for the sake of balance.
   No three-part lists unless earned by the content. No "X, Y, and Z" as decoration.

POSITIVE CONSTRAINTS — actively do these:

SENTENCE CRAFT:
- Prefer declarative sentences
- Vary length aggressively: a 25-word sentence, then a 5-word sentence, then 15
- Short sentences are impact. Use them.
- Questions are allowed only when they cut, never as rhetorical filler

WORD CHOICE:
- Concrete nouns over abstractions ("bank portals" not "financial interfaces")
- Strong verbs over adverbs ("slashes reconciliation time" not "significantly reduces")
- Anglo-Saxon weight when possible, Latinate precision only when it buys accuracy
- Use the buyer's language, not marketing language

RHYTHM AND STRUCTURE:
- Open with substance, not a hook or throat-clearing
- Close cleanly without restating the thesis
- Every paragraph must advance meaning; if it restates the previous one, cut it
- White space is intentional

AUTHORITY:
- Write as if truth does not need permission
- Avoid hedging unless uncertainty is genuine and explicit
- Do not posture. Do not moralize. State and move on.

QUALITY BAR (self-check before finalizing):
- Remove any line that sounds like it was assembled from templates
- Remove any sentence that merely repeats the previous one in different words
- Remove any sentence that exists to guide the reader's emotions
- If five consecutive sentences have similar length, rewrite at least two
- Read the opening paragraph: if it could appear on any competitor's blog unchanged, rewrite it
`.trim();
