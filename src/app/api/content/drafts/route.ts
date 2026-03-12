import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateBlogDraft } from "@/lib/llm/prompts/content-draft-blog";
import { generateComparisonDraft } from "@/lib/llm/prompts/content-draft-comparison";

export async function POST(request: Request) {
  const body = await request.json();
  const { briefId, contentType, segment } = body as {
    briefId: string;
    contentType: "BLOG_POST" | "COMPARISON_PAGE";
    segment: "STARTUP" | "MSME" | "MID_MARKET";
  };

  // Fetch brief with competitor
  const brief = await prisma.contentBrief.findUnique({
    where: { id: briefId },
    include: { competitor: true },
  });

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  let content: string;

  if (contentType === "COMPARISON_PAGE") {
    // Fetch battlecard + competitor intel for comparison pages
    const [battlecard, competitorIntel] = await Promise.all([
      brief.competitorId
        ? prisma.battlecard.findUnique({
            where: { competitorId: brief.competitorId },
          })
        : null,
      brief.competitorId
        ? prisma.intelligenceItem.findMany({
            where: { competitorId: brief.competitorId },
            include: { competitor: true },
            orderBy: { detectedAt: "desc" },
            take: 15,
          })
        : [],
    ]);

    content = await generateComparisonDraft({
      brief,
      segment,
      battlecard,
      competitorIntel: competitorIntel ?? [],
    });
  } else {
    // Blog post — fetch related intel
    const relatedIntel = await prisma.intelligenceItem.findMany({
      include: { competitor: true },
      orderBy: { detectedAt: "desc" },
      take: 15,
    });

    content = await generateBlogDraft({
      brief,
      segment,
      relatedIntel,
    });
  }

  // Count words
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Get version number
  const existingDrafts = await prisma.contentDraft.count({
    where: { briefId, contentType, segment },
  });

  const draft = await prisma.contentDraft.create({
    data: {
      briefId,
      contentType,
      segment,
      title: brief.title,
      content,
      wordCount,
      version: existingDrafts + 1,
      generationMetadata: {
        model: "claude-sonnet-4-5-20250929",
        generatedAt: new Date().toISOString(),
        briefBucket: brief.bucket,
        briefFunnelStage: brief.funnelStage,
      },
    },
  });

  return NextResponse.json({
    id: draft.id,
    briefId: draft.briefId,
    contentType: draft.contentType,
    segment: draft.segment,
    title: draft.title,
    wordCount: draft.wordCount,
    version: draft.version,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
  });
}
