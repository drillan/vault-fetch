import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeMarkdownFile } from "../src/writer.js";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Metadata } from "../src/types.js";

function meta(source: string): Metadata {
  return {
    title: "Same Title",
    source,
    author: [],
    published: null,
    created: "2026-06-01",
    description: null,
  };
}

describe("writeMarkdownFile filename collision", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-collision-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a suffixed file when an existing file has a different source", () => {
    const p1 = writeMarkdownFile(tmpDir, meta("https://a.com"), "A", ["clippings"]);
    const p2 = writeMarkdownFile(tmpDir, meta("https://b.com"), "B", ["clippings"]);
    expect(p1).toBe(join(tmpDir, "Same Title.md"));
    expect(p2).toBe(join(tmpDir, "Same Title-2.md"));
    expect(readFileSync(p1, "utf-8")).toContain("A");
    expect(readFileSync(p2, "utf-8")).toContain("B");
  });

  it("overwrites when the existing file has the same source", () => {
    const p1 = writeMarkdownFile(tmpDir, meta("https://a.com"), "First", ["clippings"]);
    const p2 = writeMarkdownFile(tmpDir, meta("https://a.com"), "Second", ["clippings"]);
    expect(p2).toBe(p1);
    expect(readFileSync(p1, "utf-8")).toContain("Second");
    expect(existsSync(join(tmpDir, "Same Title-2.md"))).toBe(false);
  });

  it("overwrites same source even when the URL gets YAML-quoted", () => {
    const tricky = "https://example.com/search?q=react: hooks";
    const p1 = writeMarkdownFile(tmpDir, meta(tricky), "First", ["clippings"]);
    const p2 = writeMarkdownFile(tmpDir, meta(tricky), "Second", ["clippings"]);
    expect(p2).toBe(p1);
    expect(readFileSync(p1, "utf-8")).toContain("Second");
    expect(existsSync(join(tmpDir, "Same Title-2.md"))).toBe(false);
  });

  it("increments suffix across three different sources", () => {
    writeMarkdownFile(tmpDir, meta("https://a.com"), "A", ["clippings"]);
    writeMarkdownFile(tmpDir, meta("https://b.com"), "B", ["clippings"]);
    const p3 = writeMarkdownFile(tmpDir, meta("https://c.com"), "C", ["clippings"]);
    expect(p3).toBe(join(tmpDir, "Same Title-3.md"));
  });

  it("does not throw when a neighboring file has malformed frontmatter and saves to -2", () => {
    // Plant a neighbor with malformed frontmatter that causes yaml.load to throw
    const neighborPath = join(tmpDir, "Same Title.md");
    writeFileSync(neighborPath, "---\n: : : bad\n\ttab\n---\nsome content\n", "utf-8");

    // Writing a new note with the same title but a valid source must NOT throw
    // and must save to Same Title-2.md (malformed neighbor treated as "different source")
    let result: string;
    expect(() => {
      result = writeMarkdownFile(tmpDir, meta("https://example.com"), "New Content", ["clippings"]);
    }).not.toThrow();
    expect(existsSync(join(tmpDir, "Same Title-2.md"))).toBe(true);
    expect(result!).toBe(join(tmpDir, "Same Title-2.md"));
  });
});
