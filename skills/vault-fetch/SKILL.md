---
name: vault-fetch
description: >
  Webページを Playwright で取得し、Readability.js で記事本文を抽出して Markdown に変換するスキル。
  以下の場面で使用すること:
  (1) WebFetch が 403 エラーや Cloudflare チャレンジを返す場合
  (2) JavaScript レンダリングが必要なサイトのコンテンツを取得したい場合
  (3) ユーザーが「この URL を Obsidian に保存して」「記事をクリップして」と依頼した場合
  (4) Web ページのクリーンな記事本文（広告・ナビゲーション除去済み）が必要な場合
  headed-fetcher より高品質な抽出が可能（Readability.js による記事本文抽出 + Obsidian Clipper 互換フロントマター）。
  ユーザーが URL のコンテンツ取得に困っている場合や、Obsidian・Vault・クリップ・保存といった言葉を使った場合にも積極的に使用すること。
license: MIT
compatibility:
  - node
  - playwright
metadata:
  version: 0.1.0
  author: driller
---

# vault-fetch

Web ページを Playwright で取得し、Readability.js で記事本文を抽出して Obsidian Clipper 互換の Markdown に変換するスキル。

## When to Use

- `WebFetch` ツールが 403 エラーを返す場合
- Cloudflare などのボット対策が表示される場合
- JavaScript を実行しないとコンテンツが表示されないサイト
- ユーザーが Web ページを Obsidian Vault に保存したい場合
- クリーンな記事本文（広告・ナビ除去済み）が必要な場合

## Setup

vault-fetch がグローバルインストールされていること:

```bash
npm install -g vault-fetch
npx playwright install chromium
```

## Usage

### Mode 1: コンテンツ取得（会話内で使用）

ページの内容を取得して会話に返す場合は `--dry-run` を使う:

```bash
vault-fetch fetch <URL> --dry-run --dest /tmp
```

`--dry-run` は標準出力に Markdown を出力し、ファイル保存しない。`--dest` は必須引数だが `--dry-run` 時は実際には使われないので `/tmp` を指定する。

### Mode 2: Obsidian Vault に保存

ユーザーが「保存して」「クリップして」と言った場合:

```bash
vault-fetch fetch <URL> --dest ~/Documents/Obsidian/Clippings
```

保存先はユーザーに確認すること。設定ファイル (`~/.config/vault-fetch/config.yaml`) に `dest` が設定済みの場合は `--dest` を省略できる:

```bash
vault-fetch fetch <URL>
```

### Mode 3: 認証が必要なページ

ログインが必要なサイトの場合、まずセッションを保存する:

```bash
vault-fetch login <URL>
```

ブラウザが開くので手動でログイン後、ターミナルで Enter を押す。以降の `fetch` でそのドメインのセッションが自動的に使用される。

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | ファイル保存せず標準出力に出力 |
| `--dest <path>` | 保存先ディレクトリ |
| `--selector <css>` | CSS セレクタで要素を抽出 |
| `--headed` | headed モードで実行 |
| `--timeout <sec>` | タイムアウト秒数（デフォルト: 30） |
| `--tag <name>` | タグ追加（複数指定可） |
| `--wait-until <event>` | 待機条件（デフォルト: networkidle） |
| `--skip-session` | 保存済みセッションを使わない |

## Output Format

```yaml
---
title: Page Title
source: https://example.com/article
author:
  - "[[Author Name]]"
published: 2025-06-14
created: 2025-07-03
description: Article description...
tags:
  - clippings
---

Article content in Markdown...
```

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `HTTP 4xx/5xx` | サーバーエラー | URL を確認、`--headed` で再試行 |
| `Selector not found` | CSS セレクタが見つからない | セレクタを確認 |
| `Timeout` | ページ読み込みが遅い | `--timeout` を増やす |
| `dest is required` | 保存先未設定 | `--dest` を指定するか config.yaml を設定 |
| 認証エラー・ログインページ表示 | セッション切れ | `vault-fetch login <URL>` でセッション更新 |

## Tips

- `--dry-run` は常に `--dest /tmp` と組み合わせる（`dest` は必須引数のため）
- `--selector "article"` や `--selector ".post-content"` でメインコンテンツだけを抽出できる
- `--headed` はデバッグやボット対策回避に有効
