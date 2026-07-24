import { createTwoFilesPatch } from "diff";

import type { ResolvedConfig } from "@/config";
import { readOptionalRegularFile } from "@/io/files";

export interface CheckResult {
	matches: boolean;
	diff?: string;
}

export async function checkOutput(
	config: ResolvedConfig,
	expectedContent: string,
	includeDiff: boolean,
): Promise<CheckResult> {
	const actualBytes = await readOptionalRegularFile(
		config.outputPath,
		"Output",
	);
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
