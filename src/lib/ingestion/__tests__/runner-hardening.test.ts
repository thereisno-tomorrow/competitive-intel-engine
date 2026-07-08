import { describe, it, expect, vi, beforeEach } from "vitest";
import { SourceType } from "@/generated/prisma/client";
import type { IngestionAdapter } from "../adapters/base";
import type { LLMProvider } from "@/lib/llm/provider";

vi.mock("@/lib/db", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    positioningClaim: { findMany: vi.fn().mockResolvedValue([]) },
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

import { prisma } from "@/lib/db";
import { IngestionRunner } from "../runner";
import { RssAdapter } from "../adapters/rss";
import type { RawContent } from "../adapters/base";

function rssSource(id: string) {
  return {
    id,
    competitorId: "comp-1",
    type: "PRESS_RSS" as SourceType,
    url: `https://example.com/${id}`,
    cadence: "DAILY",
    health: "HEALTHY",
    lastChecked: new Date(),
    lastChangeDetected: null,
    lastContentHash: "hash",
    createdAt: new Date(),
    competitor: { id: "comp-1", name: "TestCompetitor", status: "ACTIVE", tier: "TIER_1" },
  };
}

function batchLLM(): LLMProvider {
  return {
    classifyStructured: vi.fn().mockResolvedValue({
      events: [
        {
          articleIndices: [0],
          eventKey: "testcompetitor-event",
          type: "PRODUCT_CHANGE",
          summary: "TestCompetitor did a thing",
          companyImplication: "impl",
          evidenceTier: "INFERRED",
          affectedClaimIds: [],
          sourceUrl: "https://publisher.com/a",
          publishedAt: "",
        },
      ],
    }),
    generateStructured: vi.fn().mockResolvedValue({}),
  };
}

function newItemAdapter(fetchImpl?: IngestionAdapter["fetch"]): IngestionAdapter {
  return {
    sourceType: SourceType.PRESS_RSS,
    fetch:
      fetchImpl ??
      vi.fn<IngestionAdapter["fetch"]>().mockResolvedValue({
        content: "c",
        url: "https://example.com/x",
        fetchedAt: new Date(),
      }),
    detectChanges: vi.fn<IngestionAdapter["detectChanges"]>().mockResolvedValue([
      {
        competitorId: "",
        sourceId: "",
        changeType: "rss_new_item",
        content: "TestCompetitor launched something",
        url: "https://publisher.com/a",
        summary: "TestCompetitor launches",
      },
    ]),
  };
}

describe("seen-after-store (R13)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT record seen URLs when STORE crashes (re-run can reprocess)", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([rssSource("src-a")] as never);
    // Crash during STORE
    vi.mocked(prisma.intelligenceItem.create).mockRejectedValueOnce(new Error("db write crashed"));

    const runner = new IngestionRunner(
      new Map([[SourceType.PRESS_RSS, newItemAdapter()]]),
      batchLLM(),
    );

    await expect(runner.run()).rejects.toThrow(/crashed/);
    // The crash happened before recordSeen — nothing marked seen.
    expect(prisma.seenArticle.createMany).not.toHaveBeenCalled();
  });

  it("records seen URLs only AFTER a successful store", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([rssSource("src-a")] as never);

    const createCalls: string[] = [];
    vi.mocked(prisma.intelligenceItem.create).mockImplementation((async () => {
      createCalls.push("intel");
      return { id: "intel-1" };
    }) as never);
    vi.mocked(prisma.seenArticle.createMany).mockImplementation((async () => {
      createCalls.push("seen");
      return { count: 1 };
    }) as never);

    const runner = new IngestionRunner(
      new Map([[SourceType.PRESS_RSS, newItemAdapter()]]),
      batchLLM(),
    );
    await runner.run();

    expect(prisma.seenArticle.createMany).toHaveBeenCalled();
    // seen recorded strictly after the intel write
    expect(createCalls).toEqual(["intel", "seen"]);
  });
});

describe("surfaced per-source errors (R13)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a fetch that throws is surfaced in the run summary; other sources still complete", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
      rssSource("src-good"),
      rssSource("src-bad"),
    ] as never);

    const fetchImpl = vi.fn<IngestionAdapter["fetch"]>().mockImplementation(async (source) => {
      if (source.id === "src-bad") throw new Error("fetch exploded");
      return { content: "c", url: source.url, fetchedAt: new Date() };
    });

    const runner = new IngestionRunner(
      new Map([[SourceType.PRESS_RSS, newItemAdapter(fetchImpl)]]),
      batchLLM(),
    );
    const result = await runner.run();

    expect(result.errors).toEqual([
      { sourceId: "src-bad", error: "fetch exploded" },
    ]);
    // The good source still produced an item.
    expect(result.itemsCreated).toBe(1);
  });
});

describe("stateless RSS adapter (concurrency-safe)", () => {
  it("detectChanges reads from the RawContent payload, not instance state", async () => {
    const adapter = new RssAdapter();

    const rawA: RawContent = {
      content: "a",
      url: "https://feed-a.com",
      fetchedAt: new Date(),
      payload: [{ title: "Article A", contentSnippet: "from A", link: "https://a.com/1" }],
    };
    const rawB: RawContent = {
      content: "b",
      url: "https://feed-b.com",
      fetchedAt: new Date(),
      payload: [{ title: "Article B", contentSnippet: "from B", link: "https://b.com/1" }],
    };

    // Interleave: even if B is "fetched" between A's fetch and detect, A stays A.
    const changesB = await adapter.detectChanges(rawB, "hash");
    const changesA = await adapter.detectChanges(rawA, "hash");

    expect(changesA.map((c) => c.summary)).toEqual(["Article A"]);
    expect(changesB.map((c) => c.summary)).toEqual(["Article B"]);
  });
});
