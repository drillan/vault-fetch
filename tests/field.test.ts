import { describe, it, expect } from "vitest";
import { parseFields, RESERVED_FRONTMATTER_KEYS } from "../src/config.js";

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

  it("throws when key collides with a reserved frontmatter key", () => {
    expect(() => parseFields(["title=X"])).toThrow(/reserved/i);
  });

  it("exposes the reserved key set", () => {
    expect(RESERVED_FRONTMATTER_KEYS).toContain("title");
    expect(RESERVED_FRONTMATTER_KEYS).toContain("tags");
    expect(RESERVED_FRONTMATTER_KEYS).toContain("source");
  });
});
