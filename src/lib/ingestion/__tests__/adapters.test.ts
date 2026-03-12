import { describe, it, expect } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { SourceType } from "@/generated/prisma/client";
import type {
  IngestionAdapter,
  RawContent,
  DetectedChange,
} from "../adapters/base";

/**
 * MockAdapter — a minimal implementation of IngestionAdapter for testing
 * the interface contract.
 */
class MockAdapter implements IngestionAdapter {
  readonly sourceType = SourceType.WEBSITE;

  async fetch(source: DataSource): Promise<RawContent> {
    return {
      content: `<html><body>Content from ${source.url}</body></html>`,
      url: source.url,
      fetchedAt: new Date(),
    };
  }

  async detectChanges(
    current: RawContent,
    previousHash: string | null,
  ): Promise<DetectedChange[]> {
    // First fetch (no previous hash) means no changes to report yet
    if (!previousHash) {
      return [];
    }

    // Subsequent fetches return a detected change
    return [
      {
        competitorId: "comp-1",
        sourceId: "src-1",
        changeType: "PRODUCT_CHANGE",
        content: current.content,
        url: current.url,
        summary: "Content has changed since last check",
      },
    ];
  }
}

const MOCK_DATA_SOURCE: DataSource = {
  id: "src-1",
  competitorId: "comp-1",
  type: SourceType.WEBSITE,
  url: "https://example.com/pricing",
  cadence: "DAILY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date(),
};

describe("IngestionAdapter interface", () => {
  const adapter = new MockAdapter();

  it("should have sourceType set correctly", () => {
    expect(adapter.sourceType).toBe(SourceType.WEBSITE);
  });

  it("should return a proper RawContent from fetch", async () => {
    const result = await adapter.fetch(MOCK_DATA_SOURCE);

    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("fetchedAt");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.url).toBe(MOCK_DATA_SOURCE.url);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it("should return empty changes for first fetch (null previousHash)", async () => {
    const rawContent = await adapter.fetch(MOCK_DATA_SOURCE);
    const changes = await adapter.detectChanges(rawContent, null);

    expect(changes).toEqual([]);
  });

  it("should return changes when previousHash exists", async () => {
    const rawContent = await adapter.fetch(MOCK_DATA_SOURCE);
    const previousHash = "abc123previoushash";
    const changes = await adapter.detectChanges(rawContent, previousHash);

    expect(changes.length).toBeGreaterThan(0);

    const change = changes[0]!;
    expect(change.competitorId).toBe("comp-1");
    expect(change.sourceId).toBe("src-1");
    expect(change.changeType).toBe("PRODUCT_CHANGE");
    expect(change.content).toBe(rawContent.content);
    expect(change.url).toBe(rawContent.url);
    expect(typeof change.summary).toBe("string");
    expect(change.summary.length).toBeGreaterThan(0);
  });
});
