import pdf2md from "@opendocsg/pdf2md";
import type { Metadata } from "./types.js";

export interface PdfConvertResult {
  markdown: string;
  metadata: Metadata;
}

interface PdfMetadataInfo {
  Title?: string;
  Author?: string;
  Creator?: string;
  CreationDate?: string;
}

interface PdfRawMetadata {
  info: PdfMetadataInfo;
  metadata: { get: (name: string) => string | null } | null;
}

const PDF_DATE_PATTERN = /^D:(\d{4})(\d{2})(\d{2})/;

export function parsePdfDate(dateStr: string): string | null {
  const match = dateStr.match(PDF_DATE_PATTERN);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

const AUTHOR_SEPARATOR = /\s*(?:;|\s+and\s+|&)\s*/;

function formatAuthor(raw: string): string {
  const sanitized = raw.trim().replace(/[[\]]/g, "");
  return `[[${sanitized}]]`;
}

function parseAuthors(raw: string): string[] {
  return raw
    .split(AUTHOR_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(formatAuthor);
}

export async function convertPdfToMarkdown(
  pdfBuffer: Buffer,
  sourceUrl: string,
): Promise<PdfConvertResult> {
  // TypeScript narrows this to `null` without the assertion because
  // it cannot see that metadataParsed is called synchronously inside pdf2md.
  let pdfMeta = null as PdfRawMetadata | null;

  const markdown = await pdf2md(pdfBuffer, {
    metadataParsed: (metadata) => {
      pdfMeta = metadata as PdfRawMetadata;
    },
  });

  if (!markdown.trim()) {
    throw new Error("pdf2md returned empty content from the PDF");
  }

  // Title priority: XMP dc:title > info.Title > Markdown H1 > URL segment
  const xmpTitle = pdfMeta?.metadata?.get("dc:title");
  const infoTitle = pdfMeta?.info.Title;
  const title =
    (xmpTitle && xmpTitle.trim() ? xmpTitle.trim() : null) ??
    (infoTitle && infoTitle.trim() ? infoTitle.trim() : null) ??
    extractTitleFromMarkdown(markdown) ??
    extractTitleFromUrl(sourceUrl);

  // Author
  const rawAuthor = pdfMeta?.info.Author;
  const author = rawAuthor && rawAuthor.trim() ? parseAuthors(rawAuthor) : [];

  // Published
  const rawDate = pdfMeta?.info.CreationDate;
  const published = rawDate ? parsePdfDate(rawDate) : null;

  const today = new Date().toISOString().split("T")[0];

  return {
    markdown,
    metadata: {
      title,
      source: sourceUrl,
      author,
      published,
      created: today,
      description: null,
    },
  };
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+?)(?:\s+#+)?$/m);
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
