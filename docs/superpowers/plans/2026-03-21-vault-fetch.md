# vault-fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian Clipper 互換のフロントマター付き Markdown を、JS レンダリングが必要な Web ページから CLI で取得・保存できるようにする。

**Architecture:** パイプライン型。URL → Playwright 取得 → Readability 抽出 → Turndown 変換 → frontmatter 付与 → Vault 保存。各段階が独立モジュール（fetcher / extractor / converter / writer）で、CLI がオーケストレーションする。設定は 3 層解決（CLI > env > config file）。

**Tech Stack:** Node.js, TypeScript (strict), Playwright, @mozilla/readability, turndown, jsdom, commander.js, js-yaml, tsup, vitest

**Spec:** `docs/superpowers/specs/2026-03-21-vault-fetch-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | 依存・scripts・bin 定義 |
| `tsconfig.json` | TypeScript strict mode, ESM 設定 |
| `tsup.config.ts` | ESM バンドル設定 |
| `src/cli.ts` | エントリーポイント。commander で fetch / login サブコマンド定義 |
| `src/config.ts` | 3 層設定解決。YAML 読み込み、env 読み込み、CLI オプションマージ |
| `src/session.ts` | storageState の保存・読み込み（ドメイン単位） |
| `src/fetcher.ts` | Playwright でページ取得。セッション適用、waitUntil、headed/headless 切替 |
| `src/extractor.ts` | Readability.js でコンテンツ抽出 + OGP/meta からメタデータ取得 |
| `src/converter.ts` | Turndown で HTML → Markdown 変換 |
| `src/writer.ts` | frontmatter 生成、ファイル名サニタイズ、ファイル書き出し |
| `src/types.ts` | 共有型定義（FetchResult, Metadata, ResolvedConfig 等） |
| `tests/config.test.ts` | config.ts のテスト |
| `tests/extractor.test.ts` | extractor.ts のテスト |
| `tests/converter.test.ts` | converter.ts のテスト |
| `tests/writer.test.ts` | writer.ts のテスト |
| `tests/session.test.ts` | session.ts のテスト |
| `tests/fixtures/` | テスト用 HTML ファイル等 |

---

## Task 1: プロジェクト初期化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `src/types.ts`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "vault-fetch",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "vault-fetch": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ tests/",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: 依存パッケージをインストール**

```bash
npm install playwright @mozilla/readability turndown jsdom commander js-yaml
npm install -D typescript tsup vitest eslint @types/turndown @types/js-yaml @types/jsdom @types/node
npx playwright install chromium
```

- [ ] **Step 3: tsconfig.json を作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: tsup.config.ts を作成**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  dts: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

- [ ] **Step 5: src/types.ts を作成**

共有型を定義する。仕様のフロントマター構造・設定・フェッチ結果に対応する型。

```typescript
export interface Metadata {
  title: string;
  source: string;
  author: string[];
  published: string | null;
  created: string;
  description: string | null;
}

export interface FetchResult {
  html: string;          // セレクタ指定時はセレクタ HTML、それ以外は全ページ HTML
  fullHtml: string;      // 常に全ページ HTML（メタデータ抽出用）
  url: string;
  finalUrl: string;
}

export interface ExtractResult {
  content: string;
  metadata: Metadata;
}

export type WaitUntilOption = "load" | "domcontentloaded" | "networkidle";

export interface ResolvedConfig {
  dest: string;
  tags: string[];
  timeout: number;
  waitUntil: WaitUntilOption;
  headed: boolean;
  selector: string | null;
  noSession: boolean;
  dryRun: boolean;
}
```

- [ ] **Step 6: ビルドが通ることを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし（types.ts のみなので通る）

- [ ] **Step 7: コミット**

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts src/types.ts
git commit -m "feat: initialize project with TypeScript, tsup, and shared types"
```

---

## Task 2: 設定モジュール（config.ts）

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: テスト用フィクスチャ用ディレクトリを作成**

```bash
mkdir -p tests/fixtures
```

- [ ] **Step 2: config.test.ts のテストを書く**

