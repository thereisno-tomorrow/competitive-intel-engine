import { describe, it, expect, vi } from "vitest";
import {
  runConnectors,
  type Connector,
  type ConnectorRegistry,
  type ConnectorSource,
  type Transport,
} from "../connector";
import { createSingleSurfaceConnector } from "../connectors/single-surface";

const source = (id: string, type: ConnectorSource["type"], url: string): ConnectorSource => ({
  id,
  type,
  url,
  competitorId: `comp-${id}`,
  competitorName: "Kyriba",
});

function fakeTransport(text: string): Transport {
  return {
    getText: vi.fn().mockResolvedValue(text),
    getJson: vi.fn().mockResolvedValue({}),
  };
}

describe("runConnectors (U19 disciplines)", () => {
  it("skips an unknown source type loudly, never throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await runConnectors({}, [source("s1", "REGULATORY", "u")], fakeTransport("x"));
    expect(result.content).toEqual([]);
    expect(result.skipped).toContain("REGULATORY");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("isolates a connector whose fetch throws; other connectors complete", async () => {
    const boom: Connector = {
      sourceType: "REGULATORY",
      discover: (s) => [s.url],
      fetch: async () => {
        throw new Error("network down");
      },
    };
    const ok: Connector = {
      sourceType: "JOB_POSTING",
      discover: (s) => [s.url],
      fetch: async (target, _t, s) => ({
        sourceType: "JOB_POSTING",
        sourceId: s.id,
        competitorId: s.competitorId,
        url: target,
        title: "jobs",
        text: "hiring engineers",
      }),
    };
    const registry: ConnectorRegistry = { REGULATORY: boom, JOB_POSTING: ok };
    const result = await runConnectors(
      registry,
      [source("bad", "REGULATORY", "u1"), source("good", "JOB_POSTING", "u2")],
      fakeTransport("x"),
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.sourceId).toBe("good");
    expect(result.errors[0]?.sourceId).toBe("bad");
  });

  it("respects the fetch budget", async () => {
    const many: Connector = {
      sourceType: "SEO",
      discover: () => ["a", "b", "c", "d"],
      fetch: async (target, _t, s) => ({
        sourceType: "SEO",
        sourceId: s.id,
        competitorId: s.competitorId,
        url: target,
        title: "t",
        text: "x",
      }),
    };
    const result = await runConnectors({ SEO: many }, [source("s", "SEO", "u")], fakeTransport("x"), {
      budget: 2,
    });
    expect(result.content).toHaveLength(2);
  });

  it("a connector's output type has no evidence-tier field (tiering stays downstream)", async () => {
    const connector = createSingleSurfaceConnector({ sourceType: "SEO" });
    const content = await connector.fetch("https://x.com", fakeTransport("<p>readable text here</p>"), source("s", "SEO", "https://x.com"));
    expect(content).not.toBeNull();
    expect(content).not.toHaveProperty("evidenceTier");
    expect(content?.text).toContain("readable text");
  });
});

describe("createSingleSurfaceConnector (re-expression)", () => {
  it("discovers the source URL and scrapes readable text via the injected transport", async () => {
    const connector = createSingleSurfaceConnector({ sourceType: "JOB_POSTING", label: "careers" });
    const s = source("s", "JOB_POSTING", "https://c.com/careers");
    expect(await connector.discover(s)).toEqual(["https://c.com/careers"]);
    const content = await connector.fetch(
      "https://c.com/careers",
      fakeTransport("<html><body><h1>Careers</h1><p>Hiring treasury engineers</p></body></html>"),
      s,
    );
    expect(content?.sourceType).toBe("JOB_POSTING");
    expect(content?.text).toContain("Hiring treasury engineers");
    expect(content?.title).toContain("careers");
  });

  it("returns null on empty content (isolated no-op)", async () => {
    const connector = createSingleSurfaceConnector({ sourceType: "SEO" });
    const content = await connector.fetch("https://x.com", fakeTransport("   "), source("s", "SEO", "https://x.com"));
    expect(content).toBeNull();
  });
});
