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
  title?: string;
  noSession?: boolean;
  dryRun?: boolean;
  blockImages?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
  raw?: boolean;
  proxy?: string;
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return resolve(homedir(), filePath.slice(2));
  }
  return filePath;
}

const SUPPORTED_PROXY_SCHEMES = ["http:", "https:"] as const;

function sanitizeProxyUrl(proxy: string): string {
  try {
    const parsed = new URL(proxy);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "<invalid URL>";
  }
}

function validateProxyUrl(proxy: string): void {
  let parsed: URL;
  try {
    parsed = new URL(proxy);
  } catch {
    throw new Error(`Invalid proxy URL: ${sanitizeProxyUrl(proxy)}`);
  }
  const scheme = parsed.protocol;
  if (
    !SUPPORTED_PROXY_SCHEMES.includes(
      scheme as (typeof SUPPORTED_PROXY_SCHEMES)[number],
    )
  ) {
    throw new Error(
      `Unsupported proxy scheme: "${scheme}" in ${sanitizeProxyUrl(proxy)}. Only HTTP and HTTPS proxies are supported.`,
    );
  }
}

const VALID_WAIT_UNTIL: readonly string[] = ["load", "domcontentloaded", "networkidle"];

function validateWaitUntil(value: string): WaitUntilOption {
  if (!VALID_WAIT_UNTIL.includes(value)) {
    throw new Error(
      `Invalid waitUntil value: "${value}". Must be one of: ${VALID_WAIT_UNTIL.join(", ")}`,
    );
  }
  return value as WaitUntilOption;
}

function loadConfigFile(configPath: string): FileConfig {
  const content = readFileSync(configPath, "utf-8");
  const parsed = yaml.load(content);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Invalid config file: ${configPath}`);
  }
  const config = parsed as Record<string, unknown>;

  if (config.timeout !== undefined && typeof config.timeout !== "number") {
    throw new Error(`Invalid timeout in config file: expected number, got ${typeof config.timeout}`);
  }
  if (config.dest !== undefined && typeof config.dest !== "string") {
    throw new Error(`Invalid dest in config file: expected string, got ${typeof config.dest}`);
  }
  if (config.waitUntil !== undefined) {
    if (typeof config.waitUntil !== "string") {
      throw new Error(`Invalid waitUntil in config file: expected string, got ${typeof config.waitUntil}`);
    }
    validateWaitUntil(config.waitUntil);
  }
  if (config.tags !== undefined) {
    if (!Array.isArray(config.tags) || !config.tags.every((t: unknown) => typeof t === "string")) {
      throw new Error("Invalid tags in config file: expected array of strings");
    }
  }

  return config as FileConfig;
}

export function resolveProxy(
  cliProxy: string | undefined,
  envProxy: string | undefined,
): string | null {
  const proxy = cliProxy ?? envProxy ?? null;
  if (proxy !== null) {
    validateProxyUrl(proxy);
  }
  return proxy;
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
  const envProxy = process.env.VAULT_FETCH_PROXY;

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

  const rawWaitUntil = cliOptions.waitUntil ?? fileConfig.waitUntil ?? DEFAULT_WAIT_UNTIL;
  const waitUntil = validateWaitUntil(rawWaitUntil);

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
    title: cliOptions.title ?? null,
    noSession: cliOptions.noSession ?? false,
    dryRun: cliOptions.dryRun ?? false,
    blockImages: cliOptions.blockImages ?? true,
    blockFonts: cliOptions.blockFonts ?? true,
    blockMedia: cliOptions.blockMedia ?? true,
    raw: cliOptions.raw ?? false,
    proxy: resolveProxy(cliOptions.proxy, envProxy),
  };
}
