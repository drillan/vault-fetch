# vault-fetch

A CLI tool that uses Playwright to fetch web pages and PDF files — pages that Obsidian Clipper cannot handle — converts them to Markdown, and saves them to your Obsidian Vault.

## Features

- Page fetching with JS rendering via [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) (stealth Chromium with source-level anti-bot patches)
- **PDF to Markdown conversion** (auto-detected via Content-Type)
- Article content extraction using Readability.js (removes ads and navigation), with `--raw` mode for full-page conversion
- Resource blocking (images, fonts, media) for faster fetching
- Anti-bot detection evasion (CDP leak patching, fingerprint randomization, automation signal removal)
- HTTP/HTTPS proxy support via `--proxy` option or `VAULT_FETCH_PROXY` environment variable
- Obsidian Clipper-compatible frontmatter (title, source, author, published, created, description, tags)
- Session management (`storageState`) for fetching authenticated pages
- 3-layer configuration resolution (CLI options > environment variables > config file)

## Installation

```bash
# Global install
npm install -g vault-fetch

# CloakBrowser's stealth Chromium binary is downloaded automatically on first run (~200MB, cached at ~/.cloakbrowser/)
```

## Usage

You can run it without installation using `npx`:

```bash
npx vault-fetch fetch https://example.com/article --dry-run --dest /tmp
```

### Fetching and Saving Pages

```bash
# Save to Obsidian Vault
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings

# Output to stdout (without saving)
vault-fetch fetch https://example.com/article --dry-run --dest /tmp

# Run in headed mode (for debugging)
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --headed

# Extract only a specific CSS selector (skips Readability)
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --selector "article"

# Add tags
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --tag tech --tag ai

# Full-page conversion for non-article pages (skips Readability)
vault-fetch fetch https://example.com/table-page --dest ~/Documents/Obsidian/Clippings --raw

# Fetch with images (blocked by default)
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --no-block-images

# Fetch a PDF and convert to Markdown (auto-detected)
vault-fetch fetch https://example.com/report.pdf --dest ~/Documents/Obsidian/Clippings

# Fetch via proxy
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --proxy http://proxy:8080
```

### PDF Support

When the server returns `Content-Type: application/pdf`, vault-fetch automatically downloads the PDF and converts it to Markdown using [pdf2md](https://github.com/opendocsg/pdf2md). No additional flags are needed.

- Title is extracted in priority order: PDF metadata (`dc:title` / `info.Title`) > first `#` heading in converted Markdown > URL filename
- Author and published date are also extracted from PDF metadata when available
- Use `--title` to manually override the title if automatic extraction is inaccurate
- `--selector` and `--raw` options cannot be used with PDF URLs
- Session support works with authenticated PDF downloads

### Login (Session Storage)

For sites that require authentication, you can log in and save the session beforehand.

```bash
vault-fetch login https://note.com
# → Browser opens → Log in manually → Press Enter in terminal
```

Subsequent `fetch` commands will automatically use the saved session for that domain.

### Fetch Options

| Option | Description |
|---|---|
| `--dest <path>` | Destination directory (required) |
| `--title <text>` | Override the page title for the output filename |
| `--headed` | Run with browser visible |
| `--selector <css>` | Extract elements by CSS selector |
| `--timeout <sec>` | Timeout in seconds (default: 30) |
| `--tag <name>` | Add tags (can be specified multiple times) |
| `--wait-until <event>` | Wait condition: `load` / `domcontentloaded` / `networkidle` (default: `networkidle`) |
| `--skip-session` | Do not use saved sessions |
| `--dry-run` | Output to stdout without saving |
| `--raw` | Skip Readability and convert full-page HTML directly |
| `--no-block-images` | Disable image request blocking |
| `--no-block-fonts` | Disable font request blocking |
| `--no-block-media` | Disable media request blocking |
| `--proxy <url>` | HTTP/HTTPS proxy URL (e.g. `http://host:port`) |

## Configuration

### Config File

`~/.config/vault-fetch/config.yaml`:

```yaml
# Obsidian Vault destination
dest: ~/Documents/Obsidian/Clippings

# Default tags
tags:
  - clippings

timeout: 30
```

### Environment Variables

| Variable | Description |
|---|---|
| `VAULT_FETCH_DEST` | Destination directory |
| `VAULT_FETCH_TIMEOUT` | Timeout in seconds |
| `VAULT_FETCH_PROXY` | HTTP/HTTPS proxy URL |

### Priority

CLI options > Environment variables > Config file > Default values

## Output Example

```yaml
---
title: "Thinking, Fast and Slow: Lessons for Software Engineers"
source: https://medium.com/@example/thinking-fast-and-slow-lessons-for-engineers-abc123
author:
  - "[[Jane Smith]]"
published: 2025-06-14
created: 2025-07-03
description: How cognitive biases from Kahneman's research apply to everyday engineering decisions...
tags:
  - clippings
---

The article body continues in Markdown...
```

## Development

```bash
npm run build        # Build with tsup
npm test             # Run tests with vitest
npm run typecheck    # Type checking
```

## License

MIT
