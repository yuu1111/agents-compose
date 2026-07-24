import { readFile } from "node:fs/promises";

import { AgentsComposeError } from "@/shared/errors";

const decoder = new TextDecoder("utf-8", { fatal: true });

export function decodeUtf8(bytes: Uint8Array, label: string): string {
	try {
		return decoder.decode(bytes).replace(/^\uFEFF/, "");
	} catch (error) {
		throw new AgentsComposeError(`${label} is not valid UTF-8.`, {
			cause: error,
		});
	}
}

export async function readUtf8(path: string, label: string): Promise<string> {
	let bytes: Uint8Array;
	try {
		bytes = await readFile(path);
	} catch (error) {
		throw new AgentsComposeError(`Unable to read ${label}.`, { cause: error });
	}
	return decodeUtf8(bytes, label);
}
