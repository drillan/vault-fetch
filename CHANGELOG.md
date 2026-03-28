# Changelog

## [0.3.0] - 2026-03-28

### Added

- PDF to Markdown conversion: URLs returning `Content-Type: application/pdf` are automatically detected, downloaded, and converted to Markdown using [@opendocsg/pdf2md](https://github.com/opendocsg/pdf2md)
- PDF metadata extraction: title from XMP `dc:title` / `info.Title`, author from `info.Author`, published date from `info.CreationDate`
- `--title <text>` option to manually override the page title for the output filename (works with both HTML and PDF URLs)
- PDF magic byte validation (`%PDF`) to ensure response body is valid PDF data
- `--selector` and `--raw` options now raise explicit errors when used with PDF URLs

### Changed

- `FetchResult` type is now a discriminated union (`HtmlFetchResult | PdfFetchResult`) to support multiple content types

## [0.2.0] - 2026-03-22

### Added

- Resource blocking: images, fonts, and media requests are blocked by default for faster page loading
- `--no-block-images`, `--no-block-fonts`, `--no-block-media` options to disable resource blocking individually
- `--raw` option to convert full page HTML without Readability extraction (useful for non-article pages)
- Chrome User-Agent spoofing to bypass bot detection
- Improved error message when Readability fails, with hints to try `--raw` or `--selector`

### Changed

- **Breaking**: Resource blocking is enabled by default. Pages that depend on image/font/media loading for correct rendering may produce different output. Use `--no-block-images`, `--no-block-fonts`, `--no-block-media` to restore previous behavior.

## [0.1.0] - 2026-03-21

### Added

- Initial release
- Playwright-based page fetching with JS rendering
- Readability.js content extraction
- Obsidian Clipper compatible frontmatter
- Session management for authenticated pages
- 3-layer configuration resolution (CLI > env > config file)
