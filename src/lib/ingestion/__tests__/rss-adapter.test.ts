import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { RssAdapter } from "../adapters/rss";
import { hashContent } from "../diff-engine";

vi.mock("rss-parser", () => {
  const MockParser = vi.fn();
  MockParser.prototype.parseURL = vi.fn();
  return { default: MockParser };
});

import Parser from "rss-parser";

const mockDataSource: DataSource = {
  id: "src-2",
  competitorId: "comp-1",
  type: "PRESS_RSS",
  url: "https://example.com/feed.xml",
  cadence: "DAILY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date("2025-01-01"),
};

describe("RssAdapter", () => {
  let adapter: RssAdapter;

  beforeEach(() => {
    adapter = new RssAdapter();
    vi.restoreAllMocks();
  });

  it("has sourceType PRESS_RSS", () => {
    expect(adapter.sourceType).toBe("PRESS_RSS");
  });

  describe("fetch", () => {
    it("concatenates RSS items into content", async () => {
      const mockFeed = {
        items: [
          { title: "Article One", contentSnippet: "First article summary", link: "https://example.com/1", pubDate: "2026-01-15" },
          { title: "Article Two", contentSnippet: "Second article summary", link: "https://example.com/2", pubDate: "2026-01-16" },
          { title: "No Snippet Item", contentSnippet: undefined, link: "https://example.com/3" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const result = await adapter.fetch(mockDataSource);

      expect(result.content).toBe(
        "Article One\nFirst article summary\n\nArticle Two\nSecond article summary\n\nNo Snippet Item",
      );
      expect(result.url).toBe(mockDataSource.url);
      expect(result.fetchedAt).toBeInstanceOf(Date);
    });

    it("handles empty feed", async () => {
      const mockFeed = { items: [] };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const result = await adapter.fetch(mockDataSource);

      expect(result.content).toBe("");
      expect(result.url).toBe(mockDataSource.url);
    });
  });

  describe("detectChanges", () => {
    it("returns per-item changes when content differs from previous hash", async () => {
      const mockFeed = {
        items: [
          { title: "Article One", contentSnippet: "Summary one", link: "https://example.com/article-1", pubDate: "2026-02-01T10:00:00Z" },
          { title: "Article Two", contentSnippet: "Summary two", link: "https://example.com/article-2", pubDate: "2026-02-02T10:00:00Z" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const raw = await adapter.fetch(mockDataSource);
      const previousHash = hashContent("old feed content");
      const changes = await adapter.detectChanges(raw, previousHash);

      expect(changes).toHaveLength(2);
      expect(changes[0]).toEqual({
        competitorId: "",
        sourceId: "",
        changeType: "rss_new_item",
        content: "Article One\nSummary one",
        url: "https://example.com/article-1",
        summary: "Article One",
        publishedAt: "2026-02-01T10:00:00Z",
      });
      expect(changes[1]).toEqual({
        competitorId: "",
        sourceId: "",
        changeType: "rss_new_item",
        content: "Article Two\nSummary two",
        url: "https://example.com/article-2",
        summary: "Article Two",
        publishedAt: "2026-02-02T10:00:00Z",
      });
    });

    it("returns changes when previousHash is null (first fetch)", async () => {
      const mockFeed = {
        items: [
          { title: "First Article", contentSnippet: "Content", link: "https://example.com/first" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const raw = await adapter.fetch(mockDataSource);
      const changes = await adapter.detectChanges(raw, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.changeType).toBe("rss_new_item");
      expect(changes[0]?.url).toBe("https://example.com/first");
    });

    it("returns items even when content matches previous hash (URL dedup handles repeats)", async () => {
      const mockFeed = {
        items: [
          { title: "Unchanged", contentSnippet: "Same content" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const raw = await adapter.fetch(mockDataSource);
      const previousHash = hashContent(raw.content);
      const changes = await adapter.detectChanges(raw, previousHash);

      // Hash gate removed — RSS adapter always returns items.
      // URL dedup in the runner handles repeat articles cheaply.
      expect(changes).toHaveLength(1);
    });

    it("falls back to feed URL when item has no link", async () => {
      const mockFeed = {
        items: [
          { title: "No Link Article", contentSnippet: "Content" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const raw = await adapter.fetch(mockDataSource);
      const changes = await adapter.detectChanges(raw, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.url).toBe(mockDataSource.url);
    });

    it("filters out items with no title and no snippet", async () => {
      const mockFeed = {
        items: [
          { title: "Valid Item", contentSnippet: "Has content", link: "https://example.com/valid" },
          { title: undefined, contentSnippet: undefined, link: "https://example.com/empty" },
        ],
      };
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue(
        mockFeed as ReturnType<Parser["parseURL"]> extends Promise<infer T>
          ? T
          : never,
      );

      const raw = await adapter.fetch(mockDataSource);
      const changes = await adapter.detectChanges(raw, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.url).toBe("https://example.com/valid");
    });
  });
});
