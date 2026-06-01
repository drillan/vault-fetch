import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

describe("CLI --version", () => {
  it("reports the version from package.json (no hardcoded drift)", () => {
    const output = execFileSync("node", ["dist/cli.js", "--version"], {
      encoding: "utf-8",
    }).trim();
    expect(output).toBe(pkg.version);
  });
});
