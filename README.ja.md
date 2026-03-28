# vault-fetch

Obsidian Clipper では取得できない、JavaScript レンダリングや認証が必要な Web ページおよび PDF ファイルを Playwright で取得し、Markdown に変換して Obsidian Vault に保存する CLI ツール。

## 特徴

- Playwright (Chromium) による JS レンダリング後のページ取得
- **PDF から Markdown への変換**（Content-Type で自動判定）
- Readability.js による記事本文の抽出（広告・ナビゲーション除去）、`--raw` モードでフルページ変換も可能
- リソースブロッキング（画像・フォント・メディア）による高速フェッチ
- Chrome User-Agent 偽装によるボット対策回避
- Obsidian Clipper 互換のフロントマター（title, source, author, published, created, description, tags）
- セッション管理（`storageState`）によるログイン済みページの取得
- 設定の 3 層解決（CLI オプション > 環境変数 > 設定ファイル）

## インストール

```bash
# グローバルインストール
npm install -g vault-fetch

# Playwright のブラウザも必要
npx playwright install chromium
```

## 使い方

`npx` でインストールなしでも実行できます:

```bash
npx vault-fetch fetch https://example.com/article --dry-run --dest /tmp
```

### ページの取得・保存

```bash
# Obsidian Vault に保存
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings

# 標準出力に出力（保存しない）
vault-fetch fetch https://example.com/article --dry-run --dest /tmp

# headed モードで実行（デバッグ用）
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --headed

# 特定の CSS セレクタのみ抽出（Readability をスキップ）
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --selector "article"

# タグを追加
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --tag tech --tag ai

# 非記事ページをフルページ変換（Readability をスキップ）
vault-fetch fetch https://example.com/table-page --dest ~/Documents/Obsidian/Clippings --raw

# 画像を含めてフェッチ（デフォルトではブロック）
vault-fetch fetch https://example.com/article --dest ~/Documents/Obsidian/Clippings --no-block-images

# PDF を取得して Markdown に変換（自動判定）
vault-fetch fetch https://example.com/report.pdf --dest ~/Documents/Obsidian/Clippings
```

### PDF 対応

サーバーが `Content-Type: application/pdf` を返す場合、vault-fetch は自動的に PDF をダウンロードし、[pdf2md](https://github.com/opendocsg/pdf2md) で Markdown に変換します。追加のフラグは不要です。

- タイトルは変換された Markdown の最初の `#` 見出しから抽出（なければ URL のファイル名を使用）
- `--selector` および `--raw` オプションは PDF URL と併用不可
- セッション機能により認証付き PDF のダウンロードにも対応

### ログイン（セッション保存）

認証が必要なサイトの場合、事前にログインしてセッションを保存できます。

```bash
vault-fetch login https://note.com
# → ブラウザが開く → 手動でログイン → ターミナルで Enter を押す
```

以降の `fetch` でそのドメインのセッションが自動的に使用されます。

### fetch オプション

| オプション | 説明 |
|---|---|
| `--dest <path>` | 保存先ディレクトリ（必須） |
| `--headed` | ブラウザを表示して実行 |
| `--selector <css>` | CSS セレクタで要素を抽出 |
| `--timeout <sec>` | タイムアウト秒数（デフォルト: 30） |
| `--tag <name>` | タグ追加（複数指定可） |
| `--wait-until <event>` | 待機条件: `load` / `domcontentloaded` / `networkidle`（デフォルト: `networkidle`） |
| `--skip-session` | 保存済みセッションを使わない |
| `--dry-run` | 保存せず標準出力に出力 |
| `--raw` | Readability をスキップし、フルページ HTML を直接変換 |
| `--no-block-images` | 画像リクエストのブロックを無効化 |
| `--no-block-fonts` | フォントリクエストのブロックを無効化 |
| `--no-block-media` | メディアリクエストのブロックを無効化 |

## 設定

### 設定ファイル

`~/.config/vault-fetch/config.yaml`:

```yaml
# Obsidian Vault の保存先
dest: ~/Documents/Obsidian/Clippings

# デフォルトタグ
tags:
  - clippings

timeout: 30
```

### 環境変数

| 変数 | 説明 |
|---|---|
| `VAULT_FETCH_DEST` | 保存先ディレクトリ |
| `VAULT_FETCH_TIMEOUT` | タイムアウト秒数 |

### 優先順位

CLI オプション > 環境変数 > 設定ファイル > デフォルト値

## 出力例

```yaml
---
title: ADHDの自分が毎日クッソ集中できるようになった習慣
source: https://note.com/simplearchitect/n/n8389e1b4fbde
author:
  - "[[牛尾　剛]]"
published: 2025-06-14
created: 2025-07-03
description: 自分はADHDですので、もちろん集中力は暗黒です...
tags:
  - clippings
---

記事の本文が Markdown で続きます...
```

## 開発

```bash
npm run build        # tsup でビルド
npm test             # vitest でテスト実行
npm run typecheck    # 型チェック
```

## ライセンス

MIT
