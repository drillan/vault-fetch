import { describe, it, expect } from "vitest";
import { convertToMarkdown } from "../src/converter.js";

describe("convertToMarkdown", () => {
  it("converts heading to markdown", () => {
    const md = convertToMarkdown("<h1>見出し</h1>");
    expect(md).toContain("# 見出し");
  });

  it("converts paragraph to markdown", () => {
    const md = convertToMarkdown("<p>段落テキスト</p>");
    expect(md.trim()).toBe("段落テキスト");
  });

  it("converts link to markdown", () => {
    const md = convertToMarkdown('<a href="https://example.com">リンク</a>');
    expect(md).toContain("[リンク](https://example.com)");
  });

  it("converts image to markdown with remote URL", () => {
    const md = convertToMarkdown('<img src="https://example.com/img.png" alt="画像">');
    expect(md).toContain("![画像](https://example.com/img.png)");
  });

  it("converts list to markdown", () => {
    const md = convertToMarkdown("<ul><li>項目1</li><li>項目2</li></ul>");
    expect(md).toContain("項目1");
    expect(md).toContain("項目2");
  });
});
