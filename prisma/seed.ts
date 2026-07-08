import "dotenv/config";
import {
  PrismaClient,
  CompetitorTier,
  SourceType,
  SourceCadence,
  EvidenceTier,
  ClaimStatus,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data
  await prisma.generatedOutput.deleteMany();
  await prisma.battlecardReframe.deleteMany();
  await prisma.battlecard.deleteMany();
  await prisma.intelligenceItem.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.positioningClaim.deleteMany();
  await prisma.competitor.deleteMany();

  // === Positioning Claims ===
  // Replace these with your company's actual positioning claims.
  const claim1 = await prisma.positioningClaim.create({
    data: {
      claimText:
        "[Claim 1: Replace with your company's primary positioning claim]",
      currentStatus: ClaimStatus.HOLDING,
    },
  });
  const claim2 = await prisma.positioningClaim.create({
    data: {
      claimText:
        "[Claim 2: Replace with your company's secondary positioning claim]",
      currentStatus: ClaimStatus.HOLDING,
    },
  });
  const claim3 = await prisma.positioningClaim.create({
    data: {
      claimText:
        "[Claim 3: Replace with your company's tertiary positioning claim]",
      currentStatus: ClaimStatus.HOLDING,
    },
  });

  // === Competitors ===
  // Replace with your actual competitors and which claims they threaten.
  const competitor1 = await prisma.competitor.create({
    data: {
      name: "[Competitor 1 — Tier 1]",
      tier: CompetitorTier.TIER_1,
      threatenedClaims: { connect: [{ id: claim1.id }, { id: claim2.id }] },
    },
  });
  const competitor2 = await prisma.competitor.create({
    data: {
      name: "[Competitor 2 — Tier 1]",
      tier: CompetitorTier.TIER_1,
      threatenedClaims: { connect: [{ id: claim1.id }, { id: claim3.id }] },
    },
  });
  const competitor3 = await prisma.competitor.create({
    data: {
      name: "[Competitor 3 — Tier 2]",
      tier: CompetitorTier.TIER_2,
      threatenedClaims: { connect: [{ id: claim1.id }] },
    },
  });
  const competitor4 = await prisma.competitor.create({
    data: {
      name: "[Competitor 4 — Tier 2]",
      tier: CompetitorTier.TIER_2,
      threatenedClaims: { connect: [{ id: claim3.id }] },
    },
  });
  const competitor5 = await prisma.competitor.create({
    data: {
      name: "[Competitor 5 — Tier 2]",
      tier: CompetitorTier.TIER_2,
      threatenedClaims: { connect: [{ id: claim2.id }] },
    },
  });
  const competitor6 = await prisma.competitor.create({
    data: {
      name: "[Competitor 6 — Tier 2]",
      tier: CompetitorTier.TIER_2,
      threatenedClaims: { connect: [{ id: claim1.id }] },
    },
  });

  // === Data Sources ===
  // Replace competitor names in URLs with your actual competitors.
  const sources = [
    // --- Google News RSS feeds (per-competitor) ---
    // Aggregates all press coverage about each competitor from industry press,
    // business news, competitor newsrooms, etc. into individual articles.
    {
      competitorId: competitor1.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_1_NAME%22",
      cadence: SourceCadence.DAILY,
    },
    {
      competitorId: competitor2.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_2_NAME%22",
      cadence: SourceCadence.DAILY,
    },
    {
      competitorId: competitor3.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_3_NAME%22",
      cadence: SourceCadence.DAILY,
    },
    {
      competitorId: competitor4.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_4_NAME%22",
      cadence: SourceCadence.DAILY,
    },
    {
      competitorId: competitor5.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_5_NAME%22",
      cadence: SourceCadence.DAILY,
    },
    {
      competitorId: competitor6.id,
      type: SourceType.PRESS_RSS,
      url: "https://news.google.com/rss/search?q=%22COMPETITOR_6_NAME%22",
      cadence: SourceCadence.DAILY,
    },

    // --- High-value STATE sources (pricing, status) ---
    // Add competitor pricing pages, status pages, and changelogs here.
    // Examples:
    // { competitorId: competitor1.id, type: SourceType.WEBSITE, url: "https://competitor1.com/pricing", cadence: SourceCadence.DAILY },
    // { competitorId: competitor2.id, type: SourceType.STATUS_PAGE, url: "https://status.competitor2.com/", cadence: SourceCadence.DAILY },

    // --- New-source connectors (U20–U22), free + keyless ---
    // REGULATORY (U20): host-routed SEC EDGAR JSON or MAS FI directory. Curated
    // direct-pin URLs (CIK submissions endpoint / MAS entity page). Confirmed anchor.
    // { competitorId: competitor1.id, type: SourceType.REGULATORY, url: "https://data.sec.gov/submissions/CIK0000000000.json", cadence: SourceCadence.WEEKLY },
    // { competitorId: competitor2.id, type: SourceType.REGULATORY, url: "https://eservices.mas.gov.sg/fid/institution/detail/XXXXX", cadence: SourceCadence.WEEKLY },
    //
    // JOB_POSTING (U21): a competitor careers page (hiring-intent signal, Inferred tier).
    // { competitorId: competitor1.id, type: SourceType.JOB_POSTING, url: "https://competitor1.com/careers", cadence: SourceCadence.WEEKLY },
    //
    // SEO (U22): a competitor content/search surface (lower-signal, cheap).
    // { competitorId: competitor1.id, type: SourceType.SEO, url: "https://competitor1.com/blog", cadence: SourceCadence.WEEKLY },

    // --- LinkedIn phantoms (PhantomBuster) ---
    // Placeholder agent IDs — replace with real PB phantom IDs after setup.
    // Format: pb://{phantomAgentId}/posts|jobs|company
    // Each competitor gets 3 LinkedIn sources for posts, jobs, and company info.
    ...[
      { competitor: competitor1, label: "COMPETITOR_1" },
      { competitor: competitor2, label: "COMPETITOR_2" },
      { competitor: competitor3, label: "COMPETITOR_3" },
      { competitor: competitor4, label: "COMPETITOR_4" },
      { competitor: competitor5, label: "COMPETITOR_5" },
      { competitor: competitor6, label: "COMPETITOR_6" },
    ].flatMap(({ competitor, label }) => [
      {
        competitorId: competitor.id,
        type: SourceType.LINKEDIN,
        url: `pb://SETUP_REQUIRED_${label}_POSTS/posts`,
        cadence: SourceCadence.DAILY,
      },
      {
        competitorId: competitor.id,
        type: SourceType.LINKEDIN,
        url: `pb://SETUP_REQUIRED_${label}_JOBS/jobs`,
        cadence: SourceCadence.DAILY,
      },
      {
        competitorId: competitor.id,
        type: SourceType.LINKEDIN,
        url: `pb://SETUP_REQUIRED_${label}_COMPANY/company`,
        cadence: SourceCadence.WEEKLY,
      },
    ]),
  ];

  for (const source of sources) {
    await prisma.dataSource.create({ data: source });
  }

  // === Battlecards for Tier 1 ===
  // Replace the placeholder content below with your actual competitive intelligence.
  // The structure shows the full schema — fill in your real talk tracks, proof points, and win/loss data.
  await prisma.battlecard.create({
    data: {
      competitorId: competitor1.id,
      whenTheyComeUp:
        "[Describe the deal scenarios where this competitor appears — what type of prospect, what they say, why they're on the shortlist]",
      theirPitch: [
        "[Their key claim 1]",
        "[Their key claim 2]",
        "[Their key claim 3]",
        "[Their key claim 4]",
      ],
      weaknesses: [
        {
          text: "[Confirmed weakness with public evidence]",
          evidenceTier: "CONFIRMED",
          sourceUrl: "https://example.com/source",
        },
        {
          text: "[Inferred weakness from behavior or product signals]",
          evidenceTier: "INFERRED",
          sourceUrl: "https://example.com/source",
        },
      ],
      openQuestions: [
        "[What intelligence gap would most change how you position against them?]",
        "[What do you need to learn about their roadmap or pricing?]",
        "[What are you still uncertain about in head-to-head evaluations?]",
      ],
      overview:
        "[2-3 sentence overview of who this competitor is, their market position, funding, and why they show up in your deals. Be factual — this is for sales reps who need context fast.]",
      quickDismiss: {
        keyDismissals: [
          "[Short dismissal 1 — one sentence, focused on their structural weakness]",
          "[Short dismissal 2]",
          "[Short dismissal 3]",
        ],
        talkTrack:
          "[The 2-3 sentence talk track your sales team uses when a prospect mentions this competitor. Should end with a discovery question that shifts the frame back to your strengths.]",
      },
      whyWeWin: [
        {
          point: "[Win reason 1 — your structural advantage]",
          context:
            "[Why this advantage exists, what the competitor can't do about it, what the buyer gains]",
          action:
            "[Specific question or move your rep makes to surface this advantage in the deal]",
          evidenceTier: "CONFIRMED",
        },
        {
          point: "[Win reason 2]",
          context: "[Context]",
          action: "[Action]",
          evidenceTier: "CONFIRMED",
        },
      ],
      whyWeLose: [
        {
          point: "[Loss reason 1 — their genuine strength]",
          context:
            "[Why this is real, not a fake objection. When does this actually cost you deals?]",
          action:
            "[How to reframe or work around this, not deny it. Acknowledge and redirect.]",
          evidenceTier: "CONFIRMED",
        },
        {
          point: "[Loss reason 2]",
          context: "[Context]",
          action: "[Action]",
          evidenceTier: "CONFIRMED",
        },
      ],
      trapQuestions: [
        {
          question:
            "[A discovery question that surfaces the competitor's weakness without naming them]",
          whyItWorks:
            "[Why this question forces the prospect to confront the gap — what it makes them realize]",
          followUp:
            "[Your company's response that bridges from their realization to your value prop]",
        },
        {
          question: "[Trap question 2]",
          whyItWorks: "[Why it works]",
          followUp: "[Follow-up]",
        },
      ],
      proofPoints: [],
    },
  });

  await prisma.battlecard.create({
    data: {
      competitorId: competitor2.id,
      whenTheyComeUp:
        "[Describe the deal scenarios where this competitor appears]",
      theirPitch: [
        "[Their key claim 1]",
        "[Their key claim 2]",
        "[Their key claim 3]",
      ],
      weaknesses: [
        {
          text: "[Confirmed weakness]",
          evidenceTier: "CONFIRMED",
          sourceUrl: "https://example.com/source",
        },
        {
          text: "[Inferred weakness]",
          evidenceTier: "INFERRED",
          sourceUrl: "https://example.com/source",
        },
      ],
      openQuestions: [
        "[Intelligence gap 1]",
        "[Intelligence gap 2]",
      ],
      overview:
        "[Overview of competitor 2 — who they are, market position, why they matter]",
      quickDismiss: {
        keyDismissals: [
          "[Dismissal 1]",
          "[Dismissal 2]",
          "[Dismissal 3]",
        ],
        talkTrack:
          "[Talk track for competitor 2]",
      },
      whyWeWin: [
        {
          point: "[Win reason 1]",
          context: "[Context]",
          action: "[Action]",
          evidenceTier: "CONFIRMED",
        },
      ],
      whyWeLose: [
        {
          point: "[Loss reason 1]",
          context: "[Context]",
          action: "[Action]",
          evidenceTier: "CONFIRMED",
        },
      ],
      trapQuestions: [
        {
          question: "[Trap question 1]",
          whyItWorks: "[Why it works]",
          followUp: "[Follow-up]",
        },
      ],
      proofPoints: [],
    },
  });

  // === Battlecard Reframes for Tier 1 ===
  // Reframes are specific objection handlers tied to a competitor weakness.
  // Only create reframes for CONFIRMED-tier evidence (see validators.ts).
  const competitor1Reframes = [
    {
      competitorId: competitor1.id,
      weakness: "[Competitor weakness — e.g. 'Enterprise pricing excludes mid-market']",
      reframe:
        "[How to reframe this weakness in a sales conversation. Include a specific question to ask, then bridge to your advantage.]",
      antiReframe:
        "[What NOT to say — the overclaim or dismissal that loses trust. Keep the reframe credible.]",
      evidenceTier: EvidenceTier.CONFIRMED,
    },
    {
      competitorId: competitor1.id,
      weakness: "[Competitor weakness 2]",
      reframe: "[Reframe 2]",
      antiReframe: "[Anti-reframe 2]",
      evidenceTier: EvidenceTier.CONFIRMED,
    },
  ];

  const competitor2Reframes = [
    {
      competitorId: competitor2.id,
      weakness: "[Competitor weakness]",
      reframe: "[Reframe]",
      antiReframe: "[Anti-reframe]",
      evidenceTier: EvidenceTier.CONFIRMED,
    },
  ];

  for (const reframe of [...competitor1Reframes, ...competitor2Reframes]) {
    await prisma.battlecardReframe.create({ data: reframe });
  }

  console.log("Seed complete:");
  console.log(`  - ${6} competitors`);
  console.log(`  - ${3} positioning claims`);
  console.log(`  - ${sources.length} data sources`);
  console.log(
    `  - ${competitor1Reframes.length + competitor2Reframes.length} battlecard reframes`,
  );
  console.log(`  - ${2} battlecards`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