3 層解決のテスト。CLI > env > config file > デフォルト値の優先順位、`dest` 必須バリデーション。

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveConfig } from "../src/config.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolveConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.VAULT_FETCH_DEST;
    delete process.env.VAULT_FETCH_TIMEOUT;
  });

  it("throws when dest is not specified anywhere", () => {
    expect(() => resolveConfig({}, undefined)).toThrow("dest");
  });

  it("reads dest from config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /vault/clippings\n");
    const config = resolveConfig({}, configPath);
    expect(config.dest).toBe("/vault/clippings");
  });

  it("env overrides config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /from/file\n");
    process.env.VAULT_FETCH_DEST = "/from/env";
    const config = resolveConfig({}, configPath);
    expect(config.dest).toBe("/from/env");
  });

  it("CLI overrides env", () => {
    process.env.VAULT_FETCH_DEST = "/from/env";
    const config = resolveConfig({ dest: "/from/cli" }, undefined);
    expect(config.dest).toBe("/from/cli");
  });

  it("always includes clippings tag", () => {
    const config = resolveConfig({ dest: "/vault" }, undefined);
    expect(config.tags).toContain("clippings");
  });

  it("merges custom tags with clippings", () => {
    const config = resolveConfig({ dest: "/vault", tags: ["custom"] }, undefined);
    expect(config.tags).toContain("clippings");
    expect(config.tags).toContain("custom");
  });

  it("deduplicates clippings tag", () => {
    const config = resolveConfig({ dest: "/vault", tags: ["clippings", "other"] }, undefined);
    const clippingsCount = config.tags.filter((t: string) => t === "clippings").length;
    expect(clippingsCount).toBe(1);
  });

  it("applies default timeout when not specified", () => {
    const config = resolveConfig({ dest: "/vault" }, undefined);
    expect(config.timeout).toBe(30);
  });

  it("expands tilde in dest path", () => {
    const config = resolveConfig({ dest: "~/Documents/Vault" }, undefined);
    expect(config.dest).not.toContain("~");
    expect(config.dest).toContain("Documents/Vault");
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
npx vitest run tests/config.test.ts
```

Expected: FAIL — `resolveConfig` が存在しない

- [ ] **Step 4: config.ts を実装**

```typescript
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import yaml from "js-yaml";
import type { ResolvedConfig, WaitUntilOption } from "./types.js";

const DEFAULT_TIMEOUT = 30;
const DEFAULT_WAIT_UNTIL: WaitUntilOption = "networkidle";
const REQUIRED_TAG = "clippings";

interface FileConfig {
  dest?: string;
  tags?: string[];
  timeout?: number;
  waitUntil?: WaitUntilOption;
}

interface CliOptions {
  dest?: string;
  tags?: string[];
  timeout?: number;
  waitUntil?: WaitUntilOption;
  headed?: boolean;
  selector?: string;
  noSession?: boolean;
  dryRun?: boolean;
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return resolve(homedir(), filePath.slice(2));
  }
  return filePath;
}

function loadConfigFile(configPath: string): FileConfig {
  const content = readFileSync(configPath, "utf-8");
  const parsed = yaml.load(content);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Invalid config file: ${configPath}`);
  }
  return parsed as FileConfig;
}

export function resolveConfig(
  cliOptions: CliOptions,
  configPath: string | undefined,
): ResolvedConfig {
  // Layer 1: Config file
  let fileConfig: FileConfig = {};
  if (configPath) {
    fileConfig = loadConfigFile(configPath);
  }

  // Layer 2: Environment variables
  const envDest = process.env.VAULT_FETCH_DEST;
  const envTimeout = process.env.VAULT_FETCH_TIMEOUT;

  // Resolve each field: CLI > env > file > default
  const dest = cliOptions.dest ?? envDest ?? fileConfig.dest;
  if (dest === undefined) {
    throw new Error(
      "dest is required. Set via --dest, VAULT_FETCH_DEST, or config file.",
    );
  }

  let timeout: number;
  if (cliOptions.timeout !== undefined) {
    timeout = cliOptions.timeout;
  } else if (envTimeout !== undefined) {
    const parsed = Number(envTimeout);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid VAULT_FETCH_TIMEOUT value: ${envTimeout}`);
    }
    timeout = parsed;
  } else {
    timeout = fileConfig.timeout ?? DEFAULT_TIMEOUT;
  }

  const waitUntil =
    cliOptions.waitUntil ?? fileConfig.waitUntil ?? DEFAULT_WAIT_UNTIL;

  // Merge tags: file tags + CLI tags + always clippings
  const allTags = [
    ...(fileConfig.tags ?? []),
    ...(cliOptions.tags ?? []),
    REQUIRED_TAG,
  ];
  const tags = [...new Set(allTags)];

  return {
    dest: expandTilde(dest),
    tags,
    timeout,
    waitUntil,
    headed: cliOptions.headed ?? false,
    selector: cliOptions.selector ?? null,
    noSession: cliOptions.noSession ?? false,
    dryRun: cliOptions.dryRun ?? false,
  };
}
```

- [ ] **Step 5: テストを実行して全パスを確認**

```bash
npx vitest run tests/config.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/config.ts tests/config.test.ts tests/fixtures/
git commit -m "feat: add config module with 3-layer resolution"
```

---

## Task 3: コンテンツ抽出モジュール（extractor.ts）

**Files:**
- Create: `src/extractor.ts`
- Create: `tests/extractor.test.ts`
- Create: `tests/fixtures/article.html`

- [ ] **Step 1: テスト用 HTML フィクスチャを作成**

OGP メタタグ、article:author、article:published_time、description を含む記事 HTML。

```html
<!DOCTYPE html>
<html>
<head>
  <title>テスト記事タイトル</title>
  <meta property="og:description" content="OGの説明文です">
  <meta property="article:author" content="山田太郎">
  <meta property="article:published_time" content="2025-06-14T00:00:00Z">
