#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkOutput } from "@/check";
import { compose } from "@/compose";
import { DEFAULT_CONFIG_NAME, loadConfig } from "@/config";
import { AgentsComposeError, toErrorMessage } from "@/errors";
import { writeOutput } from "@/output";

const packageMetadata = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const VERSION = packageMetadata.version;

const help = `agents-compose ${VERSION}

Compose ordinary Markdown documents into a deterministic AGENTS.md.

Usage:
  agents-compose build [--config <path>] [--stdout]
  agents-compose check [--config <path>] [--diff]
  agents-compose --help
  agents-compose --version
`;

interface ParsedArguments {
	command: "build" | "check";
	configPath: string;
	stdout: boolean;
	diff: boolean;
}

function parseArguments(args: string[]): ParsedArguments | "help" | "version" {
	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		return "help";
	}
	if (args.includes("--version") || args.includes("-v")) {
		return "version";
	}

	const command = args[0];
	if (command !== "build" && command !== "check") {
		throw new AgentsComposeError(`Unknown command: ${command ?? ""}`);
	}

	let configPath = resolve(process.cwd(), DEFAULT_CONFIG_NAME);
	let stdout = false;
	let diff = false;

	for (let index = 1; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--config") {
			const value = args[index + 1];
			if (value === undefined || value.startsWith("-")) {
				throw new AgentsComposeError("--config requires a path.");
			}
			configPath = resolve(process.cwd(), value);
			index += 1;
			continue;
		}
		if (argument === "--stdout") {
			stdout = true;
			continue;
		}
		if (argument === "--diff") {
			diff = true;
			continue;
		}
		throw new AgentsComposeError(`Unknown option: ${argument ?? ""}`);
	}

	if (command === "build" && diff) {
		throw new AgentsComposeError("--diff can only be used with check.");
	}
	if (command === "check" && stdout) {
		throw new AgentsComposeError("--stdout can only be used with build.");
	}

	return { command, configPath, stdout, diff };
}

async function run(args: string[]): Promise<number> {
	const parsed = parseArguments(args);
	if (parsed === "help") {
		process.stdout.write(help);
		return 0;
	}
	if (parsed === "version") {
		process.stdout.write(`${VERSION}\n`);
		return 0;
	}

	const config = await loadConfig(parsed.configPath);
	const result = await compose(config);

	if (parsed.command === "build") {
		if (parsed.stdout) {
			process.stdout.write(result.content);
			return 0;
		}
		const writeResult = await writeOutput(config.outputPath, result.content);
		process.stderr.write(
			`${writeResult.changed ? "Generated" : "Unchanged"} ${config.output} from ${result.sources.length} source(s).\n`,
		);
		return 0;
	}

	const checkResult = await checkOutput(config, result.content, parsed.diff);
	if (checkResult.matches) {
		process.stderr.write(`${config.output} is up to date.\n`);
		return 0;
	}
	if (checkResult.diff !== undefined) {
		process.stdout.write(checkResult.diff);
	}
	process.stderr.write(`${config.output} is out of date.\n`);
	return 1;
}

run(process.argv.slice(2))
	.then((exitCode) => {
		process.exitCode = exitCode;
	})
	.catch((error: unknown) => {
		const prefix = error instanceof AgentsComposeError ? "Error" : "Unexpected error";
		process.stderr.write(`${prefix}: ${toErrorMessage(error)}\n`);
		process.exitCode = 2;
	});
