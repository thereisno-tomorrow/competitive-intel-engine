import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { loadRubric, resetRubricCache, RUBRIC_PATH } from "../rubric";

describe("loadRubric", () => {
  beforeEach(() => resetRubricCache());

  it("returns the rubric text + parsed version from the real file", () => {
    const rubric = loadRubric();
    expect(rubric.version).toMatch(/^\d+\.\d+\.\d+$/);
    // File-driven: the text is the actual file contents (edit the file → text changes).
    expect(rubric.text).toContain("GTM Analysis Rubric");
    expect(rubric.text).toContain("swap test");
  });

  it("throws a clear error when the file is missing", () => {
    expect(() => loadRubric(join(process.cwd(), "does-not-exist.md"))).toThrow(
      /Rubric file not found/,
    );
  });

  it("throws when the file has no parseable version header", () => {
    // package.json exists but has no **Version:** header.
    expect(() => loadRubric(join(process.cwd(), "package.json"))).toThrow(
      /no parseable/,
    );
  });

  it("default path points at the owner-editable strategy file", () => {
    expect(RUBRIC_PATH).toContain(join("docs", "rubric", "gtm-analysis-rubric.md"));
  });
});
