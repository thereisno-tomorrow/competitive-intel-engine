import { describe, it, expect } from "vitest";
import {
  hashContent,
  hasContentChanged,
  extractTextContent,
} from "../diff-engine";

describe("hashContent", () => {
  it("should produce a consistent hash for the same content", () => {
    const content = "Hello, world!";
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it("should produce a different hash for different content", () => {
    const hash1 = hashContent("Hello, world!");
    const hash2 = hashContent("Goodbye, world!");

    expect(hash1).not.toBe(hash2);
  });
});

describe("hasContentChanged", () => {
  it("should return true when no previous hash exists", () => {
    expect(hasContentChanged("any content", null)).toBe(true);
  });

  it("should return false when content matches the previous hash", () => {
    const content = "Hello, world!";
    const hash = hashContent(content);

    expect(hasContentChanged(content, hash)).toBe(false);
  });

  it("should return true when content differs from the previous hash", () => {
    const originalContent = "Hello, world!";
    const hash = hashContent(originalContent);
    const newContent = "Hello, updated world!";

    expect(hasContentChanged(newContent, hash)).toBe(true);
  });
});

describe("extractTextContent", () => {
  it("should strip HTML tags and return text only", () => {
    const html =
      "<div>\n  <h1>Title</h1>\n  <p>Paragraph text</p>\n</div>";
    const text = extractTextContent(html);

    expect(text).toBe("Title Paragraph text");
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
  });

  it("should normalize whitespace", () => {
    const html = `
      <div>
        <p>  Multiple    spaces   and
        newlines  </p>
      </div>
    `;
    const text = extractTextContent(html);

    // All whitespace sequences collapsed to single space, trimmed
    expect(text).toBe("Multiple spaces and newlines");
    expect(text).not.toMatch(/\s{2,}/);
  });

  it("should remove script tags entirely", () => {
    const html = `
      <html>
        <body>
          <p>Visible text</p>
          <script>alert('should not appear');</script>
          <p>More visible text</p>
        </body>
      </html>
    `;
    const text = extractTextContent(html);

    expect(text).toContain("Visible text");
    expect(text).toContain("More visible text");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("should not appear");
  });

  it("should remove style tags entirely", () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
        </head>
        <body>
          <p>Styled content</p>
        </body>
      </html>
    `;
    const text = extractTextContent(html);

    expect(text).toContain("Styled content");
    expect(text).not.toContain("color");
    expect(text).not.toContain("red");
  });

  it("should remove noscript tags entirely", () => {
    const html = `
      <html>
        <body>
          <p>Main content</p>
          <noscript>Enable JavaScript to view this page</noscript>
        </body>
      </html>
    `;
    const text = extractTextContent(html);

    expect(text).toContain("Main content");
    expect(text).not.toContain("Enable JavaScript");
  });
});
