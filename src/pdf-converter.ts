import pdf2md from "@opendocsg/pdf2md";
import type { Metadata } from "./types.js";

export interface PdfConvertResult {
  markdown: string;
  metadata: Metadata;
}

export async function convertPdfToMarkdown(
  pdfBuffer: Buffer,
  sourceUrl: string,
): Promise<PdfConvertResult> {
  const markdown = await pdf2md(pdfBuffer);
  if (!markdown.trim()) {
    throw new Error("pdf2md returned empty content from the PDF");
  }
  const title = extractTitleFromMarkdown(markdown) ?? extractTitleFromUrl(sourceUrl);
  const today = new Date().toISOString().split("T")[0];

  return {
    markdown,
    metadata: {
      title,
      source: sourceUrl,
      author: [],
      published: null,
      created: today,
      description: null,
    },
  };
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) return null;
  const trimmed = match[1].trim();
  return trimmed || null;
}

export function extractTitleFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment) {
    throw new Error(`Cannot extract filename from URL: ${url}`);
  }
  return decodeURIComponent(lastSegment.replace(/\.pdf$/i, ""));
}
