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

    const status = response.status();
    if (status >= 400) {
      throw new Error(`HTTP ${status} received from ${response.url()}`);
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
