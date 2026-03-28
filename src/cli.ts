import { Command } from "commander";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveConfig, resolveProxy } from "./config.js";
import { fetchPage } from "./fetcher.js";
import { extract, extractMetadata } from "./extractor.js";
import { convertToMarkdown } from "./converter.js";
import { writeMarkdownFile, buildFrontmatter } from "./writer.js";
import {
  getSessionDir,
  getSessionPath,
  ensureSessionDir,
} from "./session.js";
import type { Metadata, WaitUntilOption } from "./types.js";

const CONFIG_PATH = join(homedir(), ".config", "vault-fetch", "config.yaml");

const program = new Command();

program
  .name("vault-fetch")
  .description(
    "Fetch JS-rendered web pages and save as Markdown to Obsidian Vault",
  )
  .version("0.4.0");

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
  .option("--no-block-images", "Do not block image requests")
  .option("--no-block-fonts", "Do not block font requests")
  .option("--no-block-media", "Do not block media requests")
  .option("--raw", "Convert full page HTML without Readability extraction")
  .option("--title <text>", "Override the page title for the output filename")
  .option("--proxy <url>", "HTTP/HTTPS proxy URL (e.g. http://host:port)")
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
          title: options.title as string | undefined,
          noSession: options.skipSession as boolean | undefined,
          dryRun: options.dryRun as boolean | undefined,
          blockImages: options.blockImages as boolean | undefined,
          blockFonts: options.blockFonts as boolean | undefined,
          blockMedia: options.blockMedia as boolean | undefined,
          raw: options.raw as boolean | undefined,
          proxy: options.proxy as string | undefined,
        },
        configPath,
      );

      if (config.raw && config.selector) {
        throw new Error("--raw and --selector cannot be used together.");
      }

      // Validate dest directory exists
      if (!config.dryRun && !existsSync(config.dest)) {
        throw new Error(`Destination directory does not exist: ${config.dest}`);
      }

      const sessionsDir = getSessionDir();
      const fetchResult = await fetchPage(url, config, sessionsDir);

      let markdown: string;
      let metadata: Metadata;

      if (fetchResult.kind === "pdf") {
        if (config.selector) {
          throw new Error("--selector cannot be used with PDF URLs.");
        }
        if (config.raw) {
          throw new Error("--raw cannot be used with PDF URLs.");
        }
        const { convertPdfToMarkdown } = await import("./pdf-converter.js");
        const pdfResult = await convertPdfToMarkdown(
          fetchResult.pdfBuffer,
          fetchResult.finalUrl,
        );
        markdown = pdfResult.markdown;
        metadata = pdfResult.metadata;
      } else if (config.selector) {
        // --selector mode: skip Readability, extract metadata from full page
        metadata = extractMetadata(fetchResult.fullHtml, fetchResult.finalUrl);
        markdown = convertToMarkdown(fetchResult.html);
      } else if (config.raw) {
        // --raw mode: skip Readability, convert full page HTML directly
        metadata = extractMetadata(fetchResult.fullHtml, fetchResult.finalUrl);
        markdown = convertToMarkdown(fetchResult.fullHtml);
      } else {
        const result = extract(fetchResult.html, fetchResult.finalUrl);
        metadata = result.metadata;
        markdown = convertToMarkdown(result.content);
      }

      if (config.title !== null) {
        metadata = { ...metadata, title: config.title };
      }

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
  .option("--proxy <url>", "HTTP/HTTPS proxy URL (e.g. http://host:port)")
  .action(async (url: string, options: Record<string, unknown>) => {
    const { launch } = await import("cloakbrowser");
    const sessionsDir = getSessionDir();
    ensureSessionDir(sessionsDir);

    const timeoutSec = (options.timeout as number | undefined) ?? 300;
    const proxyUrl = resolveProxy(
      options.proxy as string | undefined,
      process.env.VAULT_FETCH_PROXY,
    );
    const browser = await launch({
      headless: false,
      ...(proxyUrl !== null && { proxy: proxyUrl }),
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutSec * 1000 });

      console.error("Browser opened. Log in manually, then press Enter here to save session.");

      process.stdin.resume();
      await once(process.stdin, "data");
      process.stdin.pause();
      process.stdin.unref();

      const sessionPath = getSessionPath(url, sessionsDir);
      await context.storageState({ path: sessionPath });
      console.error(`Session saved: ${sessionPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    } finally {
      await browser.close();
    }
  });

program.parse();
