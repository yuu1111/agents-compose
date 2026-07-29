import { resolve } from "node:path";

import { DEFAULT_CONFIG_NAME } from "@/config";
import { AgentsComposeError } from "@/shared/errors";

export interface ParsedArguments {
	command: "build" | "check" | "sync";
	configPath: string;
	stdout: boolean;
	diff: boolean;
}

export type ArgumentParseResult = ParsedArguments | "help" | "version";

export function parseArguments(
	args: string[],
	currentDirectory: string,
): ArgumentParseResult {
	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		return "help";
	}
	if (args.includes("--version") || args.includes("-v")) {
		return "version";
	}

	const command = args[0];
	if (command !== "build" && command !== "check" && command !== "sync") {
		throw new AgentsComposeError(`Unknown command: ${command ?? ""}`);
	}

	let configPath = resolve(currentDirectory, DEFAULT_CONFIG_NAME);
	let stdout = false;
	let diff = false;

	for (let index = 1; index < args.length; index += 1) {
		const argument = args[index];
		switch (argument) {
			case "--config": {
				const value = args[index + 1];
				if (value === undefined || value.startsWith("-")) {
					throw new AgentsComposeError("--config requires a path.");
				}
				configPath = resolve(currentDirectory, value);
				index += 1;
				break;
			}
			case "--stdout":
				stdout = true;
				break;
			case "--diff":
				diff = true;
				break;
			default:
				throw new AgentsComposeError(`Unknown option: ${argument ?? ""}`);
		}
	}

	if (command === "build" && diff) {
		throw new AgentsComposeError("--diff can only be used with check.");
	}
	if (command === "check" && stdout) {
		throw new AgentsComposeError("--stdout can only be used with build.");
	}
	if (command === "sync" && (stdout || diff)) {
		throw new AgentsComposeError("sync only accepts --config.");
	}

	return { command, configPath, stdout, diff };
}
