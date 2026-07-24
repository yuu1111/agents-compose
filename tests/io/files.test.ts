import { describe, expect, test } from "bun:test";
import { symlink } from "node:fs/promises";
import { join } from "node:path";

import { readOptionalRegularFile } from "@/io/files";
import { withTempDirectory, writeText } from "../helpers";

describe("readOptionalRegularFile", () => {
	test("distinguishes missing paths, files, and directories", async () => {
		await withTempDirectory(async (directory) => {
			const filePath = join(directory, "output.md");
			await writeText(filePath, "content");

			expect(
				await readOptionalRegularFile(join(directory, "missing.md"), "Output"),
			).toBeUndefined();
			expect(await readOptionalRegularFile(filePath, "Output")).toEqual(
				Buffer.from("content"),
			);
			await expect(
				readOptionalRegularFile(directory, "Output"),
			).rejects.toThrow("Output is not a regular file");
		});
	});

	if (process.platform !== "win32") {
		test("rejects symbolic links", async () => {
			await withTempDirectory(async (directory) => {
				await writeText(join(directory, "target.md"), "content");
				const linkPath = join(directory, "link.md");
				await symlink("target.md", linkPath);

				await expect(
					readOptionalRegularFile(linkPath, "Output"),
				).rejects.toThrow("Output must not be a symbolic link");
			});
		});
	}
});
