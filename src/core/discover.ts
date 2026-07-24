import type { Stats } from "node:fs";
import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { glob, isDynamicPattern } from "tinyglobby";

import type { ResolvedConfig } from "@/config";
import { AgentsComposeError } from "@/shared/errors";

export interface SourceFile {
	absolutePath: string;
	relativePath: string;
}

const globOptions = {
	caseSensitiveMatch: true,
	dot: false,
	expandDirectories: false,
	followSymbolicLinks: false,
	onlyFiles: true,
} as const;

function toPortablePath(path: string): string {
	return path.replaceAll("\\", "/");
}

function compareCodePoints(left: string, right: string): number {
	const leftCharacters = Array.from(left);
	const rightCharacters = Array.from(right);
	const length = Math.min(leftCharacters.length, rightCharacters.length);

	for (let index = 0; index < length; index += 1) {
		const leftCodePoint = leftCharacters[index]?.codePointAt(0) ?? 0;
		const rightCodePoint = rightCharacters[index]?.codePointAt(0) ?? 0;
		if (leftCodePoint !== rightCodePoint) {
			return leftCodePoint - rightCodePoint;
		}
	}

	return leftCharacters.length - rightCharacters.length;
}

function normalizeGlobMatches(matches: string[]): string[] {
	return matches.map(toPortablePath).sort(compareCodePoints);
}

async function expandSource(
	pattern: string,
	config: ResolvedConfig,
): Promise<string[]> {
	if (isDynamicPattern(pattern, { caseSensitiveMatch: true })) {
		const matches = await glob(pattern, {
			...globOptions,
			cwd: config.projectRoot,
		});
		if (matches.length === 0) {
			throw new AgentsComposeError(
				`Source pattern matched no files: ${pattern}`,
			);
		}
		return normalizeGlobMatches(matches);
	}

	const absolutePath = resolve(config.projectRoot, pattern);
	let stats: Stats;
	try {
		stats = await lstat(absolutePath);
	} catch (error) {
		throw new AgentsComposeError(`Source file does not exist: ${pattern}`, {
			cause: error,
		});
	}
	if (stats.isSymbolicLink()) {
		throw new AgentsComposeError(
			`Literal source must not be a symbolic link: ${pattern}`,
		);
	}
	if (!stats.isFile()) {
		throw new AgentsComposeError(`Source is not a regular file: ${pattern}`);
	}
	return [pattern];
}

async function expandExcludes(config: ResolvedConfig): Promise<Set<string>> {
	if (config.exclude.length === 0) {
		return new Set();
	}
	const matches = await glob(config.exclude, {
		...globOptions,
		cwd: config.projectRoot,
	});
	return new Set(matches.map(toPortablePath));
}

export async function discoverSources(
	config: ResolvedConfig,
): Promise<SourceFile[]> {
	const candidates: string[] = [];
	for (const pattern of config.sources) {
		candidates.push(...(await expandSource(pattern, config)));
	}

	const excluded = await expandExcludes(config);
	const seen = new Set<string>();
	const sources: SourceFile[] = [];

	for (const relativePath of candidates) {
		if (
			relativePath === config.output ||
			excluded.has(relativePath) ||
			seen.has(relativePath)
		) {
			continue;
		}
		seen.add(relativePath);
		sources.push({
			absolutePath: resolve(config.projectRoot, relativePath),
			relativePath,
		});
	}

	if (sources.length === 0) {
		throw new AgentsComposeError("No source files remain after exclusions.");
	}

	return sources;
}
