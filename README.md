# agents-compose

Compose ordinary Markdown documents into a deterministic `AGENTS.md`.

`agents-compose` lets existing operational notes, architecture documents, and team conventions remain the source of truth. It does not introduce a new rule DSL and does not rewrite your documentation.

## Why

Large `AGENTS.md` files are difficult to maintain directly. Many projects already have the same information split across Markdown documents that people read and edit every day.

`agents-compose` provides a small compilation step with:

- declaration-order source expansion
- deterministic ordering inside each glob
- duplicate and exclusion handling
- per-source frontmatter removal
- source comments in the generated file
- UTF-8 and LF normalization
- byte-level `check` for CI and hooks
- identical output on Windows, Linux, and macOS

## Quick start

Install the package as a development dependency:

```console
npm install --save-dev agents-compose
```

Create `agents-compose.json`:

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

Build and verify the generated file:

```console
npx agents-compose build
npx agents-compose check
```

Commit `AGENTS.md` so agents, reviewers, and web interfaces can read it without installing the CLI.

## Commands

```console
agents-compose build [--config <path>] [--stdout]
agents-compose check [--config <path>] [--diff]
```

| Command | Behavior |
|---|---|
| `build` | Generates the configured output. The file is not rewritten when its bytes are unchanged. |
| `build --stdout` | Writes only the generated Markdown to standard output and does not touch the output file. |
| `check` | Returns exit code 0 when the output is current and 1 when it is missing or stale. |
| `check --diff` | Prints a unified diff for a missing or stale output. |
| `--config <path>` | Uses a configuration file other than `agents-compose.json`. Relative paths are resolved from the current directory. |

Configuration, input, and I/O errors return exit code 2. Diagnostics are written to standard error.

## Configuration

All paths are relative to the directory containing the configuration file. Paths must stay inside that project root. `/` is the portable path separator; `\` is accepted and normalized.

| Key | Type | Default | Description |
|---|---|---|---|
| `version` | `1` | required | Configuration format version. |
| `sources` | `string[]` | required | Literal paths or glob patterns, expanded in declaration order. |
| `output` | `string` | `"AGENTS.md"` | Generated file path. Globs are not allowed. |
| `exclude` | `string[]` | `[]` | Patterns removed after source expansion. |
| `stripFrontmatter` | `boolean` | `true` | Removes a complete leading `---` frontmatter block from each source. |
| `sourceComments` | `boolean` | `true` | Adds `<!-- source: path -->` before each source. |
| `generatedHeader` | `boolean` | `true` | Adds the generated-file warning header. |

Unknown keys and unsupported versions are errors. The bundled [JSON Schema](./schema.json) provides editor validation, while the CLI also validates constraints that JSON Schema cannot express.

### Source discovery

- `sources` declaration order is preserved.
- Matches inside each glob are sorted by normalized relative path using case-sensitive Unicode code-point order.
- A file matched more than once is included only at its first position.
- Literal sources and source globs must match at least one file.
- Exclude patterns may match zero files.
- Negative glob patterns are rejected; use `exclude` instead.
- The output itself is always removed from the source set.
- Symbolic links are not followed. A literal symbolic-link source is an error.
- Having no sources after exclusions is an error.

### Input and output

- Inputs must be valid UTF-8. A leading UTF-8 BOM is accepted and removed.
- CRLF and CR are normalized to LF.
- Edge blank lines are removed; internal lines and whitespace are preserved.
- A body horizontal rule is not treated as frontmatter.
- Sections are separated by one blank line.
- Output is UTF-8 without BOM and ends with exactly one LF.
- Changed output is replaced atomically.

## CI

Commit the generated file and run `check` in CI:

```yaml
- run: npm ci
- run: npx agents-compose check --diff
```

The repository includes a complete [GitHub Actions workflow](./.github/workflows/ci.yml) that tests Node.js 22 and 24 on Windows, Linux, and macOS.

## Pre-commit hook

A hook can regenerate and stage the output before every commit:

```sh
#!/bin/sh
set -eu

npx agents-compose build
git add -- AGENTS.md
```

Automatic staging is intentionally not built into the CLI. Keep `check` in CI even when using a hook.

## Claude Code

`CLAUDE.md` can refer to the generated instructions without another conversion step:

```md
@AGENTS.md
```

## Library API

The core is available to Node.js callers:

```typescript
import { compose, loadConfig } from "agents-compose";

const config = await loadConfig("agents-compose.json");
const result = await compose(config);
process.stdout.write(result.content);
```

## Scope

`agents-compose` deliberately does not:

- convert rules into Cursor, Copilot, Gemini, or other tool-specific formats
- manage MCP, skills, commands, subagents, hooks, or permissions
- execute JavaScript, MDX, or remote templates
- use AI to generate or rewrite rules
- detect semantic contradictions
- fetch remote sources

For multi-tool rule conversion, use a project such as [Rulesync](https://github.com/dyoshikawa/rulesync). `agents-compose` focuses on docs-as-source and deterministic `AGENTS.md` generation.

## Development

```console
bun install
bun run format
bun run check
bun run build
```

The project uses [`@yuu1111/biome-config`](https://www.npmjs.com/package/@yuu1111/biome-config) and [`@yuu1111/tsconfig`](https://www.npmjs.com/package/@yuu1111/tsconfig).

## Publishing

Releases are published to npm by [the release workflow](./.github/workflows/release.yml) when a GitHub Release is published. Before the first release, configure an npm Trusted Publisher for:

- repository: `yuu1111/agents-compose`
- workflow: `release.yml`
- environment: `npm`

The workflow runs the full check and build, verifies the package with `npm pack --dry-run`, and publishes with npm provenance.

## License

[MIT](./LICENSE)
