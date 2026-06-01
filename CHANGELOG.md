# Changelog

## [0.5.1] - 2026-06-01

### Fixed

- `--version` reported `0.4.0` because the version string was hardcoded in `src/cli.ts`. The CLI now derives its version from `package.json` at runtime, eliminating the duplicate source of truth and preventing future drift

## [0.5.0] - 2026-06-01

### Added

- `--field <key=value>` option to inject custom frontmatter fields (repeatable); user-specified fields are appended after the fixed schema
- Reserved frontmatter key guard: keys that collide with the fixed schema, as well as `__proto__` / `constructor` / `prototype`, are rejected with an explicit error

### Changed

- Filename collisions no longer silently overwrite: when a file with the same name already exists for a different source URL, the new content is saved under a numbered alias (`Title-2.md`, `Title-3.md`, …). Re-clipping the same source still overwrites in place

### Fixed

- Source URL comparison now parses the frontmatter block with `yaml.load`, so URLs that YAML quotes (e.g. containing `": "`) match the canonical source and re-clips overwrite instead of creating a `-2` alias
- A malformed neighboring file no longer aborts an unrelated save; its frontmatter is treated as a non-matching source

## [0.4.0] - 2026-03-28

### Added

- Anti-bot detection evasion using [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) (stealth Chromium with 33 source-level C++ patches for CDP leak patching, fingerprint randomization, and automation signal removal)
- `--proxy <url>` option for HTTP/HTTPS proxy support (available for both `fetch` and `login` commands)
- `VAULT_FETCH_PROXY` environment variable for proxy configuration
- Proxy URL validation with explicit error messages for unsupported schemes (SOCKS5 support planned for future release)

### Changed

- **Breaking**: Browser engine replaced from Playwright to CloakBrowser. `npx playwright install chromium` is no longer needed; CloakBrowser's stealth Chromium binary is downloaded automatically on first run (~200MB, cached at `~/.cloakbrowser/`)
- Removed hardcoded Chrome User-Agent spoofing (CloakBrowser generates realistic browser fingerprints automatically)

## [0.3.1] - 2026-03-28

### Added

- PDF metadata extraction: title from XMP `dc:title` / `info.Title`, author from `info.Author`, published date from `info.CreationDate`
- `--title <text>` option to manually override the page title for the output filename (works with both HTML and PDF URLs)
- Multiple authors in PDF `info.Author` (separated by `;`, ` and `, `&`) are now split into individual entries

### Fixed

- PDF title extraction no longer relies solely on font-size heuristics; PDF document metadata is now preferred

## [0.3.0] - 2026-03-28

### Added

- PDF to Markdown conversion: URLs returning `Content-Type: application/pdf` are automatically detected, downloaded, and converted to Markdown using [@opendocsg/pdf2md](https://github.com/opendocsg/pdf2md)
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
