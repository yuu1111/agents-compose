import { lstat, readFile } from "node:fs/promises";

import { AgentsComposeError } from "@/shared/errors";

function isMissingFileError(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}

export async function readOptionalRegularFile(
	path: string,
	label: string,
): Promise<Buffer | undefined> {
	try {
		const stats = await lstat(path);
		if (stats.isSymbolicLink()) {
			throw new AgentsComposeError(
				`${label} must not be a symbolic link: ${path}`,
			);
		}
		if (!stats.isFile()) {
			throw new AgentsComposeError(`${label} is not a regular file: ${path}`);
		}
		return await readFile(path);
	} catch (error) {
		if (isMissingFileError(error)) {
			return undefined;
		}
		throw error;
	}
}
