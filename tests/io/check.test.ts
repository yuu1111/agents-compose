import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "@/config";
import { checkOutput } from "@/io/check";
import { withTempDirectory, writeText } from "../helpers";

describe("checkOutput", () => {
	test("compares bytes and creates a labeled unified diff", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["source.md"] }),
			);
			await writeText(join(directory, "source.md"), "# Source\n");
			await writeText(join(directory, "AGENTS.md"), "old\n");
			const config = await loadConfig(join(directory, "agents-compose.json"));

			expect(await checkOutput(config, "old\n", false)).toEqual({
				matches: true,
			});

			const result = await checkOutput(config, "new\n", true);
			expect(result.matches).toBe(false);
			expect(result.diff).toContain("--- a/AGENTS.md");
			expect(result.diff).toContain("+++ b/AGENTS.md");
			expect(result.diff).toContain("-old");
			expect(result.diff).toContain("+new");
		});
	});
});
