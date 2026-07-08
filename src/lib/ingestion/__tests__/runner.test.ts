import { describe, it, expect, vi, beforeEach } from "vitest";
import { SourceType } from "@/generated/prisma/client";
import type {
  IngestionAdapter,
  DetectedChange,
} from "../adapters/base";
import type { LLMProvider } from "@/lib/llm/provider";

vi.mock("@/lib/db", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    positioningClaim: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    intelligenceItem: {
      create: vi.fn().mockResolvedValue({ id: "intel-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    seenArticle: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

// Must import after vi.mock so the mock is applied
import { prisma } from "@/lib/db";
import { IngestionRunner } from "../runner";

function createMockLLM(overrides?: Partial<LLMProvider>): LLMProvider {
  return {
    classifyStructured: vi.fn().mockImplementation((prompt: string) => {
      // Batch prompt (EVENT sources) — detected by "ARTICLES:" marker
      if (prompt.includes("ARTICLES:")) {
        return Promise.resolve({
          events: [{
            articleIndices: [0],
            eventKey: "testcompetitor-product-update",
            type: "PRODUCT_CHANGE",
            summary: "Competitor updated their product page",
            companyImplication: "May indicate new feature launch targeting the company's segment",
            evidenceTier: "INFERRED",
            affectedClaimIds: [],
            sourceUrl: "https://example.com",
            publishedAt: "",
          }],
        });
      }
      // Single-article prompt (STATE sources)
      return Promise.resolve({
        type: "PRODUCT_CHANGE",
        summary: "Competitor updated their product page",
        companyImplication: "May indicate new feature launch targeting the company's segment",
        evidenceTier: "INFERRED",
        affectedClaimIds: [],
        sourceUrl: "https://example.com",
        publishedAt: "",
        eventKey: "testcompetitor-product-update-2026-02",
      });
    }),
    generateStructured: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function createMockAdapter(overrides?: {
  sourceType?: SourceType;
  fetch?: IngestionAdapter["fetch"];
  detectChanges?: IngestionAdapter["detectChanges"];
}): IngestionAdapter {
  return {
    sourceType: overrides?.sourceType ?? SourceType.WEBSITE,
    fetch:
      overrides?.fetch ??
      vi.fn<IngestionAdapter["fetch"]>().mockResolvedValue({
        content: "<html><body>Hello</body></html>",
        url: "https://example.com",
        fetchedAt: new Date(),
      }),
    detectChanges:
      overrides?.detectChanges ??
      vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "PRODUCT_CHANGE",
          content: "new content",
          url: "https://example.com",
          summary: "Something changed",
        },
      ]),
  };
}

describe("IngestionRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: one WEBSITE (STATE) source with existing hash
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-1",
        competitorId: "comp-1",
        type: "WEBSITE" as SourceType,
        url: "https://example.com",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: "existing-hash-for-test",
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    vi.mocked(prisma.positioningClaim.findMany).mockResolvedValue([
      {
        id: "claim-1",
        claimText: "Only mid-market accessible platform",
        currentStatus: "HOLDING",
        createdAt: new Date(),
      },
    ] as never);

    // Default: no existing items (clean DB for URL dedup)
    vi.mocked(prisma.intelligenceItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.intelligenceItem.findFirst).mockResolvedValue(null);
  });

  // -----------------------------------------------------------------------
  // STATE source tests (process via processStateSources — same as old logic)
  // -----------------------------------------------------------------------

  it("should fetch STATE sources and detect changes", async () => {
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(1);
    expect(result.itemsCreated).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.dataSource.findMany).toHaveBeenCalledOnce();
    expect(prisma.dataSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src-1" },
        data: expect.objectContaining({
          health: "HEALTHY",
          lastContentHash: expect.any(String),
          lastChecked: expect.any(Date),
          lastChangeDetected: expect.any(Date),
        }),
      }),
    );
  });

  it("should create IntelligenceItem with simulated=false when change detected", async () => {
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    await runner.run();

    expect(prisma.intelligenceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        competitorId: "comp-1",
        sourceId: "src-1",
        type: "PRODUCT_CHANGE",
        summary: "Competitor updated their product page",
        companyImplication: "May indicate new feature launch targeting the company's segment",
        evidenceTier: "INFERRED",
        simulated: false,
        sourceTitle: "Something changed",
      }),
    });
  });

  it("should connect affected positioning claims", async () => {
    const llm = createMockLLM({
      classifyStructured: vi.fn().mockResolvedValue({
        type: "PRODUCT_CHANGE",
        summary: "Test summary",
        companyImplication: "Test implication",
        evidenceTier: "CONFIRMED",
        affectedClaimIds: ["claim-1"],
        eventKey: "testcompetitor-product-change-2026-02",
      }),
    });
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const runner = new IngestionRunner(adapters, llm);

    await runner.run();

    expect(prisma.intelligenceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimsAffected: { connect: [{ id: "claim-1" }] },
      }),
    });
  });

  it("should fall back to UNKNOWN tier when LLM classification fails", async () => {
    const llm = createMockLLM({
      classifyStructured: vi.fn().mockRejectedValue(new Error("API rate limited")),
    });
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.itemsCreated).toBe(1);
    expect(prisma.intelligenceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PRESS",
        summary: "Something changed",
        companyImplication: "",
        evidenceTier: "UNKNOWN",
        simulated: false,
      }),
    });
  });

  it("should call adapter.detectChanges with correct arguments", async () => {
    const mockDetectChanges = vi
      .fn<IngestionAdapter["detectChanges"]>()
      .mockResolvedValue([]);
    const adapter = createMockAdapter({ detectChanges: mockDetectChanges });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    await runner.run();

    expect(mockDetectChanges).toHaveBeenCalledOnce();
    expect(mockDetectChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(String),
        url: expect.any(String),
        fetchedAt: expect.any(Date),
      }),
      "existing-hash-for-test",
    );
  });

  it("should update source without lastChangeDetected when no changes detected", async () => {
    const adapter = createMockAdapter({
      detectChanges: vi
        .fn<IngestionAdapter["detectChanges"]>()
        .mockResolvedValue([]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(1);
    expect(result.itemsCreated).toBe(0);
    expect(prisma.dataSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src-1" },
        data: expect.objectContaining({
          health: "HEALTHY",
          lastContentHash: expect.any(String),
          lastChecked: expect.any(Date),
        }),
      }),
    );
    // Should NOT include lastChangeDetected in the no-changes path
    const updateCall = vi.mocked(prisma.dataSource.update).mock.calls[0]![0];
    expect(updateCall.data).not.toHaveProperty("lastChangeDetected");
  });

  it("should handle adapter errors gracefully", async () => {
    const adapter = createMockAdapter({
      fetch: vi
        .fn<IngestionAdapter["fetch"]>()
        .mockRejectedValue(new Error("Network timeout")),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      sourceId: "src-1",
      error: "Network timeout",
    });
  });

  it("should skip sources with no matching adapter", async () => {
    const adapters = new Map<SourceType, IngestionAdapter>();
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(0);
    expect(result.itemsCreated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Baseline skip & SKIP classification tests
  // -----------------------------------------------------------------------

  it("should baseline-only on first run for STATE sources (no items, no LLM)", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-1",
        competitorId: "comp-1",
        type: "WEBSITE" as SourceType,
        url: "https://example.com",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: null, // first run
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(1);
    expect(result.itemsCreated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(prisma.dataSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src-1" },
        data: expect.objectContaining({
          lastContentHash: expect.any(String),
          lastChecked: expect.any(Date),
          health: "HEALTHY",
        }),
      }),
    );
    expect(llm.classifyStructured).not.toHaveBeenCalled();
    expect(prisma.intelligenceItem.create).not.toHaveBeenCalled();
  });

  it("should skip item creation when LLM returns SKIP classification", async () => {
    const llm = createMockLLM({
      classifyStructured: vi.fn().mockResolvedValue({
        type: "SKIP",
        summary: "Boilerplate content, not competitively noteworthy",
        companyImplication: "",
        evidenceTier: "UNKNOWN",
        affectedClaimIds: [],
        eventKey: "",
      }),
    });
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.itemsCreated).toBe(0);
    expect(result.llmSkipped).toBe(1);
    expect(llm.classifyStructured).toHaveBeenCalledOnce();
    expect(prisma.intelligenceItem.create).not.toHaveBeenCalled();
  });

  it("should ignore invalid claim IDs from LLM response", async () => {
    const llm = createMockLLM({
      classifyStructured: vi.fn().mockResolvedValue({
        type: "PRODUCT_CHANGE",
        summary: "Test",
        companyImplication: "Test",
        evidenceTier: "CONFIRMED",
        affectedClaimIds: ["claim-1", "nonexistent-claim"],
        eventKey: "testcompetitor-product-change-2026-02",
      }),
    });
    const adapter = createMockAdapter();
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.WEBSITE, adapter],
    ]);
    const runner = new IngestionRunner(adapters, llm);

    await runner.run();

    expect(prisma.intelligenceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimsAffected: { connect: [{ id: "claim-1" }] },
      }),
    });
  });

  // -----------------------------------------------------------------------
  // EVENT source (phased pipeline) tests
  // -----------------------------------------------------------------------

  it("should classify normally on first run for EVENT sources", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-rss",
        competitorId: "comp-1",
        type: "PRESS_RSS" as SourceType,
        url: "https://example.com/rss",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: null,
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter({
      sourceType: SourceType.PRESS_RSS,
      detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "Article about competitor launch",
          url: "https://publisher.com/article-1",
          summary: "TestCompetitor launches new product",
        },
      ]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.PRESS_RSS, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    expect(result.sourcesChecked).toBe(1);
    expect(result.itemsFetched).toBe(1);
    expect(result.itemsCreated).toBe(1);
    expect(llm.classifyStructured).toHaveBeenCalledOnce();
    expect(prisma.intelligenceItem.create).toHaveBeenCalledOnce();
  });

  it("should skip already-seen articles via feed memory", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-rss",
        competitorId: "comp-1",
        type: "PRESS_RSS" as SourceType,
        url: "https://example.com/rss",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: new Date(),
        lastChangeDetected: null,
        lastContentHash: "some-hash",
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter({
      sourceType: SourceType.PRESS_RSS,
      detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "Already seen article",
          url: "https://publisher.com/existing-article",
          summary: "Old news we already saw",
        },
      ]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.PRESS_RSS, adapter],
    ]);

    // Simulate: this URL was already seen in a previous run
    vi.mocked(prisma.seenArticle.findMany).mockResolvedValue([
      { sourceId: "src-rss", articleUrl: "https://publisher.com/existing-article" },
    ] as never);

    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);
    const result = await runner.run();

    expect(result.itemsFetched).toBe(1);
    expect(result.seenSkipped).toBe(1);
    expect(result.itemsCreated).toBe(0);
    // LLM should NOT be called — item was filtered by feed memory
    expect(llm.classifyStructured).not.toHaveBeenCalled();
  });

  it("should record all URLs as seen even on first run", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-rss",
        competitorId: "comp-1",
        type: "PRESS_RSS" as SourceType,
        url: "https://example.com/rss",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: null,
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter({
      sourceType: SourceType.PRESS_RSS,
      detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "Article 1",
          url: "https://publisher.com/article-1",
          summary: "First article",
        },
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "Article 2",
          url: "https://publisher.com/article-2",
          summary: "Second article",
        },
      ]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.PRESS_RSS, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    await runner.run();

    // Both URLs should be recorded as seen
    expect(prisma.seenArticle.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { sourceId: "src-rss", articleUrl: "https://publisher.com/article-1" },
        { sourceId: "src-rss", articleUrl: "https://publisher.com/article-2" },
      ]),
      skipDuplicates: true,
    });
  });

  it("should title-dedup within a batch (cross-publisher duplicates)", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-rss",
        competitorId: "comp-1",
        type: "PRESS_RSS" as SourceType,
        url: "https://example.com/rss",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: null,
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter({
      sourceType: SourceType.PRESS_RSS,
      detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "TestCompetitor announces three new c-suite hires",
          url: "https://publisher-a.com/nium-hires",
          summary: "TestCompetitor Announces Three New C-Suite Hires",
        },
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "TestCompetitor appointed three c-suite executives",
          url: "https://publisher-b.com/nium-executives",
          summary: "TestCompetitor Appointed Three C-Suite Executives",
        },
      ]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.PRESS_RSS, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    // Two articles about the same event should be collapsed to one
    expect(result.itemsFetched).toBe(2);
    expect(result.titleDedupBatchSkipped).toBe(1);
    // Only 1 LLM call should be made
    expect(result.llmCallsMade).toBe(1);
    expect(result.itemsCreated).toBe(1);
  });

  it("should report full pipeline stats including cost", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      {
        id: "src-rss",
        competitorId: "comp-1",
        type: "PRESS_RSS" as SourceType,
        url: "https://example.com/rss",
        cadence: "DAILY",
        health: "HEALTHY",
        lastChecked: null,
        lastChangeDetected: null,
        lastContentHash: null,
        createdAt: new Date(),
        competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
      },
    ] as never);

    const adapter = createMockAdapter({
      sourceType: SourceType.PRESS_RSS,
      detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
        {
          competitorId: "",
          sourceId: "",
          changeType: "rss_new_item",
          content: "New TestCompetitor article",
          url: "https://publisher.com/new",
          summary: "Brand new TestCompetitor article",
        },
      ]),
    });
    const adapters = new Map<SourceType, IngestionAdapter>([
      [SourceType.PRESS_RSS, adapter],
    ]);
    const llm = createMockLLM();
    const runner = new IngestionRunner(adapters, llm);

    const result = await runner.run();

    // Verify all stat fields are populated
    expect(result.sourcesChecked).toBe(1);
    expect(result.itemsFetched).toBe(1);
    expect(result.seenSkipped).toBe(0);
    expect(result.safetyCapped).toBe(0);
    expect(result.titleDedupBatchSkipped).toBe(0);
    expect(result.llmCallsMade).toBe(1);
    expect(result.estimatedCostUsd).toBeCloseTo(0.01);
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
