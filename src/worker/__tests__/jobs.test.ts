import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunIngestion = vi.fn();
const mockRunGenerate = vi.fn();

vi.mock("@/lib/ingestion/pipeline", () => ({
  runIngestionPipeline: (...a: unknown[]) => mockRunIngestion(...a),
}));
vi.mock("@/lib/generators/generate-pipeline", () => ({
  runGeneratePipeline: (...a: unknown[]) => mockRunGenerate(...a),
}));
vi.mock("@/lib/llm/factory", () => ({ createLLMProvider: vi.fn(() => ({})) }));

import { ingestJob } from "../jobs/ingest";
import { generateJob } from "../jobs/generate";
import { InfraFault } from "../errors";
import { buildScheduleHandlers } from "../index-handlers";
import { QUEUES } from "../jobs/types";
import type { BossLike } from "../queue";

describe("ingestJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the ingestion pipeline", async () => {
    mockRunIngestion.mockResolvedValue({ itemsCreated: 3, errors: [] });
    await ingestJob({}, { attempt: 1 });
    expect(mockRunIngestion).toHaveBeenCalledOnce();
  });

  it("wraps a pipeline failure as an InfraFault (retryable)", async () => {
    mockRunIngestion.mockRejectedValue(new Error("scrape 503"));
    await expect(ingestJob({}, { attempt: 1 })).rejects.toBeInstanceOf(InfraFault);
  });
});

describe("generateJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes force + pulseOnly through to the pipeline", async () => {
    mockRunGenerate.mockResolvedValue({ signalAlerts: [], weeklyPulse: null, monthlyPulse: null });
    await generateJob({ force: true, pulseOnly: true }, { attempt: 1 });
    expect(mockRunGenerate).toHaveBeenCalledWith(expect.anything(), {
      force: true,
      pulseOnly: true,
    });
  });

  it("wraps a pipeline failure as an InfraFault", async () => {
    mockRunGenerate.mockRejectedValue(new Error("db down"));
    await expect(generateJob({}, { attempt: 1 })).rejects.toBeInstanceOf(InfraFault);
  });
});

describe("buildScheduleHandlers", () => {
  it("ingest tick enqueues an ingest job; generate tick enqueues a generate job", async () => {
    const sends: string[] = [];
    const boss: BossLike = {
      send: vi.fn(async (name) => {
        sends.push(name);
        return "id";
      }),
    };
    const handlers = buildScheduleHandlers(boss);
    await handlers.onIngestTick();
    await handlers.onGenerateTick();
    expect(sends).toEqual([QUEUES.INGEST, QUEUES.GENERATE]);
  });
});
