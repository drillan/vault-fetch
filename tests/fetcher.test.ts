import { describe, it, expect } from "vitest";
import { buildBlockedResourceTypes, CHROME_USER_AGENT } from "../src/fetcher.js";

describe("buildBlockedResourceTypes", () => {
  it("includes all resource types when all blocking enabled", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: true,
      blockMedia: true,
    });
    expect(blocked).toEqual(new Set(["image", "font", "media"]));
  });

  it("excludes image when blockImages is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: false,
      blockFonts: true,
      blockMedia: true,
    });
    expect(blocked.has("image")).toBe(false);
    expect(blocked.has("font")).toBe(true);
    expect(blocked.has("media")).toBe(true);
  });

  it("excludes font when blockFonts is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: false,
      blockMedia: true,
    });
    expect(blocked.has("image")).toBe(true);
    expect(blocked.has("font")).toBe(false);
    expect(blocked.has("media")).toBe(true);
  });

  it("excludes media when blockMedia is false", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: true,
      blockFonts: true,
      blockMedia: false,
    });
    expect(blocked.has("image")).toBe(true);
    expect(blocked.has("font")).toBe(true);
    expect(blocked.has("media")).toBe(false);
  });

  it("returns empty set when all blocking disabled", () => {
    const blocked = buildBlockedResourceTypes({
      blockImages: false,
      blockFonts: false,
      blockMedia: false,
    });
    expect(blocked.size).toBe(0);
  });
});

describe("CHROME_USER_AGENT", () => {
  it("is a non-empty string", () => {
    expect(CHROME_USER_AGENT).toBeTruthy();
    expect(typeof CHROME_USER_AGENT).toBe("string");
  });

  it("contains Chrome identifier", () => {
    expect(CHROME_USER_AGENT).toContain("Chrome/");
  });
});
