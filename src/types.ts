export interface Metadata {
  title: string;
  source: string;
  author: string[];
  published: string | null;
  created: string;
  description: string | null;
}

export interface HtmlFetchResult {
  kind: "html";
  html: string;
  fullHtml: string;
  url: string;
  finalUrl: string;
}

export interface PdfFetchResult {
  kind: "pdf";
  pdfBuffer: Buffer;
  url: string;
  finalUrl: string;
}

export type FetchResult = HtmlFetchResult | PdfFetchResult;

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
  blockImages: boolean;
  blockFonts: boolean;
  blockMedia: boolean;
  raw: boolean;
}
