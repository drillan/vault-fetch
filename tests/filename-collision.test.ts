import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeMarkdownFile } from "../src/writer.js";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
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

  it("increments suffix across three different sources", () => {
    writeMarkdownFile(tmpDir, meta("https://a.com"), "A", ["clippings"]);
    writeMarkdownFile(tmpDir, meta("https://b.com"), "B", ["clippings"]);
    const p3 = writeMarkdownFile(tmpDir, meta("https://c.com"), "C", ["clippings"]);
    expect(p3).toBe(join(tmpDir, "Same Title-3.md"));
  });
});
