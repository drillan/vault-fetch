# Changelog

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
