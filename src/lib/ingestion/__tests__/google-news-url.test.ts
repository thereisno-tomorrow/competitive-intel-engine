import { describe, it, expect } from "vitest";
import {
  isGoogleNewsRssUrl,
  normalizeGoogleNewsUrl,
  resolveGoogleNewsUrl,
} from "../google-news-url";

describe("isGoogleNewsRssUrl", () => {
  it("should detect Google News RSS URLs", () => {
    expect(
      isGoogleNewsRssUrl("https://news.google.com/rss/articles/CBMi123"),
    ).toBe(true);
  });

  it("should reject non-RSS Google News URLs", () => {
    expect(
      isGoogleNewsRssUrl("https://news.google.com/articles/CBMi123"),
    ).toBe(false);
  });

  it("should reject non-Google-News URLs", () => {
    expect(isGoogleNewsRssUrl("https://reuters.com/article/xyz")).toBe(false);
    expect(isGoogleNewsRssUrl("https://example.com")).toBe(false);
  });
});

describe("normalizeGoogleNewsUrl", () => {
  it("should strip /rss/ from Google News RSS URLs", () => {
    expect(
      normalizeGoogleNewsUrl("https://news.google.com/rss/articles/CBMi123"),
    ).toBe("https://news.google.com/articles/CBMi123");
  });

  it("should return non-RSS URLs unchanged", () => {
    const url = "https://news.google.com/articles/CBMi123";
    expect(normalizeGoogleNewsUrl(url)).toBe(url);
  });

  it("should return non-Google URLs unchanged", () => {
    const url = "https://reuters.com/article/xyz";
    expect(normalizeGoogleNewsUrl(url)).toBe(url);
  });
});

/**
 * Build a fake CBMi article ID with a known URL embedded in protobuf format.
 * Protobuf: field 1 varint (0x08, value) + field 4 length-delimited (0x22, len, url)
 */
function buildCBMiArticleId(embeddedUrl: string): string {
  const urlBytes = Buffer.from(embeddedUrl, "utf-8");
  const buf = Buffer.alloc(3 + 1 + urlBytes.length);
  buf[0] = 0x08; // field 1, wire type varint
  buf[1] = 0x13; // value 19
  buf[2] = 0x22; // field 4, wire type length-delimited
  buf[3] = urlBytes.length; // length (assumes < 128)
  urlBytes.copy(buf, 4);
  return buf.toString("base64").replace(/=+$/, ""); // strip padding like Google does
}

describe("resolveGoogleNewsUrl", () => {
  it("should return non-Google-News URLs unchanged", async () => {
    const url = "https://www.reuters.com/technology/article";
    expect(await resolveGoogleNewsUrl(url)).toBe(url);
  });

  it("should decode CBMi article IDs via base64 protobuf (no network)", async () => {
    const realUrl = "https://www.reuters.com/technology/test-article";
    const articleId = buildCBMiArticleId(realUrl);
    const googleUrl = `https://news.google.com/articles/${articleId}`;

    const resolved = await resolveGoogleNewsUrl(googleUrl);

    expect(resolved).toBe(realUrl);
  });

  it("should handle RSS-format Google News URLs with CBMi IDs", async () => {
    const realUrl = "https://finovate.com/some-fintech-news/";
    const articleId = buildCBMiArticleId(realUrl);
    const rssUrl = `https://news.google.com/rss/articles/${articleId}`;

    const resolved = await resolveGoogleNewsUrl(rssUrl);

    expect(resolved).toBe(realUrl);
  });

  it("should strip query params before decoding article ID", async () => {
    const realUrl = "https://example.com/article";
    const articleId = buildCBMiArticleId(realUrl);
    // Google appends ?oc=5 to some URLs — must not corrupt base64 decode
    const urlWithQuery = `https://news.google.com/articles/${articleId}?oc=5`;

    const resolved = await resolveGoogleNewsUrl(urlWithQuery);

    expect(resolved).toBe(realUrl);
  });

  it("should fall back to normalized URL for AU_yqL IDs (no network in tests)", async () => {
    // AU_yqL IDs need the batchexecute API which requires network.
    // Without mocking fetch, the function should gracefully fall back.
    const url =
      "https://news.google.com/rss/articles/CBMikAFBVV95cUxNUlZ5UnJDRjFi";

    const resolved = await resolveGoogleNewsUrl(url);

    // Should at least normalize (strip /rss/) as fallback
    expect(resolved).not.toContain("/rss/articles/");
  });

  it("should handle malformed article IDs gracefully", async () => {
    const url = "https://news.google.com/articles/not-valid-base64!!!";

    const resolved = await resolveGoogleNewsUrl(url);

    // Should not throw — returns normalized or original URL
    expect(resolved).toBeDefined();
  });
});
