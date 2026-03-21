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
  return parsed.hostname ?? "";
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