</head>
<body>
  <nav>ナビゲーション</nav>
  <article>
    <h1>テスト記事タイトル</h1>
    <p>これはテスト記事の本文です。十分な長さが必要なので、意味のある文章を書きます。Readability.jsは短すぎるコンテンツを記事として認識しない場合があるため、ある程度の分量が必要です。</p>
    <p>第二段落です。記事の内容をより充実させるために、複数の段落を含めます。これにより、Readability.jsが正しくコンテンツを抽出できるようになります。</p>
    <p>第三段落です。さらに内容を追加して、記事としての体裁を整えます。テスト用のフィクスチャとして十分な量のテキストが必要です。</p>
  </article>
  <aside>サイドバー</aside>
  <footer>フッター</footer>
</body>
</html>
```

- [ ] **Step 2: extractor.test.ts のテストを書く**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractContent, extractMetadata } from "../src/extractor.js";

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

describe("extractContent", () => {
  it("extracts article content via Readability", () => {
    const content = extractContent(fixtureHtml, "https://example.com/article");
    expect(content).toContain("テスト記事の本文");
  });

  it("excludes navigation and sidebar", () => {
    const content = extractContent(fixtureHtml, "https://example.com/article");
    expect(content).not.toContain("ナビゲーション");
    expect(content).not.toContain("サイドバー");
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
npx vitest run tests/extractor.test.ts
```

Expected: FAIL — `extractContent` / `extractMetadata` が存在しない

- [ ] **Step 4: extractor.ts を実装**

```typescript
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
    // Try JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    if (jsonLd?.textContent) {
      try {
        const data = JSON.parse(jsonLd.textContent) as Record<string, unknown>;
        if (typeof data.datePublished === "string") {
          return data.datePublished.split("T")[0];
        }
      } catch {
        // JSON-LD parse failed, return null
      }
    }
    return null;
  }

  return published.split("T")[0];
}

function extractAuthors(doc: Document, readabilityByline: string | null): string[] {
  // Priority: article:author > og:author > Readability byline
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

export function extractMetadata(html: string, finalUrl: string): Metadata {
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  // Use Readability for title and byline
  const readabilityDom = new JSDOM(html, { url: finalUrl });
  const reader = new Readability(readabilityDom.window.document);
  const article = reader.parse();

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

export function extractContent(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Readability failed to extract content from the page");
  }

  return article.content;
}
```

- [ ] **Step 5: テストを実行して全パスを確認**

```bash
npx vitest run tests/extractor.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/extractor.ts tests/extractor.test.ts tests/fixtures/article.html
git commit -m "feat: add extractor module with Readability and metadata extraction"
```

