import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { join } from "node:path";

import { runCli, withTempDirectory, writeText } from "../helpers";

describe("CLI", () => {
	test("build --stdout has no file side effect", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["source.md"] }),
			);
			await writeText(join(directory, "source.md"), "# Source\n");

			const result = await runCli(["build", "--stdout"], directory);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("<!-- source: source.md -->\n# Source");
			expect(result.stderr).toBe("");
			await expect(access(join(directory, "AGENTS.md"))).rejects.toThrow();
		});
	});

	test("build and check use the documented exit codes", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["source.md"] }),
			);
			await writeText(join(directory, "source.md"), "# Source\n");

			const build = await runCli(["build"], directory);
			expect(build.exitCode).toBe(0);
			expect(build.stderr).toContain("Generated AGENTS.md");

			const current = await runCli(["check"], directory);
			expect(current.exitCode).toBe(0);
			expect(current.stderr).toContain("AGENTS.md is up to date");

			await writeText(join(directory, "source.md"), "# Changed\n");
			const stale = await runCli(["check", "--diff"], directory);
			expect(stale.exitCode).toBe(1);
			expect(stale.stdout).toContain("--- a/AGENTS.md");
			expect(stale.stderr).toContain("AGENTS.md is out of date");
		});
	});

	test("configuration errors return exit code 2", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(join(directory, "agents-compose.json"), "{}");

			const result = await runCli(["check"], directory);

			expect(result.exitCode).toBe(2);
			expect(result.stderr).toContain("Error:");
		});
	});

	test("a missing output returns exit code 1", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["source.md"] }),
			);
			await writeText(join(directory, "source.md"), "# Source\n");

			const result = await runCli(["check"], directory);

			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("AGENTS.md is out of date");
		});
	});
});
