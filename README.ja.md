# agents-compose

[English](./README.md) | 日本語

通常の Markdown ドキュメントを、決定的な `AGENTS.md` に合成します。

`agents-compose` を使うと、既存の運用メモ、アーキテクチャ文書、チーム規約をそのまま信頼できる情報源として維持できます。新しいルール用 DSL を導入したり、ドキュメントを書き換えたりすることはありません。

## なぜ使うのか

大きな `AGENTS.md` を直接保守するのは困難です。多くのプロジェクトでは、同じ情報が、普段から人が読み書きする複数の Markdown ドキュメントにすでに分かれています。

`agents-compose` は、次の特徴を持つ小さなコンパイル処理を提供します。

- 宣言順にソースを展開
- 各 glob 内で決定的に並べ替え
- 重複と除外を処理
- ソースごとに frontmatter を除去
- 生成ファイルにソースコメントを追加
- UTF-8 と LF に正規化
- CI やフック向けのバイト単位の `check`
- Windows、Linux、macOS で同一の出力

## クイックスタート

パッケージを開発依存関係としてインストールします。

```console
npm install --save-dev agents-compose
```

`agents-compose.json` を作成します。

```json
{
  "$schema": "./node_modules/agents-compose/schema.json",
  "version": 1,
  "output": "AGENTS.md",
  "sources": [
    "docs/agent/workspace.md",
    "docs/agent/*.md"
  ],
  "exclude": [
    "docs/agent/private.md"
  ]
}
```

生成ファイルをビルドして検証します。

```console
npx agents-compose build
npx agents-compose check
```

CLI をインストールしていないエージェント、レビュアー、Web インターフェースからも読めるように、`AGENTS.md` をコミットしてください。

## コマンド

```console
agents-compose build [--config <path>] [--stdout]
agents-compose check [--config <path>] [--diff]
agents-compose sync [--config <path>]
```

| コマンド | 動作 |
|---|---|
| `build` | 設定された出力を生成します。バイト列が変わらない場合、ファイルは書き換えません。 |
| `build --stdout` | 生成した Markdown のみを標準出力へ書き込み、出力ファイルには触れません。 |
| `check` | 出力が最新なら終了コード 0、存在しないか古い場合は 1 を返します。 |
| `check --diff` | 出力が存在しないか古い場合に unified diff を表示します。 |
| `sync` | 宣言済み Git submodule を更新してから、設定された出力を生成します。 |
| `--config <path>` | `agents-compose.json` 以外の設定ファイルを使用します。相対パスはカレントディレクトリを基準に解決します。 |

設定、入力、I/O のエラーは終了コード 2 を返します。診断メッセージは標準エラー出力に書き込みます。

## 設定

すべてのパスは、設定ファイルがあるディレクトリからの相対パスです。パスはそのプロジェクトルート内に収まる必要があります。移植可能なパス区切り文字は `/` です。`\` も受け付け、正規化します。

| キー | 型 | デフォルト | 説明 |
|---|---|---|---|
| `version` | `1` | 必須 | 設定形式のバージョンです。 |
| `sources` | `string[]` | 必須 | リテラルパスまたは glob パターンです。宣言順に展開します。 |
| `output` | `string` | `"AGENTS.md"` | 生成ファイルのパスです。glob は使用できません。 |
| `exclude` | `string[]` | `[]` | ソース展開後に除外するパターンです。 |
| `gitSubmodules` | `string[]` | `[]` | `sync` で更新する Git submodule のリテラルパスです。glob、重複、絶対パス、`..` は使用できません。 |
| `stripFrontmatter` | `boolean` | `true` | 各ソースの先頭にある完全な `---` frontmatter ブロックを除去します。 |
| `sourceComments` | `boolean` | `true` | 各ソースの前に `<!-- source: path -->` を追加します。 |
| `generatedHeader` | `boolean` | `true` | 生成ファイルであることを示す警告ヘッダーを追加します。 |

未知のキーや未対応のバージョンはエラーになります。同梱の [JSON Schema](./schema.json) でエディター上の検証が可能です。CLI は、JSON Schema では表現できない制約も検証します。

### ソース探索

- `sources` の宣言順を維持します。
- 各 glob の一致結果は、正規化した相対パスを基準に、大文字と小文字を区別した Unicode コードポイント順で並べ替えます。
- 同じファイルが複数回一致した場合、最初の位置に一度だけ含めます。
- リテラルソースとソース glob は、少なくとも 1 ファイルに一致する必要があります。
- 除外パターンは、どのファイルにも一致しなくても構いません。
- 否定 glob パターンは拒否されます。代わりに `exclude` を使用してください。
- 出力ファイル自体は常にソース集合から除外されます。
- シンボリックリンクはたどりません。リテラル指定したソースがシンボリックリンクの場合はエラーになります。
- 除外後にソースが 1 つも残らない場合はエラーになります。

### Git submodule で共有するルール

エージェント専用ルールは `.agents/rules/` に配置します。共有ルールsubmoduleの推奨配置先は `.agents/rules/<name>/` です。人間向けの既存文書は `docs/` など、従来の信頼できる情報源に置いたまま合成できます。`.agents/rules/` への移動は必須ではありません。

submodule の URL とbranchは `.gitmodules` を正本とし、追従branchを明示します。

```ini
[submodule ".agents/rules/ffxiv-terminology"]
  path = .agents/rules/ffxiv-terminology
  url = https://github.com/example/ffxiv-terminology.git
  branch = main