---

## Task 4: Markdown 変換モジュール（converter.ts）

**Files:**
- Create: `src/converter.ts`
- Create: `tests/converter.test.ts`

- [ ] **Step 1: converter.test.ts のテストを書く**

```typescript
import { describe, it, expect } from "vitest";
import { convertToMarkdown } from "../src/converter.js";

describe("convertToMarkdown", () => {
  it("converts heading to markdown", () => {
    const md = convertToMarkdown("<h1>見出し</h1>");
    expect(md).toContain("# 見出し");
  });

  it("converts paragraph to markdown", () => {
    const md = convertToMarkdown("<p>段落テキスト</p>");
    expect(md.trim()).toBe("段落テキスト");
  });

  it("converts link to markdown", () => {
    const md = convertToMarkdown('<a href="https://example.com">リンク</a>');
    expect(md).toContain("[リンク](https://example.com)");
  });

  it("converts image to markdown with remote URL", () => {
    const md = convertToMarkdown('<img src="https://example.com/img.png" alt="画像">');
    expect(md).toContain("![画像](https://example.com/img.png)");
  });

  it("converts list to markdown", () => {
    const md = convertToMarkdown("<ul><li>項目1</li><li>項目2</li></ul>");
    expect(md).toContain("項目1");
    expect(md).toContain("項目2");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/converter.test.ts
```

Expected: FAIL

- [ ] **Step 3: converter.ts を実装**

```typescript
import TurndownService from "turndown";

export function convertToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  return turndown.turndown(html);
}
```

- [ ] **Step 4: テストを実行して全パスを確認**

```bash
npx vitest run tests/converter.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/converter.ts tests/converter.test.ts
git commit -m "feat: add converter module with Turndown"
```

---

## Task 5: ファイル書き出しモジュール（writer.ts）

**Files:**
- Create: `src/writer.ts`
- Create: `tests/writer.test.ts`

- [ ] **Step 1: writer.test.ts のテストを書く**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sanitizeFilename, buildFrontmatter, writeMarkdownFile } from "../src/writer.js";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Metadata } from "../src/types.js";

describe("sanitizeFilename", () => {
  it("removes filesystem-unsafe characters and normalizes spaces", () => {
    expect(sanitizeFilename('File: "test" <name>')).toBe("File test name.md");
  });

  it("truncates to 200 characters", () => {
    const long = "あ".repeat(250);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });

  it("appends .md extension", () => {
    expect(sanitizeFilename("Title")).toBe("Title.md");
  });

  it("preserves Japanese characters", () => {
    expect(sanitizeFilename("日本語タイトル")).toBe("日本語タイトル.md");
  });

  it("preserves fullwidth characters like ｜", () => {
    expect(sanitizeFilename("タイトル｜著者")).toBe("タイトル｜著者.md");
  });
});

describe("buildFrontmatter", () => {
  const metadata: Metadata = {
    title: "テスト記事",
    source: "https://example.com",
    author: ["[[山田太郎]]"],
    published: "2025-06-14",
    created: "2025-07-03",
    description: "説明文",
  };

  it("generates valid YAML frontmatter", () => {
    const fm = buildFrontmatter(metadata, ["clippings"]);
    expect(fm).toMatch(/^---\n/);
    expect(fm).toMatch(/\n---$/);
  });

  it("includes all metadata fields", () => {
    const fm = buildFrontmatter(metadata, ["clippings"]);
    expect(fm).toContain("title:");
    expect(fm).toContain("テスト記事");
    expect(fm).toContain("source:");
    expect(fm).toContain("https://example.com");
    expect(fm).toContain("[[山田太郎]]");
    expect(fm).toContain("2025-06-14");
    expect(fm).toContain("2025-07-03");
    expect(fm).toContain("clippings");
  });

  it("includes custom tags", () => {
    const fm = buildFrontmatter(metadata, ["clippings", "tech"]);
    expect(fm).toContain("tech");
  });

  it("safely escapes quotes in title and description", () => {
    const metaWithQuotes: Metadata = {
      ...metadata,
      title: '記事の"要約"について',
      description: 'He said "hello"',
    };
    const fm = buildFrontmatter(metaWithQuotes, ["clippings"]);
    // Should produce valid YAML (no syntax error)
    expect(fm).toContain("---");
    expect(fm).toContain('記事の"要約"について');
  });
});

