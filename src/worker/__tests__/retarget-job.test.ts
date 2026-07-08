import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunIngestion = vi.fn();
const mockItemFindMany = vi.fn();

vi.mock("@/lib/ingestion/pipeline", () => ({
  runIngestionPipeline: (...a: unknown[]) => mockRunIngestion(...a),
}));
vi.mock("@/lib/llm/factory", () => ({ createLLMProvider: vi.fn(() => ({})) }));
vi.mock("@/lib/health/heartbeat", () => ({ pingHealthcheck: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { intelligenceItem: { findMany: (...a: unknown[]) => mockItemFindMany(...a) } },
}));

import { ingestJob } from "../jobs/ingest";
import { setActiveBoss } from "../boss-registry";
import { QUEUES } from "../jobs/types";
import type { BossLike } from "../queue";

describe("ingest job → material-signal retarget (U17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunIngestion.mockResolvedValue({ itemsCreated: 2, errors: [] });
  });

  it("enqueues exactly one card-regen per competitor with a material signal", async () => {
    const sends: { name: string; data: unknown; options: unknown }[] = [];
    const boss: BossLike = {
      send: vi.fn(async (name, data, options) => {
        sends.push({ name, data, options });
        return "job-id";
      }),
    };
    setActiveBoss(boss);

    mockItemFindMany.mockResolvedValue([
      { competitorId: "X", competitor: { tier: "TIER_1" }, type: "PRICING_CHANGE", rawContent: "…", claimsAffected: [] },
      { competitorId: "X", competitor: { tier: "TIER_1" }, type: "OUTAGE", rawContent: "…", claimsAffected: [] },
      { competitorId: "Y", competitor: { tier: "TIER_2" }, type: "PRESS", rawContent: "…", claimsAffected: [] },
    ]);

    await ingestJob({}, { attempt: 1 });

    // One enqueue for X (deduped, singleton), none for the non-material Y.
    expect(sends).toHaveLength(1);
    expect(sends[0]?.name).toBe(QUEUES.GENERATE_CARD);
    expect(sends[0]?.data).toMatchObject({ competitorId: "X" });
    expect(sends[0]?.options).toMatchObject({ singletonKey: "X" });
  });

  it("enqueues nothing when there are only non-material signals", async () => {
    const send = vi.fn().mockResolvedValue("id");
    setActiveBoss({ send });
    mockItemFindMany.mockResolvedValue([
      { competitorId: "Z", competitor: { tier: "TIER_2" }, type: "PRESS", rawContent: "…", claimsAffected: [] },
    ]);

    await ingestJob({}, { attempt: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});
