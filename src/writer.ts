import { writeFileSync } from "node:fs";
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

export function buildFrontmatter(metadata: Metadata, tags: string[]): string {
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

  const yamlStr = yaml.dump(data, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: -1,
    sortKeys: false,
  });

  return `---\n${yamlStr}---`;
}

export function writeMarkdownFile(
  dest: string,
  metadata: Metadata,
  markdownContent: string,
  tags: string[],
): string {
  const filename = sanitizeFilename(metadata.title);
  const filePath = join(dest, filename);
  const frontmatter = buildFrontmatter(metadata, tags);
  const fullContent = `${frontmatter}\n\n${markdownContent}\n`;

  writeFileSync(filePath, fullContent, "utf-8");

  return filePath;
}
