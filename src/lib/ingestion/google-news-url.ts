/**
 * Google News RSS URL utilities.
 *
 * Google News RSS feeds use opaque redirect URLs (/rss/articles/CBMi…)
 * that don't resolve via HTTP.
 *
 * Resolution strategy (in order):
 *   1. Base64 protobuf decode — instant, no network (works for legacy IDs
 *      where the publisher URL is embedded directly).
 *   2. Batchexecute API — two HTTP requests to Google's internal RPC endpoint
 *      (required for newer AU_yqL opaque tokens, including those wrapped in
 *      a CBMi protobuf envelope).
 *   3. Fallback — normalized Google News URL (browser JS redirect only).
 */

// Dynamic import to avoid ESM/CommonJS issues on Vercel
// import { JSDOM } from "jsdom";

const GNEWS_RSS_PATTERN = /^https?:\/\/news\.google\.com\/rss\/articles\//i;
const GNEWS_ARTICLE_PATTERN =
  /^https?:\/\/news\.google\.com\/(?:rss\/)?articles\/([^?#]+)/i;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** True when the URL is a Google News RSS redirect. */
export function isGoogleNewsRssUrl(url: string): boolean {
  return GNEWS_RSS_PATTERN.test(url);
}

/**
 * Convert a Google News RSS redirect URL to a browser-clickable article URL.
 * Non-Google-News URLs are returned unchanged.
 *
 * `/rss/articles/CBMi…`  →  `/articles/CBMi…`
 */
export function normalizeGoogleNewsUrl(url: string): string {
  if (!isGoogleNewsRssUrl(url)) return url;
  return url.replace(/\/rss\/articles\//, "/articles/");
}

// ---------------------------------------------------------------------------
// Full URL resolution — decode the real publisher URL
// ---------------------------------------------------------------------------

/**
 * Resolve a Google News URL to the real publisher URL.
 *
 * Tries base64 protobuf decode first (instant). If the decoded payload is an
 * AU_yqL opaque token, falls back to the two-step batchexecute API (2 HTTP
 * requests). Returns normalized Google News URL on any failure.
 *
 * @param signal Optional AbortSignal to cancel in-flight network requests.
 */
export async function resolveGoogleNewsUrl(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const match = url.match(GNEWS_ARTICLE_PATTERN);
  if (!match) return url;

  const articleId = match[1]!;

  // Strategy 1: Base64 protobuf decode (instant, no network).
  try {
    const decoded = decodeArticleId(articleId);
    if (decoded) return decoded;
  } catch {
    // decode failed — fall through
  }

  // Strategy 2: Batchexecute API (2 HTTP requests).
  try {
    const resolved = await resolveViaBatchexecute(articleId, signal);
    if (resolved) return resolved;
  } catch {
    // network error, timeout, parse error — fall through
  }

  // Strategy 3: Fallback — normalized Google News URL (JS redirect in browser)
  return normalizeGoogleNewsUrl(url);
}

// ---------------------------------------------------------------------------
// Strategy 1: Base64 protobuf decode
// ---------------------------------------------------------------------------

/**
 * Decode the publisher URL from a base64-encoded protobuf article ID.
 * Returns null if the ID contains an opaque token (AU_yqL…) or can't be decoded.
 */
function decodeArticleId(articleId: string): string | null {
  const buf = Buffer.from(articleId, "base64");
  let offset = 0;

  // Skip field 1 varint (tag 0x08) if present
  if (buf[0] === 0x08) {
    offset = 1;
    while (offset < buf.length && buf[offset]! >= 0x80) offset++;
    offset++; // past last byte of varint
  }

  // Expect field 4 length-delimited (tag 0x22)
  if (buf[offset] !== 0x22) return null;
  offset++;

  // Read length as varint
  let len = 0;
  let shift = 0;
  while (offset < buf.length) {
    const byte = buf[offset]!;
    len |= (byte & 0x7f) << shift;
    offset++;
    if (byte < 0x80) break;
    shift += 7;
  }

  const urlStr = buf.subarray(offset, offset + len).toString("utf-8");

  // Opaque token — can't decode locally
  if (urlStr.startsWith("AU_yqL")) return null;

  return urlStr.startsWith("http") ? urlStr : null;
}

// ---------------------------------------------------------------------------
// Strategy 2: Batchexecute API (two-step: fetch signature → decode)
// ---------------------------------------------------------------------------

/**
 * Resolve an AU_yqL article ID via Google's batchexecute RPC.
 *
 * Step 1: GET the article page to extract `data-n-a-sg` (signature) and
 *         `data-n-a-ts` (timestamp) from HTML.
 * Step 2: POST to batchexecute with the `Fbv4je` RPC to decode the real URL.
 */
async function resolveViaBatchexecute(
  articleId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  // Step 1: Fetch signature and timestamp from article page
  const articlePageUrl = `https://news.google.com/articles/${articleId}`;
  const pageResponse = await fetch(articlePageUrl, {
    signal,
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!pageResponse.ok) return null;

  const html = await pageResponse.text();
  const { signature, timestamp } = await extractDecodingParams(html);
  if (!signature || !timestamp) return null;

  // Step 2: POST to batchexecute RPC
  const garturlreq = JSON.stringify([
    "garturlreq",
    [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
    ],
    articleId,
    Number(timestamp),
    signature,
  ]);

  const payload = JSON.stringify([[["Fbv4je", garturlreq]]]);
  const body = `f.req=${encodeURIComponent(payload)}`;

  const rpcResponse = await fetch(
    "https://news.google.com/_/DotsSplashUi/data/batchexecute",
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": BROWSER_UA,
      },
      body,
    },
  );

  if (!rpcResponse.ok) return null;

  const rpcText = await rpcResponse.text();
  return parseBatchexecuteResponse(rpcText);
}

/**
 * Extract `data-n-a-sg` (signature) and `data-n-a-ts` (timestamp) from
 * the Google News article page HTML.
 */
async function extractDecodingParams(html: string): Promise<{
  signature: string | null;
  timestamp: string | null;
}> {
  // Use regex first (faster than full DOM parse)
  const sigMatch = html.match(/data-n-a-sg="([^"]+)"/);
  const tsMatch = html.match(/data-n-a-ts="([^"]+)"/);

  if (sigMatch && tsMatch) {
    return { signature: sigMatch[1]!, timestamp: tsMatch[1]! };
  }

  // Fallback: parse with JSDOM for robustness
  try {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(html);
    const el = dom.window.document.querySelector("c-wiz > div[jscontroller]");
    if (!el) return { signature: null, timestamp: null };
    return {
      signature: el.getAttribute("data-n-a-sg"),
      timestamp: el.getAttribute("data-n-a-ts"),
    };
  } catch {
    return { signature: null, timestamp: null };
  }
}

