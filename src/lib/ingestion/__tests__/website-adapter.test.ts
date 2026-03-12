import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { WebsiteAdapter } from "../adapters/html-page";
import { hashContent } from "../diff-engine";

const mockDataSource: DataSource = {
  id: "src-1",
  competitorId: "comp-1",
  type: "WEBSITE",
  url: "https://example.com/products",
  cadence: "DAILY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date("2025-01-01"),
};

const mockHtml = `
<html>
  <head><title>Test Page</title></head>
  <body>
    <script>var x = 1;</script>
    <style>.foo { color: red; }</style>
    <h1>Product Page</h1>
    <p>This is the product description.</p>
  </body>
</html>
`;

const expectedText = "Test Page Product Page This is the product description.";

describe("WebsiteAdapter", () => {
  let adapter: WebsiteAdapter;

  beforeEach(() => {
    adapter = new WebsiteAdapter();
    vi.restoreAllMocks();
  });

  it("has sourceType WEBSITE", () => {
    expect(adapter.sourceType).toBe("WEBSITE");
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
        status: 404,
        statusText: "Not Found",
        text: vi.fn(),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(mockResponse as unknown as Response),
      );

      await expect(adapter.fetch(mockDataSource)).rejects.toThrow(
        "Failed to fetch https://example.com/products: 404 Not Found",
      );
    });
  });

  describe("detectChanges", () => {
    it("returns changes when content differs from previous hash", async () => {
      const current = {
        content: "new content here",
        url: "https://example.com/products",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("old content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        competitorId: "",
        sourceId: "",
        changeType: "content_change",
        content: "new content here",
        url: "https://example.com/products",
        summary: "Content change detected at https://example.com/products",
      });
    });

    it("returns changes when previousHash is null (first fetch)", async () => {
      const current = {
        content: "some content",
        url: "https://example.com/products",
        fetchedAt: new Date(),
      };

      const changes = await adapter.detectChanges(current, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.changeType).toBe("content_change");
    });

    it("returns empty when content matches previous hash", async () => {
      const content = "unchanged content";
      const current = {
        content,
        url: "https://example.com/products",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent(content);

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(0);
    });
  });
});
