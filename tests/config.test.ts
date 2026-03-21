import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveConfig } from "../src/config.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolveConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vault-fetch-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.VAULT_FETCH_DEST;
    delete process.env.VAULT_FETCH_TIMEOUT;
  });

  it("throws when dest is not specified anywhere", () => {
    expect(() => resolveConfig({}, undefined)).toThrow("dest");
  });

  it("reads dest from config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /vault/clippings\n");
    const config = resolveConfig({}, configPath);
    expect(config.dest).toBe("/vault/clippings");
  });

  it("env overrides config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /from/file\n");
    process.env.VAULT_FETCH_DEST = "/from/env";
    const config = resolveConfig({}, configPath);
    expect(config.dest).toBe("/from/env");
  });

  it("CLI overrides env", () => {
    process.env.VAULT_FETCH_DEST = "/from/env";
    const config = resolveConfig({ dest: "/from/cli" }, undefined);
    expect(config.dest).toBe("/from/cli");
  });

  it("always includes clippings tag", () => {
    const config = resolveConfig({ dest: "/vault" }, undefined);
    expect(config.tags).toContain("clippings");
  });

  it("merges custom tags with clippings", () => {
    const config = resolveConfig({ dest: "/vault", tags: ["custom"] }, undefined);
    expect(config.tags).toContain("clippings");
    expect(config.tags).toContain("custom");
  });

  it("deduplicates clippings tag", () => {
    const config = resolveConfig({ dest: "/vault", tags: ["clippings", "other"] }, undefined);
    const clippingsCount = config.tags.filter((t: string) => t === "clippings").length;
    expect(clippingsCount).toBe(1);
  });

  it("applies default timeout when not specified", () => {
    const config = resolveConfig({ dest: "/vault" }, undefined);
    expect(config.timeout).toBe(30);
  });

  it("expands tilde in dest path", () => {
    const config = resolveConfig({ dest: "~/Documents/Vault" }, undefined);
    expect(config.dest).not.toContain("~");
    expect(config.dest).toContain("Documents/Vault");
  });
});
