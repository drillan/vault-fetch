import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extract, extractMetadata } from "../src/extractor.js";

const fixtureHtml = readFileSync("tests/fixtures/article.html", "utf-8");

describe("extractMetadata", () => {
  it("extracts title from HTML", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/article");
    expect(meta.title).toBe("テスト記事タイトル");
  });

  it("extracts author from article:author meta tag", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/article");
    expect(meta.author).toContain("[[山田太郎]]");
  });

  it("extracts published date", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/article");
    expect(meta.published).toBe("2025-06-14");
  });

  it("extracts description from og:description", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/article");
    expect(meta.description).toBe("OGの説明文です");
  });

  it("sets source to the provided URL", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/final");
    expect(meta.source).toBe("https://example.com/final");
  });

  it("sets created to today's date", () => {
    const meta = extractMetadata(fixtureHtml, "https://example.com/article");
    const today = new Date().toISOString().split("T")[0];
    expect(meta.created).toBe(today);
  });
});

describe("extract", () => {
  it("extracts article content via Readability", () => {
    const result = extract(fixtureHtml, "https://example.com/article");
    expect(result.content).toContain("テスト記事の本文");
  });

  it("excludes navigation and sidebar", () => {
    const result = extract(fixtureHtml, "https://example.com/article");
    expect(result.content).not.toContain("ナビゲーション");
    expect(result.content).not.toContain("サイドバー");
  });

  it("returns metadata and content together", () => {
    const result = extract(fixtureHtml, "https://example.com/article");
    expect(result.metadata.title).toBe("テスト記事タイトル");
    expect(result.content).toContain("テスト記事の本文");
  });

  it("throws when Readability cannot parse content", () => {
    expect(() => extract("", "https://example.com")).toThrow(
      "Readability failed to extract content from the page",
    );
  });

  it("includes --raw and --selector hints in Readability failure message", () => {
    expect(() => extract("", "https://example.com")).toThrow("--raw");
    expect(() => extract("", "https://example.com")).toThrow("--selector");
  });

  it("throws when given completely empty HTML", () => {
    expect(() => extract("<html><head></head><body></body></html>", "https://example.com")).toThrow();
  });
});
