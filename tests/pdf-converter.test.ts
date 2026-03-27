import { describe, it, expect, vi } from "vitest";

vi.mock("@opendocsg/pdf2md", () => ({
  default: vi.fn(),
}));

import {
  convertPdfToMarkdown,
  extractTitleFromUrl,
} from "../src/pdf-converter.js";
import pdf2md from "@opendocsg/pdf2md";

const mockedPdf2md = vi.mocked(pdf2md);

describe("convertPdfToMarkdown", () => {
  it("returns markdown from pdf2md", async () => {
    mockedPdf2md.mockResolvedValueOnce("# Sample\n\nHello world");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(mockedPdf2md).toHaveBeenCalledWith(dummyBuffer);
    expect(result.markdown).toBe("# Sample\n\nHello world");
    expect(result.metadata.title).toBe("Sample");
    expect(result.metadata.source).toBe("https://example.com/doc.pdf");
  });

  it("uses URL filename as title when no heading found", async () => {
    mockedPdf2md.mockResolvedValueOnce("Plain text without heading");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/report.pdf");

    expect(result.metadata.title).toBe("report");
  });

  it("sets created date to today", async () => {
    mockedPdf2md.mockResolvedValueOnce("# Title\n\nContent");
    const dummyBuffer = Buffer.from("dummy-pdf");
    const today = new Date().toISOString().split("T")[0];

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(result.metadata.created).toBe(today);
  });

  it("sets author to empty array and published/description to null", async () => {
    mockedPdf2md.mockResolvedValueOnce("# Title\n\nContent");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(result.metadata.author).toEqual([]);
    expect(result.metadata.published).toBeNull();
    expect(result.metadata.description).toBeNull();
  });

  it("throws when pdf2md returns empty content", async () => {
    mockedPdf2md.mockResolvedValueOnce("   ");
    const dummyBuffer = Buffer.from("dummy-pdf");

    await expect(
      convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf"),
    ).rejects.toThrow("pdf2md returned empty content from the PDF");
  });

  it("propagates pdf2md errors", async () => {
    mockedPdf2md.mockRejectedValueOnce(new Error("Invalid PDF"));
    const dummyBuffer = Buffer.from("dummy-pdf");

    await expect(
      convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf"),
    ).rejects.toThrow("Invalid PDF");
  });
});

describe("extractTitleFromUrl", () => {
  it("extracts filename without .pdf extension", () => {
    expect(extractTitleFromUrl("https://example.com/report.pdf")).toBe("report");
  });

  it("decodes URL-encoded filenames", () => {
    expect(extractTitleFromUrl("https://example.com/%E3%83%AC%E3%83%9D%E3%83%BC%E3%83%88.pdf")).toBe(
      "レポート",
    );
  });

  it("handles nested paths", () => {
    expect(extractTitleFromUrl("https://example.com/docs/2026/annual-report.pdf")).toBe(
      "annual-report",
    );
  });

  it("handles URLs without .pdf extension", () => {
    expect(extractTitleFromUrl("https://example.com/document")).toBe("document");
  });

  it("throws for URLs without a path segment", () => {
    expect(() => extractTitleFromUrl("https://example.com/")).toThrow(
      "Cannot extract filename from URL",
    );
  });
});
