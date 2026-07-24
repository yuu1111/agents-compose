#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { type ParsedArguments, parseArguments } from "@/cli/arguments";
import { loadConfig, type ResolvedConfig } from "@/config";
import { type ComposeResult, compose } from "@/core/compose";
import { checkOutput } from "@/io/check";
import { writeOutput } from "@/io/output";
import { AgentsComposeError, toErrorMessage } from "@/shared/errors";

const packageMetadata = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
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

async function runBuild(
	parsed: ParsedArguments,
	config: ResolvedConfig,
	result: ComposeResult,
): Promise<number> {
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

async function runCheck(
	parsed: ParsedArguments,
	config: ResolvedConfig,
	result: ComposeResult,
): Promise<number> {
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

async function run(args: string[]): Promise<number> {
	const parsed = parseArguments(args, process.cwd());
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
		return await runBuild(parsed, config, result);
	}
	return await runCheck(parsed, config, result);
}

export function main(args: string[]): void {
	run(args)
		.then((exitCode) => {
			process.exitCode = exitCode;
		})
		.catch((error: unknown) => {
			const prefix =
				error instanceof AgentsComposeError ? "Error" : "Unexpected error";
			process.stderr.write(`${prefix}: ${toErrorMessage(error)}\n`);
			process.exitCode = 2;
		});
}
