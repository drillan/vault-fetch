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
- **ビルド**: tsup（ESM バンドル）
- **配布**: npm publish（`npx vault-fetch` / `npm install -g vault-fetch` 両対応）

## サブコマンド

### `vault-fetch fetch <URL>`

ページを取得し、Markdown に変換して Vault に保存する。

| オプション | 説明 |
|---|---|
| `--dest <path>` | 保存先ディレクトリ（CLI 最優先） |
| `--headed` | headed モードで実行 |
| `--selector <css>` | 特定要素のみ抽出（Readability をスキップし、セレクタで取得した HTML を直接 Turndown に渡す） |
| `--timeout <sec>` | タイムアウト秒数（デフォルト: 30） |
| `--tag <name>` | タグ追加（複数回指定可、`clippings` は常に付与） |
| `--wait-until <event>` | ページ待機条件: `load` / `domcontentloaded` / `networkidle`（デフォルト: `networkidle`） |
| `--skip-session` | 保存済みセッションを使わない |
| `--dry-run` | 保存せず標準出力に出力 |

`dest` は必須設定。CLI オプション・環境変数・設定ファイルのいずれでも指定されていない場合はエラー終了する。

### `vault-fetch login <URL>`

headed ブラウザを開き、手動ログイン後にセッション情報を保存する。

| オプション | 説明 |
|---|---|
| `--timeout <sec>` | ログイン待機のタイムアウト秒数（デフォルト: 300） |

ログインフロー:
1. headed ブラウザが開き、指定 URL に遷移する
2. ユーザーが手動でログインを完了する
3. ターミナルで Enter キーを押すとブラウザを閉じてセッションを保存する

## プロジェクト構造

```
vault-fetch/
├── src/
│   ├── cli.ts          # サブコマンド定義（commander.js）→ エントリーポイント
│   ├── fetcher.ts      # Playwright でページ取得（waitUntil: networkidle）
│   ├── extractor.ts    # Readability.js でコンテンツ抽出 + メタデータ取得
│   ├── converter.ts    # Turndown で Markdown 変換
│   ├── writer.ts       # frontmatter 生成 + ファイル名生成 + Vault 保存
│   ├── config.ts       # 3 層設定解決（CLI > env > config file）
│   └── session.ts      # storageState の保存・読み込み
├── package.json        # bin: { "vault-fetch": "./dist/cli.js" }
├── tsconfig.json
└── tsup.config.ts
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

`--selector` 指定時は `extractor.ts` の Readability 処理をスキップし、セレクタで取得した HTML を直接 `converter.ts` に渡す。

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
- 複数著者が検出された場合（`article:author` メタタグの複数指定）、それぞれを配列の要素として保存する
- `--tag` で追加されたタグは `tags` 配列に追加される
- `clippings` タグは設定にかかわらず常に自動付与される（重複時は1つにまとめる）

## ファイル名生成

- 記事タイトルをそのままファイル名にする（Obsidian Clipper と同じ方式）
- ファイルシステムで使えない文字（`/ \ : * ? " < > |`）を除去・置換
- 200 文字を超える場合は切り詰める
- 拡張子は `.md`
- 同名ファイルが既に存在する場合は上書きする

## 画像の取り扱い

記事中の画像はリモート URL 参照のまま `![alt](https://...)` として保存する。ローカルダウンロードは将来対応とする。

## Lazy Load 対応

ページスクロールによる遅延読み込みコンテンツの強制表示は将来対応とする。初期実装では `networkidle` 待機後の DOM をそのまま使用する。

## セッション管理

### ログインフロー

```
vault-fetch login https://note.com
  → headed ブラウザが開く
  → ユーザーが手動ログイン
  → ターミナルで Enter キーを押す
  → storageState が保存される
  → 保存先: ~/.config/vault-fetch/sessions/<domain>.json
```

### フェッチ時の動作

- URL のドメインに対応するセッションファイルがあれば自動読み込み
- `--skip-session` フラグで無効化可能

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

### デフォルト値

| 設定 | デフォルト |
|---|---|
| `dest` | なし（必須） |
| `tags` | `["clippings"]` |
| `timeout` | `30` |
| `wait-until` | `networkidle` |

## エラー処理

すべてのエラーは例外として伝播する（フォールバック禁止）。

| 状況 | 終了コード | 動作 |
|---|---|---|
| 正常終了 | 0 | — |
| `dest` 未指定 | 1 | エラーメッセージを表示して終了 |
| ネットワークエラー | 1 | エラーメッセージを表示して終了 |
| セレクタ未検出 | 1 | エラーメッセージを表示して終了 |
| Readability 抽出失敗 | 1 | エラーメッセージを表示して終了 |
| 保存先ディレクトリ不在 | 1 | エラーメッセージを表示して終了 |
| セッションファイル破損 | 1 | エラーメッセージを表示して終了 |

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
- `tsup`
- `vitest`
- `eslint`
- `@types/turndown`
- `@types/js-yaml`
- `@types/jsdom`

## セットアップ

`npm install` 後に Playwright のブラウザバイナリが必要:

```bash
npx playwright install chromium
```

`npm publish` で配布する場合、`postinstall` スクリプトでの自動インストールは行わない（ユーザー環境への副作用を避けるため）。README にセットアップ手順を記載する。
