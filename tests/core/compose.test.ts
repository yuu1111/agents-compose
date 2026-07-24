import { describe, expect, test } from "bun:test";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "@/config";
import { compose } from "@/core/compose";
import { fixtureRoot, withTempDirectory, writeText } from "../helpers";

describe("compose", () => {
	test("matches the workspace golden fixture", async () => {
		const config = await loadConfig(join(fixtureRoot, "agents-compose.json"));
		const result = await compose(config);
		const expected = await readFile(
			join(fixtureRoot, "expected", "AGENTS.md"),
			"utf8",
		);

		expect(result.content).toBe(expected);
		expect(result.sources).toEqual([
			"docs/agent/workspace.md",
			"docs/agent/terminal.md",
		]);
	});

	test("keeps a source comment for an empty source", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(join(directory, "empty.md"), "---\na: b\n---\n");
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({
					version: 1,
					sources: ["empty.md"],
					generatedHeader: false,
				}),
			);

			const result = await compose(
				await loadConfig(join(directory, "agents-compose.json")),
			);

			expect(result.content).toBe("<!-- source: empty.md -->\n");
		});
	});

	test("rejects invalid UTF-8", async () => {
		await withTempDirectory(async (directory) => {
			await mkdir(directory, { recursive: true });
			await writeFile(join(directory, "invalid.md"), Buffer.from([0xc3, 0x28]));
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["invalid.md"] }),
			);

			await expect(
				compose(await loadConfig(join(directory, "agents-compose.json"))),
			).rejects.toThrow("not valid UTF-8");
		});
	});

	test("accepts and removes a leading UTF-8 BOM", async () => {
		await withTempDirectory(async (directory) => {
			await writeFile(
				join(directory, "bom.md"),
				Buffer.concat([
					Buffer.from([0xef, 0xbb, 0xbf]),
					Buffer.from("# BOM\n", "utf8"),
				]),
			);
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["bom.md"] }),
			);

			const result = await compose(
				await loadConfig(join(directory, "agents-compose.json")),
			);

			expect(result.content).toContain("<!-- source: bom.md -->\n# BOM");
			expect(result.content).not.toContain("\u{feff}");
		});
	});

	test("errors when a glob matches no files", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["missing/*.md"] }),
			);

			await expect(
				compose(await loadConfig(join(directory, "agents-compose.json"))),
			).rejects.toThrow("matched no files");
		});
	});

	test("sorts glob matches by Unicode code point", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(join(directory, "docs", "\u{e000}.md"), "private use");
			await writeText(join(directory, "docs", "😀.md"), "emoji");
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["docs/*.md"] }),
			);

			const result = await compose(
				await loadConfig(join(directory, "agents-compose.json")),
			);

			expect(result.sources).toEqual(["docs/\u{e000}.md", "docs/😀.md"]);
		});
	});

	test("never includes the output file as a source", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(join(directory, "AGENTS.md"), "old output");
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["*.md"] }),
			);

			await expect(
				compose(await loadConfig(join(directory, "agents-compose.json"))),
			).rejects.toThrow("No source files remain");
		});
	});

	if (process.platform !== "win32") {
		test("rejects a literal symbolic-link source", async () => {
			await withTempDirectory(async (directory) => {
				await writeText(join(directory, "real.md"), "# Real\n");
				await symlink("real.md", join(directory, "link.md"));
				await writeText(
					join(directory, "agents-compose.json"),
					JSON.stringify({ version: 1, sources: ["link.md"] }),
				);

				await expect(
					compose(await loadConfig(join(directory, "agents-compose.json"))),
				).rejects.toThrow("must not be a symbolic link");
			});
		});

		test("does not include symbolic links matched by a glob", async () => {
			await withTempDirectory(async (directory) => {
				await writeText(join(directory, "real.md"), "# Real\n");
				await symlink("real.md", join(directory, "link.md"));
				await writeText(
					join(directory, "agents-compose.json"),
					JSON.stringify({ version: 1, sources: ["*.md"] }),
				);

				const result = await compose(
					await loadConfig(join(directory, "agents-compose.json")),
				);

				expect(result.sources).toEqual(["real.md"]);
			});
		});
	}
});
