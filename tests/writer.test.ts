import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sanitizeFilename, buildFrontmatter, writeMarkdownFile } from "../src/writer.js";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Metadata } from "../src/types.js";

describe("sanitizeFilename", () => {
  it("removes filesystem-unsafe characters and normalizes spaces", () => {
    expect(sanitizeFilename('File: "test" <name>')).toBe("File test name.md");
  });

  it("truncates to 200 characters (base name), total length <= 203 with .md", () => {
    const long = "あ".repeat(250);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(203);
  });

  it("appends .md extension", () => {
    expect(sanitizeFilename("Title")).toBe("Title.md");
  });

  it("preserves Japanese characters", () => {
    expect(sanitizeFilename("日本語タイトル")).toBe("日本語タイトル.md");
  });

  it("preserves fullwidth characters like ｜", () => {
    expect(sanitizeFilename("タイトル｜著者")).toBe("タイトル｜著者.md");
  });
});

describe("buildFrontmatter", () => {
  const metadata: Metadata = {
    title: "テスト記事",
    source: "https://example.com",
    author: ["[[山田太郎]]"],
    published: "2025-06-14",
    created: "2025-07-03",
    description: "説明文",
  };

  it("generates valid YAML frontmatter", () => {
    const fm = buildFrontmatter(metadata, ["clippings"]);
    expect(fm).toMatch(/^---\n/);
    expect(fm).toMatch(/\n---$/);
  });

  it("includes all metadata fields", () => {
    const fm = buildFrontmatter(metadata, ["clippings"]);
    expect(fm).toContain("title:");
    expect(fm).toContain("テスト記事");
    expect(fm).toContain("source:");
    expect(fm).toContain("https://example.com");
    expect(fm).toContain("[[山田太郎]]");
    expect(fm).toContain("2025-06-14");
    expect(fm).toContain("2025-07-03");
    expect(fm).toContain("clippings");
  });

  it("includes custom tags", () => {
    const fm = buildFrontmatter(metadata, ["clippings", "tech"]);
    expect(fm).toContain("tech");
  });

  it("safely escapes quotes in title and description", () => {
    const metaWithQuotes: Metadata = {
      ...metadata,
      title: '記事の"要約"について',
      description: 'He said "hello"',
    };
    const fm = buildFrontmatter(metaWithQuotes, ["clippings"]);
    expect(fm).toContain("---");
    expect(fm).toContain('記事の"要約"について');
  });
});

describe("writeMarkdownFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-writer-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes frontmatter + content to file", () => {
    const metadata: Metadata = {
      title: "テスト",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    const filePath = writeMarkdownFile(tmpDir, metadata, "# Content", ["clippings"]);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("# Content");
  });

  it("overwrites existing file", () => {
    const metadata: Metadata = {
      title: "Same",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    writeMarkdownFile(tmpDir, metadata, "First", ["clippings"]);
    writeMarkdownFile(tmpDir, metadata, "Second", ["clippings"]);
    const filePath = join(tmpDir, "Same.md");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("Second");
    expect(content).not.toContain("First");
  });

  it("throws when dest directory does not exist", () => {
    const metadata: Metadata = {
      title: "Test",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    expect(() =>
      writeMarkdownFile("/nonexistent/path", metadata, "content", ["clippings"]),
    ).toThrow();
  });
});
