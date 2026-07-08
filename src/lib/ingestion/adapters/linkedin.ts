import type { SourceType, DataSource } from "@/generated/prisma/client";
import type { IngestionAdapter, RawContent, DetectedChange } from "./base";
import { PhantomBusterClient } from "@/lib/phantombuster/client";
import { hasContentChanged } from "../diff-engine";
import { INGESTION } from "@/lib/config/thresholds";

type PhantomType = "posts" | "jobs" | "company";

/** Shape of a single post from PhantomBuster's LinkedIn Posts Scraper output. */
interface LinkedInPost {
  postUrl?: string;
  text?: string;
  action?: string;
  likeCount?: number;
  commentCount?: number;
  postDate?: string;
  profileUrl?: string;
}

/** Shape of a single job from PhantomBuster's LinkedIn Job Scraper output. */
interface LinkedInJob {
  jobUrl?: string;
  title?: string;
  location?: string;
  publishedDate?: string;
  description?: string;
  companyName?: string;
}

/** Shape of company data from PhantomBuster's LinkedIn Company Scraper output. */
interface LinkedInCompanyInfo {
  name?: string;
  linkedinUrl?: string;
  employeeCount?: number | string;
  tagline?: string;
  description?: string;
  website?: string;
  industry?: string;
  specialties?: string;
}

const PB_URL_REGEX = /^pb:\/\/([^/]+)\/(posts|jobs|company)$/;

/** Parsed LinkedIn payload passed from fetch() to detectChanges() (stateless). */
interface LinkedInPayload {
  phantomType: PhantomType;
  results: unknown[];
}

export class LinkedInAdapter implements IngestionAdapter {
  readonly sourceType: SourceType = "LINKEDIN";

  private client: PhantomBusterClient;

  constructor(client?: PhantomBusterClient) {
    this.client = client ?? new PhantomBusterClient({
      apiKey: process.env.PHANTOMBUSTER_API_KEY ?? "",
    });
  }

  private empty(source: DataSource, phantomType: PhantomType): RawContent {
    const payload: LinkedInPayload = { phantomType, results: [] };
    return { content: "", url: source.url, fetchedAt: new Date(), payload };
  }

  async fetch(source: DataSource): Promise<RawContent> {
    const { agentId, phantomType } = parsePhantomUrl(source.url);

    let output;
    try {
      output = await this.client.fetchLatestOutput(agentId);
    } catch {
      // Phantom not found or API error — return empty content
      return this.empty(source, phantomType);
    }

    if (!output.resultObject) {
      // Phantom has never run or has no results
      return this.empty(source, phantomType);
    }

    let results: unknown[];
    try {
      results = await this.client.fetchResultJson(output.resultObject);
    } catch {
      return this.empty(source, phantomType);
    }

    const payload: LinkedInPayload = { phantomType, results };
    return {
      content: JSON.stringify(results),
      url: source.url,
      fetchedAt: new Date(),
      payload,
    };
  }

