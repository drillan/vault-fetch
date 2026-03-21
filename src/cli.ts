import { Command } from "commander";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "./config.js";
import { fetchPage } from "./fetcher.js";
import { extract, extractMetadata } from "./extractor.js";
import { convertToMarkdown } from "./converter.js";
import { writeMarkdownFile, buildFrontmatter } from "./writer.js";
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
        const result = extract(fetchResult.html, fetchResult.finalUrl);
        metadata = result.metadata;
        contentHtml = result.content;
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
    const { chromium } = await import("playwright");
    const sessionsDir = getSessionDir();
    ensureSessionDir(sessionsDir);

    const timeoutSec = (options.timeout as number | undefined) ?? 300;
    const browser = await chromium.launch({ headless: false });

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
