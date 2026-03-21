import TurndownService from "turndown";

export function convertToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  return turndown.turndown(html);
}
