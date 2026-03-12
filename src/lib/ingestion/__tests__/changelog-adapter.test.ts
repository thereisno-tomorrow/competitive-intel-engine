import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { ChangelogAdapter } from "../adapters/html-page";
import { hashContent } from "../diff-engine";

const mockDataSource: DataSource = {
  id: "src-3",
  competitorId: "comp-1",
  type: "CHANGELOG",
  url: "https://example.com/changelog",
  cadence: "WEEKLY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date("2025-01-01"),
};

const mockHtml = `
<html>
  <head><title>Changelog</title></head>
  <body>
    <script>var x = 1;</script>
    <h1>Changelog</h1>
    <h2>v2.1.0</h2>
    <p>Added new payment processing feature.</p>
    <h2>v2.0.0</h2>
    <p>Major platform redesign.</p>
  </body>
</html>
`;

const expectedText =
  "Changelog Changelog v2.1.0 Added new payment processing feature. v2.0.0 Major platform redesign.";

describe("ChangelogAdapter", () => {
  let adapter: ChangelogAdapter;

  beforeEach(() => {
    adapter = new ChangelogAdapter();
    vi.restoreAllMocks();
  });

  it("has sourceType CHANGELOG", () => {
    expect(adapter.sourceType).toBe("CHANGELOG");
  });

  describe("fetch", () => {
    it("returns proper RawContent with extracted text", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        text: vi.fn().mockResolvedValue(mockHtml),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(mockResponse as unknown as Response),
      );

      const result = await adapter.fetch(mockDataSource);

      expect(result.content).toBe(expectedText);
      expect(result.url).toBe(mockDataSource.url);
      expect(result.fetchedAt).toBeInstanceOf(Date);
      expect(fetch).toHaveBeenCalledWith(mockDataSource.url, {
        headers: { "User-Agent": "CompetitiveIntelEngine/1.0" },
        signal: expect.any(AbortSignal),
      });
    });

    it("throws on non-OK response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn(),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(mockResponse as unknown as Response),
      );

      await expect(adapter.fetch(mockDataSource)).rejects.toThrow(
        "Failed to fetch https://example.com/changelog: 500 Internal Server Error",
      );
    });
  });

  describe("detectChanges", () => {
    it("returns changes when content differs from previous hash", async () => {
      const current = {
        content: "v2.1.0 new feature added",
        url: "https://example.com/changelog",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("v2.0.0 old content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        competitorId: "",
        sourceId: "",
        changeType: "changelog_update",
        content: "v2.1.0 new feature added",
        url: "https://example.com/changelog",
        summary:
          "Changelog update detected at https://example.com/changelog",
      });
    });

    it("returns changes when previousHash is null (first fetch)", async () => {
      const current = {
        content: "some changelog content",
        url: "https://example.com/changelog",
        fetchedAt: new Date(),
      };

      const changes = await adapter.detectChanges(current, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.changeType).toBe("changelog_update");
    });

    it("returns empty when content matches previous hash", async () => {
      const content = "unchanged changelog";
      const current = {
        content,
        url: "https://example.com/changelog",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent(content);

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(0);
    });
  });
});
