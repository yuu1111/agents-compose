import { lstat, readFile } from "node:fs/promises";

import { createTwoFilesPatch } from "diff";

import type { ResolvedConfig } from "@/config";
import { AgentsComposeError } from "@/errors";

export interface CheckResult {
	matches: boolean;
	diff?: string;
}

async function readExisting(path: string): Promise<Buffer | undefined> {
	try {
		const stats = await lstat(path);
		if (stats.isSymbolicLink()) {
			throw new AgentsComposeError(`Output must not be a symbolic link: ${path}`);
		}
		if (!stats.isFile()) {
			throw new AgentsComposeError(`Output is not a regular file: ${path}`);
		}
		return await readFile(path);
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return undefined;
		}
		throw error;
	}
}

export async function checkOutput(
	config: ResolvedConfig,
	expectedContent: string,
	includeDiff: boolean,
): Promise<CheckResult> {
	const actualBytes = await readExisting(config.outputPath);
	const expectedBytes = Buffer.from(expectedContent, "utf8");
	if (actualBytes?.equals(expectedBytes)) {
		return { matches: true };
	}

	if (!includeDiff) {
		return { matches: false };
	}

	const label = config.output.replaceAll("\\", "/");
	return {
		matches: false,
		diff: createTwoFilesPatch(
			`a/${label}`,
			`b/${label}`,
			actualBytes?.toString("utf8") ?? "",
			expectedContent,
			"",
			"",
			{ context: 3 },
		),
	};
}
