import { describe, it, expect } from "vitest";
import { buildBlockedResourceTypes, isPdfContentType, validatePdfBuffer } from "../src/fetcher.js";

describe("buildBlockedResourceTypes", () => {
  it("includes all resource types when all blocking enabled", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: true,
      blockMedia: true,
    });
    expect(blocked).toEqual(new Set(["image", "font", "media"]));
  });

  it("excludes image when blockImages is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: false,
      blockFonts: true,
      blockMedia: true,
    });
    expect(blocked.has("image")).toBe(false);
    expect(blocked.has("font")).toBe(true);
    expect(blocked.has("media")).toBe(true);
  });

  it("excludes font when blockFonts is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: false,
      blockMedia: true,
    });
    expect(blocked.has("image")).toBe(true);
    expect(blocked.has("font")).toBe(false);
    expect(blocked.has("media")).toBe(true);
  });

  it("excludes media when blockMedia is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: true,
      blockMedia: false,
    });
    expect(blocked.has("image")).toBe(true);
    expect(blocked.has("font")).toBe(true);
    expect(blocked.has("media")).toBe(false);
  });

  it("returns empty set when all blocking disabled", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: false,
      blockFonts: false,
      blockMedia: false,
    });
    expect(blocked.size).toBe(0);
  });
});

describe("isPdfContentType", () => {
  it("returns true for application/pdf", () => {
    expect(isPdfContentType("application/pdf")).toBe(true);
  });

  it("returns true for application/pdf with charset", () => {
    expect(isPdfContentType("application/pdf; charset=utf-8")).toBe(true);
  });

  it("returns true regardless of case", () => {
    expect(isPdfContentType("Application/PDF")).toBe(true);
  });

  it("returns false for text/html", () => {
    expect(isPdfContentType("text/html")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPdfContentType("")).toBe(false);
  });
});

describe("validatePdfBuffer", () => {
  it("accepts valid PDF buffer", () => {
    const validPdf = Buffer.from("%PDF-1.4 fake content");
    expect(() => validatePdfBuffer(validPdf, "https://example.com/doc.pdf")).not.toThrow();
  });

  it("throws for empty buffer", () => {
    const empty = Buffer.alloc(0);
    expect(() => validatePdfBuffer(empty, "https://example.com/doc.pdf")).toThrow(
      "Empty PDF response received from https://example.com/doc.pdf",
    );
  });

  it("throws for non-PDF data", () => {
    const html = Buffer.from("<html><body>Not a PDF</body></html>");
    expect(() => validatePdfBuffer(html, "https://example.com/doc.pdf")).toThrow(
      "body is not valid PDF data",
    );
  });

  it("throws for PDF viewer HTML (Chromium inline PDF case)", () => {
    const viewerHtml = Buffer.from('<!DOCTYPE html><html><body><embed type="application/pdf"');
    expect(() => validatePdfBuffer(viewerHtml, "https://example.com/doc.pdf")).toThrow(
      "body is not valid PDF data",
    );
  });
});

