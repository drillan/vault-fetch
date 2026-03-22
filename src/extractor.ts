import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { Metadata } from "./types.js";

function getMetaContent(doc: Document, selector: string): string | null {
  const el = doc.querySelector(selector);
  return el?.getAttribute("content") ?? null;
}

function formatAuthor(raw: string): string {
  return `[[${raw.trim()}]]`;
}

function extractPublishedDate(doc: Document): string | null {
  const published =
    getMetaContent(doc, 'meta[property="article:published_time"]') ??
    getMetaContent(doc, 'meta[name="datePublished"]');

  if (!published) {
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    if (jsonLd?.textContent) {
      try {
        const data = JSON.parse(jsonLd.textContent) as Record<string, unknown>;
        if (typeof data.datePublished === "string") {
          return data.datePublished.split("T")[0];
        }
      } catch {
        // JSON-LD parse failed
      }
    }
    return null;
  }

  return published.split("T")[0];
}

function extractAuthors(
  doc: Document,
  readabilityByline: string | null,
): string[] {
  const articleAuthors = doc.querySelectorAll('meta[property="article:author"]');
  if (articleAuthors.length > 0) {
    return Array.from(articleAuthors)
      .map((el) => el.getAttribute("content"))
      .filter((v): v is string => v !== null)
      .map(formatAuthor);
  }

  const ogAuthor = getMetaContent(doc, 'meta[property="og:author"]');
  if (ogAuthor) {
    return [formatAuthor(ogAuthor)];
  }

  if (readabilityByline) {
    return [formatAuthor(readabilityByline)];
  }

  return [];
}

export interface ExtractResult {
  metadata: Metadata;
  content: string;
}

interface ReadabilityArticle {
  title: string;
  byline: string | null;
  excerpt: string;
  content: string;
}

function buildMetadata(
  doc: Document,
  article: ReadabilityArticle | null,
  finalUrl: string,
): Metadata {
  const title = article?.title ?? doc.title;
  const authors = extractAuthors(doc, article?.byline ?? null);
  const published = extractPublishedDate(doc);

  const description =
    getMetaContent(doc, 'meta[property="og:description"]') ??
    getMetaContent(doc, 'meta[name="description"]') ??
    (article?.excerpt ?? null);

  const today = new Date().toISOString().split("T")[0];

  return {
    title,
    source: finalUrl,
    author: authors,
    published,
    created: today,
    description,
  };
}

function parseWithReadability(html: string, url: string): ReadabilityArticle | null {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  return reader.parse() as ReadabilityArticle | null;
}

export function extract(html: string, finalUrl: string): ExtractResult {
  const metaDom = new JSDOM(html, { url: finalUrl });
  const doc = metaDom.window.document;

  const article = parseWithReadability(html, finalUrl);

  if (!article) {
    throw new Error(
      "Readability failed to extract content from the page. " +
        "Try --raw to convert the full page, or --selector <css> to target specific content.",
    );
  }

  if (!article.content) {
    throw new Error("Readability returned empty content for the page");
  }

  return {
    metadata: buildMetadata(doc, article, finalUrl),
    content: article.content,
  };
}

export function extractMetadata(html: string, finalUrl: string): Metadata {
  const metaDom = new JSDOM(html, { url: finalUrl });
  const doc = metaDom.window.document;

  const article = parseWithReadability(html, finalUrl);

  return buildMetadata(doc, article, finalUrl);
}
