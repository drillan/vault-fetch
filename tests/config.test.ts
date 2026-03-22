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

  it("throws on non-numeric VAULT_FETCH_TIMEOUT", () => {
    process.env.VAULT_FETCH_TIMEOUT = "abc";
    expect(() => resolveConfig({ dest: "/vault" }, undefined)).toThrow(
      "Invalid VAULT_FETCH_TIMEOUT",
    );
  });

  it("throws on invalid waitUntil value", () => {
    expect(() =>
      resolveConfig({ dest: "/vault", waitUntil: "invalid" as never }, undefined),
    ).toThrow("Invalid waitUntil value");
  });

  it("throws on invalid timeout type in config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /vault\ntimeout: not-a-number\n");
    expect(() => resolveConfig({}, configPath)).toThrow("Invalid timeout in config file");
  });

  it("throws on invalid waitUntil in config file", () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "dest: /vault\nwaitUntil: invalid\n");
    expect(() => resolveConfig({}, configPath)).toThrow("Invalid waitUntil value");
  });

  describe("resource blocking options", () => {
    it("defaults blockImages to true", () => {
      const config = resolveConfig({ dest: "/vault" }, undefined);
      expect(config.blockImages).toBe(true);
    });

    it("defaults blockFonts to true", () => {
      const config = resolveConfig({ dest: "/vault" }, undefined);
      expect(config.blockFonts).toBe(true);
    });

    it("defaults blockMedia to true", () => {
      const config = resolveConfig({ dest: "/vault" }, undefined);
      expect(config.blockMedia).toBe(true);
    });

    it("allows disabling blockImages via CLI", () => {
      const config = resolveConfig({ dest: "/vault", blockImages: false }, undefined);
      expect(config.blockImages).toBe(false);
    });

    it("allows disabling blockFonts via CLI", () => {
      const config = resolveConfig({ dest: "/vault", blockFonts: false }, undefined);
      expect(config.blockFonts).toBe(false);
    });

    it("allows disabling blockMedia via CLI", () => {
      const config = resolveConfig({ dest: "/vault", blockMedia: false }, undefined);
      expect(config.blockMedia).toBe(false);
    });
  });

  describe("raw option", () => {
    it("defaults raw to false", () => {
      const config = resolveConfig({ dest: "/vault" }, undefined);
      expect(config.raw).toBe(false);
    });

    it("allows enabling raw via CLI", () => {
      const config = resolveConfig({ dest: "/vault", raw: true }, undefined);
      expect(config.raw).toBe(true);
    });
  });
});
