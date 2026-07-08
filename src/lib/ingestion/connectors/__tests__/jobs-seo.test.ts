import { describe, it, expect, vi } from "vitest";
import { createJobsConnector } from "../jobs";
import { createSeoConnector } from "../seo";
import type { ConnectorSource, Transport } from "../../connector";

const source = (type: ConnectorSource["type"], url: string): ConnectorSource => ({
  id: "s1",
  type,
  url,
  competitorId: "comp-1",
  competitorName: "Nium",
});

function transport(text: string, throws = false): Transport {
  return {
    getText: throws ? vi.fn().mockRejectedValue(new Error("403 blocked")) : vi.fn().mockResolvedValue(text),
    getJson: vi.fn(),
  };
}

describe("jobs connector (U21)", () => {
  it("yields readable job text from a careers page", async () => {
    const connector = createJobsConnector();
    const content = await connector.fetch(
      "https://nium.com/careers",
      transport("<html><body>We are hiring a Senior Treasury Engineer in Singapore.</body></html>"),
      source("JOB_POSTING", "https://nium.com/careers"),
    );
    expect(content?.sourceType).toBe("JOB_POSTING");
    expect(content?.text).toContain("Senior Treasury Engineer");
    expect(content).not.toHaveProperty("evidenceTier");
  });

  it("a blocked page rejects — isolated by the fan-out (fetch throws, run continues)", async () => {
    const connector = createJobsConnector();
    await expect(
      connector.fetch("https://nium.com/careers", transport("", true), source("JOB_POSTING", "https://nium.com/careers")),
    ).rejects.toThrow(/blocked/);
  });
});

describe("seo connector (U22)", () => {
  it("yields readable content from an SEO surface", async () => {
    const connector = createSeoConnector();
    const content = await connector.fetch(
      "https://nium.com/blog",
      transport("<html><body>Nium expands cross-border payouts to 40 new markets.</body></html>"),
      source("SEO", "https://nium.com/blog"),
    );
    expect(content?.sourceType).toBe("SEO");
    expect(content?.text).toContain("cross-border payouts");
  });

  it("returns null on empty content (isolated no-op)", async () => {
    const connector = createSeoConnector();
    const content = await connector.fetch(
      "https://nium.com/blog",
      transport("   "),
      source("SEO", "https://nium.com/blog"),
    );
    expect(content).toBeNull();
  });
});
