import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { AgentsComposeError } from "@/errors";

export interface WriteResult {
	changed: boolean;
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

export async function writeOutput(path: string, content: string): Promise<WriteResult> {
	const bytes = Buffer.from(content, "utf8");
	const existing = await readExisting(path);
	if (existing?.equals(bytes)) {
		return { changed: false };
	}

	const directory = dirname(path);
	await mkdir(directory, { recursive: true });
	const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);

	try {
		await writeFile(temporaryPath, bytes, { flag: "wx" });
		await rename(temporaryPath, path);
	} catch (error) {
		await rm(temporaryPath, { force: true }).catch(() => undefined);
		throw new AgentsComposeError(`Unable to write output file ${path}.`, { cause: error });
	}

	return { changed: true };
}
