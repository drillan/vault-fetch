export interface Metadata {
  title: string;
  source: string;
  author: string[];
  published: string | null;
  created: string;
  description: string | null;
}

export interface FetchResult {
  html: string;
  fullHtml: string;
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
