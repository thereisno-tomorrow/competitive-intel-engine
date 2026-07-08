import { describe, it, expect, vi } from "vitest";
import {
  createRegulatoryConnector,
  parseSecSubmissions,
  parseMasDirectory,
} from "../regulatory";
import { matchCompanyToEntry } from "../match";
import type { ConnectorSource, Transport } from "../../connector";

const source = (url: string): ConnectorSource => ({
  id: "s1",
  type: "REGULATORY",
  url,
  competitorId: "comp-1",
  competitorName: "Airwallex",
});

describe("parseSecSubmissions", () => {
  it("parses recent filing fields", () => {
    const parsed = parseSecSubmissions({
      cik: "0000320193",
      name: "APPLE INC",
      filings: {
        recent: {
          form: ["10-K", "8-K"],
          filingDate: ["2026-01-15", "2026-01-02"],
          primaryDocDescription: ["Annual report", "Current report"],
        },
      },
    });
    expect(parsed?.entityName).toBe("APPLE INC");
    expect(parsed?.latestFilingDate).toBe("2026-01-15");
    expect(parsed?.text).toContain("10-K");
    expect(parsed?.text).toContain("Annual report");
  });

  it("returns null with no filings", () => {
    expect(parseSecSubmissions({ name: "X", filings: { recent: { form: [] } } })).toBeNull();
  });
});

describe("parseMasDirectory", () => {
  it("extracts licence class + status", () => {
    const html =
      "<html><body><h1>Entity</h1><p>Licence Type: Major Payment Institution</p><p>Status: Active</p></body></html>";
    const parsed = parseMasDirectory(html);
    expect(parsed.licence).toMatch(/Major Payment Institution/);
    expect(parsed.status).toMatch(/Active/);
    expect(parsed.text).toContain("Licence:");
  });
});

describe("createRegulatoryConnector routing", () => {
  it("SEC EDGAR fixture → parsed filing content via CIK direct-pin", async () => {
    const transport: Transport = {
      getText: vi.fn(),
      getJson: vi.fn().mockResolvedValue({
        cik: "1",
        name: "AIRWALLEX",
        filings: { recent: { form: ["S-1"], filingDate: ["2026-02-01"] } },
      }),
    };
    const connector = createRegulatoryConnector();
    const content = await connector.fetch(
      "https://data.sec.gov/submissions/CIK0000000001.json",
      transport,
      source("https://data.sec.gov/submissions/CIK0000000001.json"),
    );
    expect(content?.text).toContain("S-1");
    expect(content?.sourceType).toBe("REGULATORY");
    expect(content).not.toHaveProperty("evidenceTier");
  });

  it("MAS directory fixture → licence + status", async () => {
    const transport: Transport = {
      getText: vi.fn().mockResolvedValue(
        "<body>Licence Class: Major Payment Institution. Status: Active.</body>",
      ),
      getJson: vi.fn(),
    };
    const connector = createRegulatoryConnector();
    const content = await connector.fetch(
      "https://eservices.mas.gov.sg/fid/institution/detail/123",
      transport,
      source("https://eservices.mas.gov.sg/fid/institution/detail/123"),
    );
    expect(content?.text).toContain("Major Payment Institution");
  });

  it("unrouted host → null (isolated)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connector = createRegulatoryConnector();
    const content = await connector.fetch(
      "https://example.com/x",
      { getText: vi.fn(), getJson: vi.fn() },
      source("https://example.com/x"),
    );
    expect(content).toBeNull();
    warn.mockRestore();
  });
});

describe("matchCompanyToEntry (disambiguation, never guesses)", () => {
  it("matches a unique candidate", () => {
    const r = matchCompanyToEntry("Airwallex", [
      { id: "1", name: "Airwallex Pte Ltd" },
      { id: "2", name: "Nium Pte Ltd" },
    ]);
    expect(r.matched?.id).toBe("1");
  });

  it("returns a loud no-match on ambiguity (never a wrong guess)", () => {
    const r = matchCompanyToEntry("Payments", [
      { id: "1", name: "Payments Asia Ltd" },
      { id: "2", name: "Global Payments Inc" },
    ]);
    expect(r.matched).toBeNull();
    expect(r.reason).toMatch(/ambiguous/);
  });

  it("returns a loud no-match when nothing matches", () => {
    const r = matchCompanyToEntry("Kyriba", [{ id: "1", name: "Airwallex" }]);
    expect(r.matched).toBeNull();
    expect(r.reason).toMatch(/no match/);
  });
});
