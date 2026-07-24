import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadConfig, parseConfig } from "@/config";
import { AgentsComposeError } from "@/errors";
import { withTempDirectory, writeText } from "./helpers";

describe("parseConfig", () => {
	test("applies documented defaults", () => {
		expect(parseConfig({ version: 1, sources: ["docs/*.md"] })).toEqual({
			version: 1,
			output: "AGENTS.md",
			sources: ["docs/*.md"],
			exclude: [],
			stripFrontmatter: true,
			sourceComments: true,
			generatedHeader: true,
		});
	});

	test.each([
		[{ sources: ["docs/*.md"] }, "version must be 1"],
		[{ version: 2, sources: ["docs/*.md"] }, "version must be 1"],
		[{ version: 1, sources: [] }, "sources must be a non-empty array"],
		[
			{ version: 1, sources: ["../private.md"] },
			"must stay within the project root",
		],
		[{ version: 1, sources: ["!private.md"] }, "must not use a negative glob"],
		[
			{ version: 1, sources: ["docs/*.md"], output: "*.md" },
			"must not contain a glob",
		],
		[
			{ version: 1, sources: ["docs/*.md"], extra: true },
			"Unknown configuration key",
		],
		[
			{ version: 1, sources: ["docs/*.md"], $schema: 1 },
			"$schema must be a string",
		],
	])("rejects invalid configuration %#", (raw, message) => {
		expect(() => parseConfig(raw)).toThrow(message);
	});
});

describe("loadConfig", () => {
	test("resolves paths from the configuration directory", async () => {
		await withTempDirectory(async (directory) => {
			const configPath = join(directory, "nested", "agents-compose.json");
			await writeText(
				configPath,
				JSON.stringify({ version: 1, sources: ["docs/*.md"] }),
			);

			const config = await loadConfig(configPath);

			expect(config.projectRoot).toBe(join(directory, "nested"));
			expect(config.outputPath).toBe(join(directory, "nested", "AGENTS.md"));
		});
	});

	test("reports invalid JSON as a domain error", async () => {
		await withTempDirectory(async (directory) => {
			const configPath = join(directory, "agents-compose.json");
			await writeText(configPath, "{");

			await expect(loadConfig(configPath)).rejects.toBeInstanceOf(
				AgentsComposeError,
			);
		});
	});
});
