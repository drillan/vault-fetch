import { describe, it, expect } from "vitest";
import { parseFields, RESERVED_FRONTMATTER_KEYS, resolveConfig } from "../src/config.js";
import { buildFrontmatter } from "../src/writer.js";
import type { Metadata } from "../src/types.js";

describe("parseFields", () => {
  it("parses simple key=value as string", () => {
    expect(parseFields(["type=clipping"])).toEqual({ type: "clipping" });
  });

  it("parses YAML array value including wikilinks", () => {
    expect(parseFields(['ticker=["[[AAPL]]"]'])).toEqual({
      ticker: ["[[AAPL]]"],
    });
  });

  it("parses multiple fields", () => {
    expect(parseFields(["type=clipping", "sentiment=bullish"])).toEqual({
      type: "clipping",
      sentiment: "bullish",
    });
  });

  it("keeps value after the first '=' intact", () => {
    expect(parseFields(["note=a=b=c"])).toEqual({ note: "a=b=c" });
  });

  it("throws when '=' is missing", () => {
    expect(() => parseFields(["broken"])).toThrow(/key=value/);
  });

  it("throws when key is empty", () => {
    expect(() => parseFields(["=value"])).toThrow(/empty/);
  });

  it("throws when key collides with a reserved frontmatter key", () => {
    expect(() => parseFields(["title=X"])).toThrow(/reserved/i);
  });

  it("exposes the reserved key set", () => {
    expect(RESERVED_FRONTMATTER_KEYS).toContain("title");
    expect(RESERVED_FRONTMATTER_KEYS).toContain("tags");
    expect(RESERVED_FRONTMATTER_KEYS).toContain("source");
  });

  it("reserved key set contains all 7 fixed-schema keys (single-source guard)", () => {
    const required = ["title", "source", "author", "published", "created", "description", "tags"];
    for (const key of required) {
      expect(RESERVED_FRONTMATTER_KEYS as readonly string[]).toContain(key);
    }
    expect(RESERVED_FRONTMATTER_KEYS).toHaveLength(7);
  });

  it("coerces numeric string to number via YAML parse", () => {
    expect(parseFields(["n=5"])).toEqual({ n: 5 });
  });

  it("coerces null string to null via YAML parse", () => {
    expect(parseFields(["x=null"])).toEqual({ x: null });
  });

  it("keeps plain string as string via YAML parse", () => {
    expect(parseFields(["s=hello"])).toEqual({ s: "hello" });
  });

  it("rejects __proto__ key with an error", () => {
    expect(() => parseFields(["__proto__=x"])).toThrow(/not allowed/);
  });

  it("rejects constructor key with an error", () => {
    expect(() => parseFields(["constructor=x"])).toThrow(/not allowed/);
  });

  it("rejects prototype key with an error", () => {
    expect(() => parseFields(["prototype=x"])).toThrow(/not allowed/);
  });
});

describe("resolveConfig with fields", () => {
  it("includes parsed fields in resolved config", () => {
    const cfg = resolveConfig(
      { dest: "/tmp", fields: { type: "clipping", ticker: ["[[AAPL]]"] } },
      undefined,
    );
    expect(cfg.fields).toEqual({ type: "clipping", ticker: ["[[AAPL]]"] });
  });

  it("defaults fields to empty object when not given", () => {
    const cfg = resolveConfig({ dest: "/tmp" }, undefined);
    expect(cfg.fields).toEqual({});
  });
});

describe("buildFrontmatter with custom fields", () => {
  const metadata: Metadata = {
    title: "テスト記事",
    source: "https://example.com",
    author: [],
    published: null,
    created: "2026-06-01",
    description: null,
  };

  it("appends custom fields after fixed schema", () => {
    const fm = buildFrontmatter(metadata, ["clippings"], {
      type: "clipping",
      sentiment: "bullish",
    });
    expect(fm).toContain("type: clipping");
    expect(fm).toContain("sentiment: bullish");
    // custom fields must come AFTER the fixed schema (tags is the last fixed key)
    expect(fm.indexOf("type: clipping")).toBeGreaterThan(fm.indexOf("tags:"));
    expect(fm.indexOf("sentiment: bullish")).toBeGreaterThan(fm.indexOf("tags:"));
  });

  it("emits wikilink array values", () => {
    const fm = buildFrontmatter(metadata, ["clippings"], {
      ticker: ["[[AAPL]]"],
    });
    expect(fm).toContain("ticker:");
    expect(fm).toContain("[[AAPL]]");
  });

  it("works when fields are omitted (backward compatible)", () => {
    const fm = buildFrontmatter(metadata, ["clippings"]);
    expect(fm).toMatch(/^---\n/);
    expect(fm).toContain("title:");
  });
});
