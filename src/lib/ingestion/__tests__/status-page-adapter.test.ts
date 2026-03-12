import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { StatusPageAdapter } from "../adapters/html-page";
import { hashContent } from "../diff-engine";

const mockDataSource: DataSource = {
  id: "src-4",
  competitorId: "comp-1",
  type: "STATUS_PAGE",
  url: "https://status.example.com",
  cadence: "DAILY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date("2025-01-01"),
};

const mockHtmlHealthy = `
<html>
  <head><title>Status Page</title></head>
  <body>
    <h1>System Status</h1>
    <p>All systems operational.</p>
  </body>
</html>
`;

describe("StatusPageAdapter", () => {
  let adapter: StatusPageAdapter;

  beforeEach(() => {
    adapter = new StatusPageAdapter();
    vi.restoreAllMocks();
  });

  it("has sourceType STATUS_PAGE", () => {
    expect(adapter.sourceType).toBe("STATUS_PAGE");
  });

  describe("fetch", () => {
    it("returns proper RawContent with extracted text", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        text: vi.fn().mockResolvedValue(mockHtmlHealthy),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(mockResponse as unknown as Response),
      );

      const result = await adapter.fetch(mockDataSource);

      expect(result.content).toBe(
        "Status Page System Status All systems operational.",
      );
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
        status: 503,
        statusText: "Service Unavailable",
        text: vi.fn(),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(mockResponse as unknown as Response),
      );

      await expect(adapter.fetch(mockDataSource)).rejects.toThrow(
        "Failed to fetch https://status.example.com: 503 Service Unavailable",
      );
    });
  });

  describe("detectChanges", () => {
    it("returns changes when content differs from previous hash", async () => {
      const current = {
        content: "All systems operational.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous status content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        competitorId: "",
        sourceId: "",
        changeType: "status_change",
        content: "All systems operational.",
        url: "https://status.example.com",
        summary: "Status change detected at https://status.example.com",
      });
    });

    it("returns empty when content matches previous hash", async () => {
      const content = "unchanged status";
      const current = {
        content,
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent(content);

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(0);
    });

    it("returns changes when previousHash is null (first fetch)", async () => {
      const current = {
        content: "some status content",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };

      const changes = await adapter.detectChanges(current, null);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.changeType).toBe("status_change");
    });

    it("marks alert-worthy when content contains 'degraded'", async () => {
      const current = {
        content: "Degraded performance on API endpoints.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("all good");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
      expect(changes[0]?.summary).toContain("isAlertWorthy: true");
    });

    it("marks alert-worthy when content contains 'outage'", async () => {
      const current = {
        content: "Major outage affecting all services.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
      expect(changes[0]?.summary).toContain("isAlertWorthy: true");
    });

    it("marks alert-worthy when content contains 'maintenance'", async () => {
      const current = {
        content: "Scheduled maintenance window tonight.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
    });

    it("marks alert-worthy when content contains 'incident'", async () => {
      const current = {
        content: "Investigating an incident with payment processing.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
    });

    it("marks alert-worthy when content contains 'disruption'", async () => {
      const current = {
        content: "Service disruption in progress.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
    });

    it("marks alert-worthy when content contains 'downtime'", async () => {
      const current = {
        content: "Unexpected downtime on core services.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).toContain("ALERT");
    });

    it("does not mark alert-worthy when no status keywords present", async () => {
      const current = {
        content: "All systems operational. Everything is running smoothly.",
        url: "https://status.example.com",
        fetchedAt: new Date(),
      };
      const previousHash = hashContent("previous healthy content");

      const changes = await adapter.detectChanges(current, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.summary).not.toContain("ALERT");
      expect(changes[0]?.summary).toBe(
        "Status change detected at https://status.example.com",
      );
    });
  });
});
