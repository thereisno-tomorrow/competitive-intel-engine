import { describe, it, expect, vi, afterEach } from "vitest";
import { createLinkedInConnector, summarizeLinkedIn } from "../linkedin";
import { parseResultText, PhantomBusterClient } from "@/lib/phantombuster/client";
import type { ConnectorSource } from "../../connector";

const source = (url: string): ConnectorSource => ({
  id: "s1",
  type: "LINKEDIN",
  url,
  competitorId: "comp-1",
  competitorName: "Airwallex",
});

const noopTransport = { getText: vi.fn(), getJson: vi.fn() };

afterEach(() => {
  delete process.env.PHANTOMBUSTER_API_KEY;
});

describe("createLinkedInConnector (U23)", () => {
  it("returns parsed content with a key + fixture results", async () => {
    process.env.PHANTOMBUSTER_API_KEY = "test-key";
    const fakeClient = {
      fetchResults: vi.fn().mockResolvedValue([
        { text: "We just launched cross-border payouts to 20 new markets", likeCount: 42 },
      ]),
    } as unknown as PhantomBusterClient;

    const connector = createLinkedInConnector(fakeClient);
    const content = await connector.fetch(
      "pb://agent123/posts",
      noopTransport,
      source("pb://agent123/posts"),
    );
    expect(content?.sourceType).toBe("LINKEDIN");
    expect(content?.text).toContain("cross-border payouts");
    expect(content).not.toHaveProperty("evidenceTier");
  });

  it("is a loud no-op returning null without a key (run continues)", async () => {
    delete process.env.PHANTOMBUSTER_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connector = createLinkedInConnector();
    const content = await connector.fetch("pb://agent123/posts", noopTransport, source("pb://agent123/posts"));
    expect(content).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null (isolated) when the phantom fetch throws", async () => {
    process.env.PHANTOMBUSTER_API_KEY = "test-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fakeClient = {
      fetchResults: vi.fn().mockRejectedValue(new Error("429 rate limited")),
    } as unknown as PhantomBusterClient;
    const connector = createLinkedInConnector(fakeClient);
    const content = await connector.fetch("pb://agent123/posts", noopTransport, source("pb://agent123/posts"));
    expect(content).toBeNull();
    warn.mockRestore();
  });
});

describe("summarizeLinkedIn", () => {
  it("summarizes jobs, posts, and company shapes", () => {
    expect(summarizeLinkedIn("jobs", [{ title: "Treasury Engineer", location: "SG" }])).toContain("JOB: Treasury Engineer");
    expect(summarizeLinkedIn("posts", [{ text: "hello" }])).toContain("POST: hello");
    expect(summarizeLinkedIn("company", [{ name: "Airwallex" }])).toContain("COMPANY: Airwallex");
  });
});

describe("parseResultText (corrected v2 retrieval)", () => {
  it("parses an inline JSON array (the common v2 resultObject shape)", () => {
    expect(parseResultText('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("wraps a single object", () => {
    expect(parseResultText('{"a":1}')).toEqual([{ a: 1 }]);
  });
  it("falls back to NDJSON", () => {
    expect(parseResultText('{"a":1}\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