describe("writeMarkdownFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-writer-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes frontmatter + content to file", () => {
    const metadata: Metadata = {
      title: "テスト",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    const filePath = writeMarkdownFile(tmpDir, metadata, "# Content", ["clippings"]);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("# Content");
  });

  it("overwrites existing file", () => {
    const metadata: Metadata = {
      title: "Same",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    writeMarkdownFile(tmpDir, metadata, "First", ["clippings"]);
    writeMarkdownFile(tmpDir, metadata, "Second", ["clippings"]);
    const filePath = join(tmpDir, "Same.md");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("Second");
    expect(content).not.toContain("First");
  });

  it("throws when dest directory does not exist", () => {
    const metadata: Metadata = {
      title: "Test",
      source: "https://example.com",
      author: [],
      published: null,
      created: "2025-07-03",
      description: null,
    };
    expect(() =>
      writeMarkdownFile("/nonexistent/path", metadata, "content", ["clippings"]),
    ).toThrow();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/writer.test.ts
```

Expected: FAIL

- [ ] **Step 3: writer.ts を実装**

```typescript
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Metadata } from "./types.js";

const UNSAFE_CHARS = /[/\\:*?"<>|]/g;
const MAX_FILENAME_LENGTH = 200;

export function sanitizeFilename(title: string): string {
  const sanitized = title
    .replace(UNSAFE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  const truncated =
    sanitized.length > MAX_FILENAME_LENGTH
      ? sanitized.slice(0, MAX_FILENAME_LENGTH)
      : sanitized;
  return `${truncated}.md`;
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
```

- [ ] **Step 4: テストを実行して全パスを確認**

```bash
npx vitest run tests/writer.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/writer.ts tests/writer.test.ts
git commit -m "feat: add writer module with frontmatter generation and file output"
```

---

## Task 6: セッション管理モジュール（session.ts）

**Files:**
- Create: `src/session.ts`
- Create: `tests/session.test.ts`

- [ ] **Step 1: session.test.ts のテストを書く**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSessionPath,
  sessionExists,
  getSessionDir,
} from "../src/session.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("getSessionPath", () => {
  it("extracts domain from URL for session path", () => {
    const path = getSessionPath("https://note.com/article/123", "/sessions");
    expect(path).toBe("/sessions/note.com.json");
  });

  it("handles subdomain URLs", () => {
    const path = getSessionPath("https://sub.example.com/page", "/sessions");
    expect(path).toBe("/sessions/sub.example.com.json");
  });
});

describe("sessionExists", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-session-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when no session file exists", () => {
    expect(sessionExists("https://example.com", tmpDir)).toBe(false);
  });

  it("returns true when session file exists", () => {
    writeFileSync(join(tmpDir, "example.com.json"), "{}");
    expect(sessionExists("https://example.com", tmpDir)).toBe(true);
  });
});

describe("getSessionDir", () => {
  it("returns path under ~/.config/vault-fetch/sessions", () => {
    const dir = getSessionDir();
    expect(dir).toContain("vault-fetch");
    expect(dir).toContain("sessions");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/session.test.ts
```

Expected: FAIL

- [ ] **Step 3: session.ts を実装**

```typescript
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "vault-fetch");
const SESSIONS_DIR = join(CONFIG_DIR, "sessions");

export function getSessionDir(): string {
  return SESSIONS_DIR;
}

function extractDomain(url: string): string {
  const parsed = new URL(url);
  return parsed.hostname;
}

export function getSessionPath(url: string, sessionsDir: string): string {
  const domain = extractDomain(url);
  return join(sessionsDir, `${domain}.json`);
}

export function sessionExists(url: string, sessionsDir: string): boolean {
  const sessionPath = getSessionPath(url, sessionsDir);
  return existsSync(sessionPath);
}

export function ensureSessionDir(sessionsDir: string): void {
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
}
```

- [ ] **Step 4: テストを実行して全パスを確認**

```bash
npx vitest run tests/session.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/session.ts tests/session.test.ts
git commit -m "feat: add session module for storageState management"
```

---

## Task 7: ページ取得モジュール（fetcher.ts）

**Files:**
- Create: `src/fetcher.ts`

`fetcher.ts` は Playwright を起動してブラウザ操作を行うため、ユニットテストではなく統合テスト（実ネットワーク）が必要。ここではモジュール作成のみ行い、E2E テストは Task 9 で実施する。

- [ ] **Step 1: fetcher.ts を実装**

```typescript
import { chromium, type BrowserContext } from "playwright";
import type { FetchResult, ResolvedConfig } from "./types.js";
import { getSessionPath, sessionExists } from "./session.js";

export async function fetchPage(
  url: string,
  config: ResolvedConfig,
  sessionsDir: string,
): Promise<FetchResult> {
  const browser = await chromium.launch({
    headless: !config.headed,
  });

  try {
    const contextOptions: Parameters<typeof browser.newContext>[0] = {};

    // Load session if available and not disabled
    if (!config.noSession && sessionExists(url, sessionsDir)) {
      const sessionPath = getSessionPath(url, sessionsDir);
      contextOptions.storageState = sessionPath;
    }

    const context: BrowserContext = await browser.newContext(contextOptions);
    const page = await context.newPage();

    const timeoutMs = config.timeout * 1000;
    const response = await page.goto(url, {
      waitUntil: config.waitUntil,
      timeout: timeoutMs,
    });

    if (!response) {
      throw new Error(`No response received from ${url}`);
    }

    const finalUrl = response.url();
    const fullHtml = await page.content();
    let html: string;

    if (config.selector) {
      const element = await page.$(config.selector);
      if (!element) {
        throw new Error(`Selector not found: ${config.selector}`);
      }
      html = await element.innerHTML();
    } else {
      html = fullHtml;
    }

    await context.close();

    return { html, fullHtml, url, finalUrl };
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/fetcher.ts
git commit -m "feat: add fetcher module with Playwright page retrieval"
```

---

## Task 8: CLI エントリーポイント（cli.ts）

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: cli.ts を実装**

```typescript
import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "./config.js";
import { fetchPage } from "./fetcher.js";
import { extractContent, extractMetadata } from "./extractor.js";
import { convertToMarkdown } from "./converter.js";
import { writeMarkdownFile, buildFrontmatter, sanitizeFilename } from "./writer.js";
import {
  getSessionDir,
  getSessionPath,
  ensureSessionDir,
} from "./session.js";
import type { WaitUntilOption } from "./types.js";

const CONFIG_PATH = join(homedir(), ".config", "vault-fetch", "config.yaml");

const program = new Command();

program
  .name("vault-fetch")
  .description(
    "Fetch JS-rendered web pages and save as Markdown to Obsidian Vault",
  )
  .version("0.1.0");

program
  .command("fetch")
  .description("Fetch a page and save as Markdown")
  .argument("<url>", "URL to fetch")
  .option("--dest <path>", "Destination directory")
  .option("--headed", "Run browser in headed mode")
  .option("--selector <css>", "CSS selector to extract")
  .option("--timeout <seconds>", "Timeout in seconds", parseInt)
  .option("--tag <name>", "Add tag (repeatable)", (val: string, acc: string[]) => {
    acc.push(val);
    return acc;
  }, [] as string[])
  .option(
    "--wait-until <event>",
    "Wait condition: load, domcontentloaded, networkidle",
  )
  .option("--skip-session", "Do not use saved session")
  .option("--dry-run", "Output to stdout instead of saving")
  .action(async (url: string, options: Record<string, unknown>) => {
    try {
      const configPath = existsSync(CONFIG_PATH) ? CONFIG_PATH : undefined;
      const config = resolveConfig(
        {
          dest: options.dest as string | undefined,
          tags: options.tag as string[] | undefined,
          timeout: options.timeout as number | undefined,
          waitUntil: options.waitUntil as WaitUntilOption | undefined,
          headed: options.headed as boolean | undefined,
          selector: options.selector as string | undefined,
          noSession: options.skipSession as boolean | undefined,
          dryRun: options.dryRun as boolean | undefined,
        },
        configPath,
      );

      // Validate dest directory exists
      if (!config.dryRun && !existsSync(config.dest)) {
        throw new Error(`Destination directory does not exist: ${config.dest}`);
      }

      const sessionsDir = getSessionDir();
      const fetchResult = await fetchPage(url, config, sessionsDir);

      let contentHtml: string;
      let metadata;

      if (config.selector) {
        // --selector mode: skip Readability, extract metadata from full page
        contentHtml = fetchResult.html;
        metadata = extractMetadata(fetchResult.fullHtml, fetchResult.finalUrl);
      } else {
        metadata = extractMetadata(fetchResult.html, fetchResult.finalUrl);
        contentHtml = extractContent(fetchResult.html, fetchResult.finalUrl);
      }

      const markdown = convertToMarkdown(contentHtml);

      if (config.dryRun) {
        const frontmatter = buildFrontmatter(metadata, config.tags);
        process.stdout.write(`${frontmatter}\n\n${markdown}\n`);
      } else {
        const filePath = writeMarkdownFile(
          config.dest,
          metadata,
          markdown,
          config.tags,
        );
        console.error(`Saved: ${filePath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command("login")
  .description("Login to a site and save session")
  .argument("<url>", "URL to login")
  .option("--timeout <seconds>", "Login timeout in seconds", parseInt)
  .action(async (url: string, options: Record<string, unknown>) => {
    try {
      const { chromium } = await import("playwright");
      const sessionsDir = getSessionDir();
      ensureSessionDir(sessionsDir);

      const timeoutSec = (options.timeout as number | undefined) ?? 300;
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutSec * 1000 });

      console.error("Browser opened. Log in manually, then press Enter here to save session.");

      // Wait for Enter key
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });

      const sessionPath = getSessionPath(url, sessionsDir);
      await context.storageState({ path: sessionPath });
      console.error(`Session saved: ${sessionPath}`);

      await browser.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 2: ビルドしてバイナリを確認**

```bash
npx tsup
ls dist/cli.js
```

Expected: `dist/cli.js` が生成される

- [ ] **Step 3: --help が動くことを確認**

```bash
node dist/cli.js --help
node dist/cli.js fetch --help
node dist/cli.js login --help
```

Expected: 各コマンドのヘルプが表示される

- [ ] **Step 4: コミット**

```bash
git add src/cli.ts
git commit -m "feat: add CLI with fetch and login subcommands"
```

---

## Task 9: E2E テスト

**Files:**
- Create: `tests/e2e.test.ts`

実際のネットワークアクセスを伴う統合テスト。`--dry-run` モードで実行し、Obsidian Clipper 互換の出力を検証。

- [ ] **Step 1: e2e.test.ts を書く**

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("E2E: vault-fetch fetch --dry-run", () => {
  it("fetches a page and outputs Markdown with frontmatter", () => {
    const output = execSync(
      "node dist/cli.js fetch https://example.com --dry-run --dest /tmp",
      { encoding: "utf-8", timeout: 60_000 },
    );

    // Frontmatter structure
    expect(output).toMatch(/^---\n/);
    expect(output).toContain("title:");
    expect(output).toContain("source: \"https://example.com");
    expect(output).toContain("created:");
    expect(output).toContain("tags:");
    expect(output).toContain("clippings");

    // Markdown content
    expect(output).toContain("Example Domain");
  });
});
```

- [ ] **Step 2: ビルドしてからテスト実行**

```bash
npx tsup && npx vitest run tests/e2e.test.ts --timeout 60000
```

Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add tests/e2e.test.ts
git commit -m "test: add E2E test with dry-run mode"
```

---

## Task 10: 最終確認

- [ ] **Step 1: 全テスト実行**

```bash
npx vitest run
```

Expected: 全テスト PASS

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: ビルド**

```bash
npx tsup
```

Expected: `dist/cli.js` 生成

- [ ] **Step 4: 実際のサイトで手動テスト**

```bash
node dist/cli.js fetch https://note.com/simplearchitect/n/n8389e1b4fbde --dry-run --dest /tmp
```

Expected: Obsidian Clipper と同等のフロントマター + Markdown が stdout に出力される

- [ ] **Step 5: 最終コミット（package.json の version 等調整があれば）**

```bash
git add package.json src/ tests/ && git commit -m "chore: finalize v0.1.0"
```
