# プロジェクト指示

## 目的

`agents-compose` は通常の Markdown ドキュメントを、決定的な `AGENTS.md` に合成する。
コアは小さく決定的に保ち、特定の AI プロバイダーに依存させないこと。

## 実装の責務境界

- `src/config/` は設定の解析・検証と、設定ファイル位置を基準とするパス解決を担う。
- `src/core/` はソース探索、Markdown 変換、レンダリング、それらの合成フローを担う。ファイル書き込みや CLI 表示を持ち込まないこと。
- `src/io/` は UTF-8 読み込み、バイト比較、一時ファイルからの置換による出力を担う。
- `src/cli/` は引数解析、終了コード、標準出力・標準エラー出力の契約を担う。Git submodule 操作は `src/git/` に閉じ込めること。
- `src/index.ts` からの export はライブラリの公開 API として扱うこと。

## 開発と検証

- 依存関係の管理とテストには Bun を使用すること。
- ランタイムは Node.js 22 以降をサポートすること。
- 編集後は `bun run format` を実行すること。
- 狭い検証には `bun test <test-file>`、テスト名で絞る場合は `bun test -t <pattern>` を使うこと。
- コミット前に `bun run check` を実行すること。
- ランタイム依存関係は、ローカルで実装する利点がない機能に限定すること。

変更箇所ごとに次を同期すること。

- ソース探索・変換・レンダリング: `tests/core/` と golden fixture
- 設定キーや既定値: `schema.json`、`src/config/`、`tests/config/`、README の設定リファレンス
- CLI の引数・表示・終了コード: `tests/cli/`
- 出力の書き込み・比較: `tests/io/`
- Git submodule 同期: `tests/cli/sync.test.ts`

## CLI契約

- `build` と `check` は現在のローカルソースだけを扱い、Git の起動やnetworkアクセスを行わないこと。
- `sync` だけが宣言済みsubmoduleを更新し、更新後に通常の合成・出力処理を使うこと。
- 終了コードは、成功を `0`、`check` で出力が存在しないか古い場合を `1`、設定・入力・I/O・Gitのエラーを `2` とすること。
- 診断は標準エラー出力へ書き、生成Markdownや `check --diff` のdiffだけを標準出力へ書くこと。

## Git submodule同期の安全条件

- submoduleのURLと追従branchは `.gitmodules` を正本とし、`agents-compose.json` には更新対象パスだけを持たせること。
- 更新開始前に、全対象が登録済みsubmoduleであることと、初期化済みsubmoduleがdirtyでないことを検証すること。1件でも失敗した場合は更新を始めないこと。
- 未初期化submoduleは `--init` で取得できるようにし、source探索はsubmodule更新後に行うこと。
- Gitはshell文字列ではなく引数配列で起動し、失敗時はGitの標準エラー出力を診断から失わないこと。
- `sync` はstage、commit、pushを行わないこと。

## 互換性

- 設定や生成出力の変更は、公開 API の変更として扱うこと。
- Windows、Linux、macOS の間でバイト単位に同一の出力を維持すること。
- ソース探索時にシンボリックリンクをたどらないこと。
- 出力ファイルのバイト列がすでに最新の場合は書き換えないこと。

## ドキュメント

- README の例は実行可能な状態に保つこと。
- 利用者向けの README は英語版 `README.md` と日本語版 `README.ja.md` の内容を同期させること。
- `AGENTS.md` は `docs/agent/project.md` から `bun run compose` で生成し、直接編集しないこと。

## リリース

- GitHub Release を起点に、release workflow を通して公開すること。
- npm provenance を使用すること。
- CI またはパッケージの dry-run 検証が失敗した場合は公開しないこと。
