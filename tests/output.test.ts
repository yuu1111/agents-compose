import { describe, expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { writeOutput } from "@/output";
import { withTempDirectory } from "./helpers";

describe("writeOutput", () => {
	test("writes atomically and skips byte-identical content", async () => {
		await withTempDirectory(async (directory) => {
			const outputPath = join(directory, "nested", "AGENTS.md");

			expect(await writeOutput(outputPath, "first\n")).toEqual({ changed: true });
			const firstStat = await stat(outputPath);
			expect(await readFile(outputPath, "utf8")).toBe("first\n");

			expect(await writeOutput(outputPath, "first\n")).toEqual({ changed: false });
			const secondStat = await stat(outputPath);
			expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);

			expect(await writeOutput(outputPath, "second\n")).toEqual({ changed: true });
			expect(await readFile(outputPath, "utf8")).toBe("second\n");
			expect(
				(await readdir(join(directory, "nested"))).filter((name) => name.endsWith(".tmp")),
			).toEqual([]);
		});
	});
});
