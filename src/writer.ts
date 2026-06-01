import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Metadata } from "./types.js";

const UNSAFE_CHARS = /[/\\:*?"<>|]/g;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const MAX_FILENAME_LENGTH = 200;

export function sanitizeFilename(title: string): string {
  const sanitized = title
    .replace(CONTROL_CHARS, "")
    .replace(UNSAFE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  const base = sanitized.slice(0, MAX_FILENAME_LENGTH) || "Untitled";
  return `${base}.md`;
}

export function buildFrontmatter(
  metadata: Metadata,
  tags: string[],
  fields: Record<string, unknown> = {},
): string {
  // Fixed-schema keys: these MUST stay in sync with RESERVED_FRONTMATTER_KEYS in src/types.ts
  // (title, source, author, published, created, description, tags)
  const data: Record<string, unknown> = {
    title: metadata.title,
    source: metadata.source,
  };

  if (metadata.author.length > 0) {
    data.author = metadata.author;
  }

  if (metadata.published) {
    data.published = metadata.published;
  }

  data.created = metadata.created;

  if (metadata.description) {
    data.description = metadata.description;
  }

  data.tags = tags;

  for (const [key, value] of Object.entries(fields)) {
    data[key] = value;
  }

  const yamlStr = yaml.dump(data, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: -1,
    sortKeys: false,
  });

  return `---\n${yamlStr}---`;
}

function readSource(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, "utf-8");
  if (!content.startsWith("---\n")) {
    return null;
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return null;
  }
  const frontmatter = content.slice(4, end);
  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatter);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") {
    return null;
  }
  const source = (parsed as Record<string, unknown>).source;
  return typeof source === "string" ? source : null;
}

function resolveTargetPath(
  dest: string,
  baseFilename: string,
  source: string,
): string {
  const ext = ".md";
  const base = baseFilename.endsWith(ext)
    ? baseFilename.slice(0, -ext.length)
    : baseFilename;

  let candidate = join(dest, `${base}${ext}`);
  if (!existsSync(candidate)) {
    return candidate;
  }
  if (readSource(candidate) === source) {
    return candidate; // 同一ソース: 上書き
  }
  let n = 2;
  for (;;) {
    candidate = join(dest, `${base}-${n}${ext}`);
    if (!existsSync(candidate) || readSource(candidate) === source) {
      return candidate;
    }
    n += 1;
  }
}

export function writeMarkdownFile(
  dest: string,
  metadata: Metadata,
  markdownContent: string,
  tags: string[],
  fields: Record<string, unknown> = {},
): string {
  const filename = sanitizeFilename(metadata.title);
  const filePath = resolveTargetPath(dest, filename, metadata.source);
  const frontmatter = buildFrontmatter(metadata, tags, fields);
  const fullContent = `${frontmatter}\n\n${markdownContent}\n`;

  writeFileSync(filePath, fullContent, "utf-8");

  return filePath;
}
