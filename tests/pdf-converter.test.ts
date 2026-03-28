import { describe, it, expect, vi } from "vitest";

vi.mock("@opendocsg/pdf2md", () => ({
  default: vi.fn(),
}));

import {
  convertPdfToMarkdown,
  extractTitleFromUrl,
  parsePdfDate,
} from "../src/pdf-converter.js";
import pdf2md from "@opendocsg/pdf2md";

const mockedPdf2md = vi.mocked(pdf2md);

function mockPdf2mdWithMetadata(
  markdown: string,
  metadata: { info: Record<string, string>; metadata?: { get: (name: string) => string | null } | null },
): void {
  mockedPdf2md.mockImplementation(async (_buf, callbacks) => {
    callbacks?.metadataParsed?.(metadata as never);
    return markdown;
  });
}

function mockPdf2mdSimple(markdown: string): void {
  mockedPdf2md.mockImplementation(async () => markdown);
}

describe("parsePdfDate", () => {
  it("parses standard PDF date format", () => {
    expect(parsePdfDate("D:20250601120000")).toBe("2025-06-01");
  });

  it("parses date with timezone offset", () => {
    expect(parsePdfDate("D:20231215093045+09'00'")).toBe("2023-12-15");
  });

  it("parses date without time part", () => {
    expect(parsePdfDate("D:20240101")).toBe("2024-01-01");
  });

  it("returns null for non-PDF date format", () => {
    expect(parsePdfDate("2025-06-01")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePdfDate("")).toBeNull();
  });
});

describe("convertPdfToMarkdown", () => {
  it("returns markdown from pdf2md", async () => {
    mockPdf2mdSimple("# Sample\n\nHello world");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(mockedPdf2md).toHaveBeenCalledWith(dummyBuffer, expect.objectContaining({
      metadataParsed: expect.any(Function),
    }));
    expect(result.markdown).toBe("# Sample\n\nHello world");
    expect(result.metadata.title).toBe("Sample");
    expect(result.metadata.source).toBe("https://example.com/doc.pdf");
  });

  it("strips ATX closing hashes from title", async () => {
    mockPdf2mdSimple("# Sample Title ##\n\nContent");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(result.metadata.title).toBe("Sample Title");
  });

  it("uses URL filename as title when no heading found and no metadata", async () => {
    mockPdf2mdSimple("Plain text without heading");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/report.pdf");

    expect(result.metadata.title).toBe("report");
  });

  it("sets created date to today", async () => {
    mockPdf2mdSimple("# Title\n\nContent");
    const dummyBuffer = Buffer.from("dummy-pdf");
    const today = new Date().toISOString().split("T")[0];

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(result.metadata.created).toBe(today);
  });

  it("sets author to empty array and published/description to null when no metadata", async () => {
    mockPdf2mdSimple("# Title\n\nContent");
    const dummyBuffer = Buffer.from("dummy-pdf");

    const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

    expect(result.metadata.author).toEqual([]);
    expect(result.metadata.published).toBeNull();
    expect(result.metadata.description).toBeNull();
  });

  it("throws when pdf2md returns empty content", async () => {
    mockPdf2mdSimple("   ");
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

  describe("PDF metadata extraction", () => {
    it("uses info.Title over Markdown H1", async () => {
      mockPdf2mdWithMetadata("# Markdown Heading\n\nContent", {
        info: { Title: "PDF Document Title" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.title).toBe("PDF Document Title");
    });

    it("uses XMP dc:title over info.Title", async () => {
      mockPdf2mdWithMetadata("# Markdown Heading\n\nContent", {
        info: { Title: "Info Title" },
        metadata: { get: (name: string) => name === "dc:title" ? "XMP Title" : null },
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.title).toBe("XMP Title");
    });

    it("uses Markdown H1 when metadata title is empty", async () => {
      mockPdf2mdWithMetadata("# Markdown Heading\n\nContent", {
        info: { Title: "" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.title).toBe("Markdown Heading");
    });

    it("extracts author from info.Author", async () => {
      mockPdf2mdWithMetadata("# Title\n\nContent", {
        info: { Title: "Title", Author: "John Doe" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.author).toEqual(["[[John Doe]]"]);
    });

    it("sets empty author when info.Author is empty", async () => {
      mockPdf2mdWithMetadata("# Title\n\nContent", {
        info: { Title: "Title", Author: "" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.author).toEqual([]);
    });

    it("extracts published date from info.CreationDate", async () => {
      mockPdf2mdWithMetadata("# Title\n\nContent", {
        info: { Title: "Title", CreationDate: "D:20250601120000" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.published).toBe("2025-06-01");
    });

    it("sets published to null when CreationDate is invalid", async () => {
      mockPdf2mdWithMetadata("# Title\n\nContent", {
        info: { Title: "Title", CreationDate: "invalid-date" },
        metadata: null,
      });
      const dummyBuffer = Buffer.from("dummy-pdf");

      const result = await convertPdfToMarkdown(dummyBuffer, "https://example.com/doc.pdf");

      expect(result.metadata.published).toBeNull();
    });
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