  async detectChanges(
    current: RawContent,
    previousHash: string | null,
  ): Promise<DetectedChange[]> {
    const payload = current.payload as LinkedInPayload | undefined;
    const results = payload?.results ?? [];
    if (!current.content || results.length === 0) {
      return [];
    }

    switch (payload?.phantomType) {
      case "posts":
        return this.detectPostChanges(results, previousHash);
      case "jobs":
        return this.detectJobChanges(results, previousHash);
      case "company":
        return this.detectCompanyChanges(results, current, previousHash);
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Posts
  // ---------------------------------------------------------------------------

  private detectPostChanges(
    results: unknown[],
    previousHash: string | null,
  ): DetectedChange[] {
    const posts = results as LinkedInPost[];
    const isFirstRun = previousHash === null;

    let items = posts.filter((p) => p.text || p.postUrl);

    if (isFirstRun) {
      items = items
        .sort((a, b) => {
          const dateA = new Date(a.postDate ?? 0).getTime();
          const dateB = new Date(b.postDate ?? 0).getTime();
          return dateB - dateA;
        })
        .slice(0, INGESTION.MAX_ITEMS_ON_FIRST_RUN);
    }

    return items.map((post) => ({
      competitorId: "",
      sourceId: "",
      changeType: "linkedin_post",
      content: formatPost(post),
      url: post.postUrl ?? "",
      summary: summarizePost(post),
      publishedAt: post.postDate,
    }));
  }

  // ---------------------------------------------------------------------------
  // Jobs
  // ---------------------------------------------------------------------------

  private detectJobChanges(
    results: unknown[],
    previousHash: string | null,
  ): DetectedChange[] {
    const jobs = results as LinkedInJob[];
    const isFirstRun = previousHash === null;

    let items = jobs.filter((j) => j.title || j.jobUrl);

    if (isFirstRun) {
      items = items.slice(0, INGESTION.MAX_ITEMS_ON_FIRST_RUN);
    }

    return items.map((job) => ({
      competitorId: "",
      sourceId: "",
      changeType: "linkedin_job",
      content: formatJob(job),
      url: job.jobUrl ?? "",
      summary: `New job posting: ${job.title ?? "Unknown role"}${job.location ? ` (${job.location})` : ""}`,
      publishedAt: job.publishedDate,
    }));
  }

  // ---------------------------------------------------------------------------
  // Company
  // ---------------------------------------------------------------------------

  private detectCompanyChanges(
    results: unknown[],
    current: RawContent,
    previousHash: string | null,
  ): DetectedChange[] {
    // First run: baseline only — no previous data to compare
    if (previousHash === null) {
      return [];
    }

    if (!hasContentChanged(current.content, previousHash)) {
      return [];
    }

    const companies = results as LinkedInCompanyInfo[];
    const info = companies[0];
    if (!info) return [];

    return [{
      competitorId: "",
      sourceId: "",
      changeType: "linkedin_company_change",
      content: formatCompany(info),
      url: info.linkedinUrl ?? "",
      summary: "LinkedIn company profile change detected",
    }];
  }
}

// =============================================================================
// Helpers
// =============================================================================

export function parsePhantomUrl(url: string): { agentId: string; phantomType: PhantomType } {
  const match = url.match(PB_URL_REGEX);
  if (!match) {
    throw new Error(
      `Invalid LinkedIn DataSource URL: "${url}". Expected format: pb://{agentId}/posts|jobs|company`,
    );
  }
  return { agentId: match[1]!, phantomType: match[2] as PhantomType };
}

function formatPost(post: LinkedInPost): string {
  const parts = [post.text ?? ""];
  if (post.action) parts.push(`Action: ${post.action}`);
  if (post.likeCount != null) parts.push(`Likes: ${post.likeCount}`);
  if (post.commentCount != null) parts.push(`Comments: ${post.commentCount}`);
  return parts.join("\n");
}

function formatJob(job: LinkedInJob): string {
  const parts = [`Title: ${job.title ?? "Unknown"}`];
  if (job.location) parts.push(`Location: ${job.location}`);
  if (job.description) parts.push(`Description: ${job.description}`);
  return parts.join("\n");
}

function formatCompany(info: LinkedInCompanyInfo): string {
  const parts = [`Name: ${info.name ?? "Unknown"}`];
  if (info.employeeCount != null) parts.push(`Employees: ${info.employeeCount}`);
  if (info.tagline) parts.push(`Tagline: ${info.tagline}`);
  if (info.description) parts.push(`Description: ${info.description}`);
  if (info.industry) parts.push(`Industry: ${info.industry}`);
  if (info.website) parts.push(`Website: ${info.website}`);
  return parts.join("\n");
}

function summarizePost(post: LinkedInPost): string {
  const text = post.text ?? "";
  return text.length > 120 ? `${text.slice(0, 120)}...` : text || "New LinkedIn post";
}
