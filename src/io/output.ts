import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { readOptionalRegularFile } from "@/io/files";
import { AgentsComposeError } from "@/shared/errors";

export interface WriteResult {
	changed: boolean;
}

export async function writeOutput(
	path: string,
	content: string,
): Promise<WriteResult> {
	const bytes = Buffer.from(content, "utf8");
	const existing = await readOptionalRegularFile(path, "Output");
	if (existing?.equals(bytes)) {
		return { changed: false };
	}

	const directory = dirname(path);
	await mkdir(directory, { recursive: true });
	const temporaryPath = join(
		directory,
		`.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
	);

	try {
		await writeFile(temporaryPath, bytes, { flag: "wx" });
		await rename(temporaryPath, path);
	} catch (error) {
		await rm(temporaryPath, { force: true }).catch(() => undefined);
		throw new AgentsComposeError(`Unable to write output file ${path}.`, {
			cause: error,
		});
	}

	return { changed: true };
}
