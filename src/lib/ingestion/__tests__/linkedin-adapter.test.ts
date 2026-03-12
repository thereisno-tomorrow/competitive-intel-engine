import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSource } from "@/generated/prisma/client";
import { LinkedInAdapter, parsePhantomUrl } from "../adapters/linkedin";
import { hashContent } from "../diff-engine";

// ---------------------------------------------------------------------------
// Mock PhantomBusterClient
// ---------------------------------------------------------------------------

const mockFetchLatestOutput = vi.fn();
const mockFetchResultJson = vi.fn();

vi.mock("@/lib/phantombuster/client", () => ({
  PhantomBusterClient: class {
    fetchLatestOutput = mockFetchLatestOutput;
    fetchResultJson = mockFetchResultJson;
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPostsSource: DataSource = {
  id: "src-li-posts",
  competitorId: "comp-1",
  type: "LINKEDIN",
  url: "pb://agent123/posts",
  cadence: "DAILY",
  health: "HEALTHY",
  lastChecked: null,
  lastChangeDetected: null,
  lastContentHash: null,
  createdAt: new Date("2025-01-01"),
};

const mockJobsSource: DataSource = {
  ...mockPostsSource,
  id: "src-li-jobs",
  url: "pb://agent456/jobs",
};

const mockCompanySource: DataSource = {
  ...mockPostsSource,
  id: "src-li-company",
  url: "pb://agent789/company",
  cadence: "WEEKLY",
};

const samplePosts = [
  {
    postUrl: "https://linkedin.com/feed/post-1",
    text: "Excited to announce our new treasury AI feature!",
    likeCount: 42,
    commentCount: 5,
    postDate: "2026-02-10",
  },
  {
    postUrl: "https://linkedin.com/feed/post-2",
    text: "We just closed a $100M Series C.",
    likeCount: 200,
    commentCount: 30,
    postDate: "2026-02-08",
  },
];

const sampleJobs = [
  {
    jobUrl: "https://linkedin.com/jobs/1001",
    title: "Senior AI Engineer",
    location: "Singapore",
    publishedDate: "2026-02-09",
    description: "Build ML models for treasury optimization",
  },
  {
    jobUrl: "https://linkedin.com/jobs/1002",
    title: "Product Manager, Payments",
    location: "Remote",
  },
];

const sampleCompany = [
  {
    name: "Kyriba",
    linkedinUrl: "https://linkedin.com/company/kyriba",
    employeeCount: 1200,
    tagline: "Treasury management for the modern enterprise",
    description: "Leading cloud treasury platform",
    industry: "Financial Technology",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LinkedInAdapter", () => {
  let adapter: LinkedInAdapter;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
    vi.clearAllMocks();
  });

  it("has sourceType LINKEDIN", () => {
    expect(adapter.sourceType).toBe("LINKEDIN");
  });

  // -----------------------------------------------------------------------
  // URL parsing
  // -----------------------------------------------------------------------

  describe("parsePhantomUrl", () => {
    it("parses pb://agentId/posts", () => {
      const result = parsePhantomUrl("pb://abc123/posts");
      expect(result).toEqual({ agentId: "abc123", phantomType: "posts" });
    });

    it("parses pb://agentId/jobs", () => {
      const result = parsePhantomUrl("pb://def456/jobs");
      expect(result).toEqual({ agentId: "def456", phantomType: "jobs" });
    });

    it("parses pb://agentId/company", () => {
      const result = parsePhantomUrl("pb://ghi789/company");
      expect(result).toEqual({ agentId: "ghi789", phantomType: "company" });
    });

    it("throws for invalid URL format", () => {
      expect(() => parsePhantomUrl("https://linkedin.com/company/kyriba")).toThrow(
        "Invalid LinkedIn DataSource URL",
      );
    });

    it("throws for missing phantom type", () => {
      expect(() => parsePhantomUrl("pb://agent123")).toThrow(
        "Invalid LinkedIn DataSource URL",
      );
    });

    it("throws for unknown phantom type", () => {
      expect(() => parsePhantomUrl("pb://agent123/profiles")).toThrow(
        "Invalid LinkedIn DataSource URL",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Posts phantom
  // -----------------------------------------------------------------------

  describe("posts phantom", () => {
    it("returns per-item changes for each post", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(samplePosts);

      const raw = await adapter.fetch(mockPostsSource);
      const changes = await adapter.detectChanges(raw, "some-previous-hash");

      expect(changes).toHaveLength(2);
      expect(changes[0]).toMatchObject({
        changeType: "linkedin_post",
        url: "https://linkedin.com/feed/post-1",
        publishedAt: "2026-02-10",
      });
      expect(changes[0]!.content).toContain("Excited to announce");
      expect(changes[0]!.content).toContain("Likes: 42");
      expect(changes[1]).toMatchObject({
        changeType: "linkedin_post",
        url: "https://linkedin.com/feed/post-2",
      });
    });

    it("caps items on first run", async () => {
      const manyPosts = Array.from({ length: 20 }, (_, i) => ({
        postUrl: `https://linkedin.com/feed/post-${i}`,
        text: `Post number ${i}`,
        postDate: `2026-02-${String(i + 1).padStart(2, "0")}`,
      }));

      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(manyPosts);

      const raw = await adapter.fetch(mockPostsSource);
      const changes = await adapter.detectChanges(raw, null); // first run

      expect(changes.length).toBeLessThanOrEqual(15);
    });

    it("returns empty for empty results", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue([]);

      const raw = await adapter.fetch(mockPostsSource);
      const changes = await adapter.detectChanges(raw, null);

      expect(changes).toHaveLength(0);
    });

    it("returns empty when phantom has never run", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: null,
      });

      const raw = await adapter.fetch(mockPostsSource);
      expect(raw.content).toBe("");

      const changes = await adapter.detectChanges(raw, null);
      expect(changes).toHaveLength(0);
    });

    it("returns empty when PhantomBuster API errors", async () => {
      mockFetchLatestOutput.mockRejectedValue(new Error("404"));

      const raw = await adapter.fetch(mockPostsSource);
      expect(raw.content).toBe("");

      const changes = await adapter.detectChanges(raw, null);
      expect(changes).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Jobs phantom
  // -----------------------------------------------------------------------

  describe("jobs phantom", () => {
    it("returns per-item changes for each job", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(sampleJobs);

      const raw = await adapter.fetch(mockJobsSource);
      const changes = await adapter.detectChanges(raw, "some-previous-hash");

      expect(changes).toHaveLength(2);
      expect(changes[0]).toMatchObject({
        changeType: "linkedin_job",
        url: "https://linkedin.com/jobs/1001",
        summary: "New job posting: Senior AI Engineer (Singapore)",
      });
      expect(changes[0]!.content).toContain("Title: Senior AI Engineer");
      expect(changes[0]!.content).toContain("Location: Singapore");
      expect(changes[1]!.summary).toBe(
        "New job posting: Product Manager, Payments (Remote)",
      );
    });

    it("caps items on first run", async () => {
      const manyJobs = Array.from({ length: 20 }, (_, i) => ({
        jobUrl: `https://linkedin.com/jobs/${i}`,
        title: `Role ${i}`,
      }));

      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(manyJobs);

      const raw = await adapter.fetch(mockJobsSource);
      const changes = await adapter.detectChanges(raw, null);

      expect(changes.length).toBeLessThanOrEqual(15);
    });
  });

  // -----------------------------------------------------------------------
  // Company phantom
  // -----------------------------------------------------------------------

  describe("company phantom", () => {
    it("returns empty on first run (baseline)", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(sampleCompany);

      const raw = await adapter.fetch(mockCompanySource);
      const changes = await adapter.detectChanges(raw, null); // first run

      expect(changes).toHaveLength(0);
    });

    it("returns change when content hash differs", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(sampleCompany);

      const raw = await adapter.fetch(mockCompanySource);
      const previousHash = hashContent("different old content");
      const changes = await adapter.detectChanges(raw, previousHash);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        changeType: "linkedin_company_change",
        url: "https://linkedin.com/company/kyriba",
        summary: "LinkedIn company profile change detected",
      });
      expect(changes[0]!.content).toContain("Name: Kyriba");
      expect(changes[0]!.content).toContain("Employees: 1200");
    });

    it("returns empty when content matches previous hash", async () => {
      mockFetchLatestOutput.mockResolvedValue({
        containerId: "c1",
        status: "finished",
        resultObject: "https://s3.example.com/results.json",
      });
      mockFetchResultJson.mockResolvedValue(sampleCompany);

      const raw = await adapter.fetch(mockCompanySource);
      const previousHash = hashContent(raw.content);
      const changes = await adapter.detectChanges(raw, previousHash);

      expect(changes).toHaveLength(0);
    });
  });
});