```

`agents-compose.json` でパスを宣言し、その中の Markdown を合成対象にします。

```json
{
  "version": 1,
  "sources": [
    "docs/agent/project.md",
    ".agents/rules/ffxiv-terminology/*.md"
  ],
  "gitSubmodules": [
    ".agents/rules/ffxiv-terminology"
  ]
}
```

同期は明示的に実行します。

```console
npx agents-compose sync
```

`sync` は、更新を始める前に宣言された全パスと、初期化済みsubmoduleのdirty状態を検証します。その後、`git submodule update --init --remote -- <paths...>` 相当の更新を行い、`AGENTS.md` を生成します。stage、commit、push は行いません。`build` と `check` は引き続き決定的かつオフラインで、Git の起動やnetworkアクセスを行いません。

### 入出力

- 入力は有効な UTF-8 である必要があります。先頭の UTF-8 BOM は受け付け、除去します。
- CRLF と CR は LF に正規化します。
- 先頭と末尾の空行を除去し、内部の行と空白は維持します。
- 本文中の水平線を frontmatter として扱うことはありません。
- セクション間は 1 つの空行で区切ります。
- 出力は BOM なしの UTF-8 で、末尾は厳密に 1 つの LF になります。
- 変更された出力はアトミックに置き換えます。

## CI

生成ファイルをコミットし、CI で `check` を実行します。

```yaml
- run: npm ci
- run: npx agents-compose check --diff
```

このリポジトリには、Windows、Linux、macOS 上の Node.js 22 と 24 でテストする完全な [GitHub Actions workflow](./.github/workflows/ci.yml) が含まれています。

定期実行でsubmoduleの追従漏れを検出するには、`sync` の後に Git で変更を確認します。

```yaml
- run: npx agents-compose sync
- run: git diff --exit-code
```

## pre-commit フック

コミット前に毎回出力を再生成してステージするフックを使用できます。

```sh
#!/bin/sh
set -eu

npx agents-compose build
git add -- AGENTS.md
```

CLI は意図的に自動ステージ機能を持ちません。フックを使用する場合も、CI では `check` を実行してください。

## Claude Code

`CLAUDE.md` から生成済みの指示を参照すれば、別の変換処理は不要です。

```md
@AGENTS.md
```

## ライブラリ API

Node.js からコア機能を利用できます。

```typescript
import { compose, loadConfig } from "agents-compose";

const config = await loadConfig("agents-compose.json");
const result = await compose(config);
process.stdout.write(result.content);
```

## スコープ

`agents-compose` は、意図的に次のことを行いません。

- ルールを Cursor、Copilot、Gemini、その他のツール固有形式へ変換
- MCP、skill、command、subagent、hook、permission の管理
- JavaScript、MDX、リモートテンプレートの実行
- AI によるルールの生成や書き換え
- 意味上の矛盾の検出
- `build` または `check` 中のリモートソース取得。宣言済み Git submodule は、明示的な `sync` でのみ更新します

複数ツール向けにルールを変換する場合は、[Rulesync](https://github.com/dyoshikawa/rulesync) などのプロジェクトを使用してください。`agents-compose` は docs-as-source と決定的な `AGENTS.md` 生成に特化しています。

## 開発

```console
bun install
bun run format
bun run check
bun run build
```

このプロジェクトでは [`@yuu1111/biome-config`](https://www.npmjs.com/package/@yuu1111/biome-config) と [`@yuu1111/tsconfig`](https://www.npmjs.com/package/@yuu1111/tsconfig) を使用しています。

## 公開

GitHub Release が公開されると、[release workflow](./.github/workflows/release.yml) が npm へリリースします。初回リリースの前に、次の内容で npm Trusted Publisher を設定してください。

- repository: `yuu1111/agents-compose`
- workflow: `release.yml`
- environment: `npm`

workflow は全チェックとビルドを実行し、`npm pack --dry-run` でパッケージを検証して、npm provenance 付きで公開します。

## ライセンス

[MIT](./LICENSE)
