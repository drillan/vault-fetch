import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("E2E: vault-fetch fetch --dry-run", () => {
  it("fetches a page and outputs Markdown with frontmatter", () => {
    const output = execSync(
      "node dist/cli.js fetch https://example.com --dry-run --dest /tmp",
      { encoding: "utf-8", timeout: 60_000 },
    );

    // Frontmatter structure
    expect(output).toMatch(/^---\n/);
    expect(output).toContain("title:");
    expect(output).toContain("source:");
    expect(output).toContain("created:");
    expect(output).toContain("tags:");
    expect(output).toContain("clippings");

    // Markdown content
    expect(output).toContain("Example Domain");
  });
});
