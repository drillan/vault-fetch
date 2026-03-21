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
