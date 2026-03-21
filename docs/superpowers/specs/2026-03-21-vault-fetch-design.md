# vault-fetch 設計書

## 概要

JavaScriptレンダリングが必要なWebページをPlaywrightで取得し、Readability.jsで記事本文を抽出、Turndownで Markdown に変換して Obsidian Vault へ直接保存する CLI ツール。

Obsidian Clipper（ブラウザ拡張）では取得できない、JS レンダリングや認証が必要なページに対応する。

## 技術スタック

- **ランタイム**: Node.js（TypeScript）
- **ブラウザ自動化**: Playwright（Chromium）
- **コンテンツ抽出**: @mozilla/readability
- **Markdown 変換**: turndown
- **DOM 解析**: jsdom（Readability の依存）
- **CLI フレームワーク**: commander.js
- **設定ファイル**: YAML（js-yaml）
- **配布**: npm publish（`npx vault-fetch` / `npm install -g vault-fetch` 両対応）

## サブコマンド

### `vault-fetch fetch <URL>`

ページを取得し、Markdown に変換して Vault に保存する。

| オプション | 説明 |
|---|---|
| `--dest <path>` | 保存先ディレクトリ（CLI 最優先） |
| `--headed` | headed モードで実行 |
| `--selector <css>` | 特定要素のみ抽出 |
| `--timeout <sec>` | タイムアウト秒数（デフォルト: 30） |
| `--tag <name>` | タグ追加（複数回指定可、`clippings` は常に付与） |
| `--no-session` | 保存済みセッションを使わない |
| `--dry-run` | 保存せず標準出力に出力 |

### `vault-fetch login <URL>`

headed ブラウザを開き、手動ログイン後にセッション情報を保存する。

## プロジェクト構造

```
vault-fetch/
├── src/
│   ├── cli.ts          # サブコマンド定義（commander.js）
│   ├── fetcher.ts      # Playwright でページ取得
│   ├── extractor.ts    # Readability.js でコンテンツ抽出 + メタデータ取得
│   ├── converter.ts    # Turndown で Markdown 変換
│   ├── writer.ts       # frontmatter 生成 + ファイル名生成 + Vault 保存
│   ├── config.ts       # 3 層設定解決（CLI > env > config file）
│   └── session.ts      # storageState の保存・読み込み
├── package.json
└── tsconfig.json
```

## データフロー

```
URL
 │
 ▼
┌─────────────┐   storageState
│  fetcher.ts  │◄──────────────── session.ts
│ (Playwright) │   （セッション読込）
└──────┬──────┘
       │ HTML + Response
       ▼
┌──────────────┐
│ extractor.ts  │  Readability.js → 記事本文 HTML
│               │  meta/OGP tags → author, published, description
└──────┬───────┘
       │ 抽出済み HTML + メタデータ
       ▼
┌──────────────┐
│ converter.ts  │  Turndown → Markdown 変換
└──────┬───────┘
       │ Markdown 文字列
       ▼
┌──────────────┐
│  writer.ts    │  frontmatter 生成 + ファイル名生成 + Vault 保存
└──────────────┘
```

## Frontmatter（Obsidian Clipper 互換）

```yaml
---
title: "記事タイトル"
source: "https://example.com/article"
author:
  - "[[著者名]]"
published: 2025-06-14
created: 2025-07-03
description: "記事の説明文..."
tags:
  - "clippings"
---
```

### メタデータ取得元（優先順）

| フィールド | 取得元 |
|---|---|
| `title` | Readability.js の `title` → `<title>` |
| `source` | 最終 URL（リダイレクト後） |
| `author` | `article:author` → `og:author` → Readability の `byline` |
| `published` | `article:published_time` → `datePublished`（JSON-LD） |
| `created` | 実行時の日付 |
| `description` | `og:description` → `meta[name=description]` → Readability の `excerpt` |

- `author` は `[[著者名]]` 形式（Obsidian wiki link）で保存する
- `--tag` で追加されたタグは `tags` 配列に追加される（`clippings` は常に含む）

## ファイル名生成

- 記事タイトルをそのままファイル名にする（Obsidian Clipper と同じ方式）
- ファイルシステムで使えない文字（`/ \ : * ? " < > |`）を除去・置換
- 200 文字を超える場合は切り詰める
- 拡張子は `.md`

## セッション管理

### ログインフロー

```
vault-fetch login https://note.com
  → headed ブラウザが開く
  → ユーザーが手動ログイン
  → ブラウザを閉じると storageState が保存される
  → 保存先: ~/.config/vault-fetch/sessions/<domain>.json
```

### フェッチ時の動作

- URL のドメインに対応するセッションファイルがあれば自動読み込み
- `--no-session` フラグで無効化可能

## 設定

### 優先順位

**CLI オプション > 環境変数 > 設定ファイル > デフォルト値**

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

## エラー処理

すべてのエラーは例外として伝播する（フォールバック禁止）。

| 状況 | 動作 |
|---|---|
| ネットワークエラー | エラーメッセージを表示して終了 |
| セレクタ未検出 | エラーメッセージを表示して終了 |
| Readability 抽出失敗 | エラーメッセージを表示して終了 |
| 保存先ディレクトリ不在 | エラーメッセージを表示して終了 |
| セッションファイル破損 | エラーメッセージを表示して終了 |

## 依存パッケージ

### 本番

- `playwright`
- `@mozilla/readability`
- `turndown`
- `jsdom`
- `commander`
- `js-yaml`

### 開発

- `typescript`
- `vitest`
- `eslint`
- `@types/turndown`
- `@types/js-yaml`
- `@types/jsdom`
