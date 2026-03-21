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