/**
 * Parse the batchexecute response to extract the decoded publisher URL.
 *
 * Response format: security prefix `)]}'`, then chunks separated by `\n\n`.
 * The second chunk contains nested JSON with the URL at a known path.
 */
function parseBatchexecuteResponse(text: string): string | null {
  // Method 1: Search for garturlres marker (more resilient to format changes)
  const header = '["garturlres","';
  const headerIdx = text.indexOf(header);
  if (headerIdx !== -1) {
    const urlStart = headerIdx + header.length;
    const urlEnd = text.indexOf('"', urlStart);
    if (urlEnd !== -1) {
      const url = text.substring(urlStart, urlEnd);
      if (url.startsWith("http")) return url;
    }
  }

  // Method 2: Structured parsing (per SSujitX algorithm)
  try {
    const chunks = text.split("\n\n");
    if (chunks.length < 2) return null;

    const outer = JSON.parse(chunks[1]!) as unknown[][];
    if (!Array.isArray(outer) || outer.length === 0) return null;

    // Remove trailing metadata entries
    const entry = outer[0];
    if (!Array.isArray(entry) || entry.length < 3) return null;

    const innerJson = entry[2] as string;
    if (typeof innerJson !== "string") return null;

    const inner = JSON.parse(innerJson) as string[];
    if (Array.isArray(inner) && typeof inner[1] === "string" && inner[1].startsWith("http")) {
      return inner[1];
    }
  } catch {
    // parse error — fall through
  }

  return null;
}
