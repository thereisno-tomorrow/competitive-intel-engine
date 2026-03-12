import "dotenv/config";
import { resolveGoogleNewsUrl } from "../lib/ingestion/google-news-url";
import { fetchArticleContent } from "../lib/ingestion/article-fetcher";

// Real URLs from the last ingestion run
const testUrls = [
  "https://news.google.com/rss/articles/CBMi0AFBVV95cUxNWXVyOGVIY1hzRjNxVkRmZWMwTXpoTl9SNzlSOVpBMHBwcmFSUW90N2ZHV2M5TENxM2RJTWVYaVd1Wk1ZTWdWT0RrWmVTbW1yTDZNNGpUcFlGNVd1SWZ0MEZSdUVySGh1QnlrR3paaVRJQi1hYUMtSmFPMG1PV2xFTndleUVTZUp1Qnp4SE9vNVEycnlvMG9GWHIyTDNZUEVzLV9QUWpaejRIbEJYd3cwN3ZsWlRWN3RvbnYtUENGZ1Zqd0lnZlNmMFpPa3pGYVN0",
  "https://news.google.com/rss/articles/CBMie0FVX3lxTE9LWUxaOHYxLTBZOGlMZFpBeXgwWExEYUt3dDNHSVFxdHhkX19CbC02YjFBUWdzMFZFRGxBZjhBQUNiMHRlLXY0clpJa09feFRDYkdjTDE5OVVNR2tzLUJHazVDNlRmSExVM3lrM1dwS1E0dXZUVWU4YWFRYw",
  "https://news.google.com/rss/articles/CBMickFVX3lxTFBXMEJSLTEzZ25JSU5QS2V2WDhNMDF5Wl9xU2xldEtDSF9JS0R3Wlo3cklEb2xMMnhlNGJFWG1CcGNjajlkcjRwNGpmdGdwYVNlUnFqVU9TMkV5WFJHTzV3cnZ0ZWx5TmRhZTJGWlFqQU9Mdw",
];

async function main() {
  console.log("=== URL Resolution Test (with batchexecute) ===\n");

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i]!;
    console.log(`--- URL ${i + 1} ---`);
    console.log(`Input: ${url.slice(0, 80)}...`);

    const start = Date.now();
    const resolved = await resolveGoogleNewsUrl(url);
    const ms = Date.now() - start;

    const isGnews = /news\.google\.com/.test(resolved);
    console.log(`Resolved (${ms}ms): ${resolved.slice(0, 120)}`);
    console.log(`Success: ${!isGnews ? "YES - real publisher URL" : "NO - still Google News"}`);

    if (!isGnews) {
      console.log("Fetching article content...");
      const article = await fetchArticleContent(url, { timeoutMs: 20000 });
      if (article) {
        console.log(`  Content: ${article.content.length} chars`);
        console.log(`  Title: ${article.title}`);
        console.log(`  Final URL: ${article.resolvedUrl}`);
        console.log(`  Preview: ${article.content.slice(0, 150)}...`);
      } else {
        console.log("  Article fetch FAILED (returned null)");
      }
    }

    console.log();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
