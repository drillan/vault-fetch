import { launch } from "cloakbrowser";
import type { BrowserContext } from "playwright-core";
import type { FetchResult, ResolvedConfig } from "./types.js";
import { getSessionPath, sessionExists } from "./session.js";

interface BlockingOptions {
  blockImages: boolean;
  blockFonts: boolean;
  blockMedia: boolean;
}

export function isPdfContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("application/pdf");
}

export function buildBlockedResourceTypes(options: BlockingOptions): Set<string> {
  const blocked = new Set<string>();
  if (options.blockImages) blocked.add("image");
  if (options.blockFonts) blocked.add("font");
  if (options.blockMedia) blocked.add("media");
  return blocked;
}

const PDF_MAGIC_BYTES = "%PDF";

export function validatePdfBuffer(pdfBuffer: Buffer, sourceUrl: string): void {
  if (pdfBuffer.length === 0) {
    throw new Error(`Empty PDF response received from ${sourceUrl}`);
  }
  const header = pdfBuffer.subarray(0, PDF_MAGIC_BYTES.length).toString("ascii");
  if (!header.startsWith(PDF_MAGIC_BYTES)) {
    throw new Error(
      `Response Content-Type is application/pdf but body is not valid PDF data from ${sourceUrl}`,
    );
  }
}

async function downloadPdf(
  context: BrowserContext,
  url: string,
  timeoutMs: number,
): Promise<{ pdfBuffer: Buffer; finalUrl: string }> {
  const apiResponse = await context.request.get(url, { timeout: timeoutMs });
  const status = apiResponse.status();
  if (status >= 400) {
    throw new Error(`HTTP ${status} received when downloading PDF from ${url}`);
  }
  const pdfBuffer = Buffer.from(await apiResponse.body());
  const finalUrl = apiResponse.url();
  validatePdfBuffer(pdfBuffer, finalUrl);
  return { pdfBuffer, finalUrl };
}

export async function fetchPage(
  url: string,
  config: ResolvedConfig,
  sessionsDir: string,
): Promise<FetchResult> {
  const browser = await launch({
    headless: !config.headed,
    ...(config.proxy !== null && { proxy: config.proxy }),
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

    // Block specified resource types for faster loading
    const blockedTypes = buildBlockedResourceTypes(config);
    if (blockedTypes.size > 0) {
      await page.route("**/*", async (route) => {
        if (blockedTypes.has(route.request().resourceType())) {
          await route.abort();
        } else {
          await route.continue();
        }
      });
    }

    const timeoutMs = config.timeout * 1000;

    // page.goto throws "Download is starting" when the server returns
    // Content-Disposition: attachment (common for PDF downloads).
    // Catch this and download the PDF via the context's HTTP client.
    let response;
    try {
      response = await page.goto(url, {
        waitUntil: config.waitUntil,
        timeout: timeoutMs,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Download is starting")
      ) {
        const result = await downloadPdf(context, url, timeoutMs);
        await context.close();
        return { kind: "pdf", pdfBuffer: result.pdfBuffer, url, finalUrl: result.finalUrl };
      }
      throw error;
    }

    if (!response) {
      throw new Error(`No response received from ${url}`);
    }

    const status = response.status();
    if (status >= 400) {
      throw new Error(`HTTP ${status} received from ${response.url()}`);
    }

    const finalUrl = response.url();
    const contentType = response.headers()["content-type"] ?? "";

    // Inline PDF (Content-Disposition: inline or absent).
    // Try response.body() first; fall back to context.request if the
    // browser returned its PDF viewer HTML instead of the actual bytes.
    if (isPdfContentType(contentType)) {
      const body = await response.body();
      try {
        validatePdfBuffer(body, finalUrl);
        await context.close();
        return { kind: "pdf", pdfBuffer: body, url, finalUrl };
      } catch {
        // response.body() returned PDF viewer HTML; re-download via API
        const result = await downloadPdf(context, finalUrl, timeoutMs);
        await context.close();
        return { kind: "pdf", pdfBuffer: result.pdfBuffer, url, finalUrl: result.finalUrl };
      }
    }

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

    return { kind: "html", html, fullHtml, url, finalUrl };
  } finally {
    await browser.close();
  }
}
