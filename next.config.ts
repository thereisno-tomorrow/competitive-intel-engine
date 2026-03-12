import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jsdom", "@mozilla/readability", "cheerio", "rss-parser"],
};

export default nextConfig;
