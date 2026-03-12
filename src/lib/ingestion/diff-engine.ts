import { createHash } from "crypto";
import * as cheerio from "cheerio";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function hasContentChanged(
  content: string,
  previousHash: string | null,
): boolean {
  if (!previousHash) return true;
  return hashContent(content) !== previousHash;
}

export function extractTextContent(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $.text();
  return text.replace(/\s+/g, " ").trim();
}

/** Like extractTextContent but preserves links as `text (url)` so URLs are visible. */
export function extractTextWithLinks(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  $("a[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    const text = $el.text().trim();
    if (href && text && href.startsWith("http")) {
      $el.replaceWith(`${text} (${href})`);
    }
  });
  const text = $.text();
  return text.replace(/\s+/g, " ").trim();
}
