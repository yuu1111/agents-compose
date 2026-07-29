import {
	dirname,
	isAbsolute,
	posix,
	relative,
	resolve,
	win32,
} from "node:path";

import { isDynamicPattern } from "tinyglobby";

import { readUtf8 } from "@/io/utf8";
import { AgentsComposeError } from "@/shared/errors";

export const DEFAULT_CONFIG_NAME = "agents-compose.json";

const CONFIG_KEYS = [
	"$schema",
	"version",
	"output",
	"sources",
	"exclude",
	"gitSubmodules",
	"stripFrontmatter",
	"sourceComments",
	"generatedHeader",
] as const;
const knownKeys: ReadonlySet<string> = new Set(CONFIG_KEYS);

type StringArrayKey = "sources" | "exclude";
type BooleanKey = "stripFrontmatter" | "sourceComments" | "generatedHeader";

export interface ComposeOptions {
	version: 1;
	output: string;
	sources: string[];
	exclude: string[];
	gitSubmodules: string[];
	stripFrontmatter: boolean;
	sourceComments: boolean;
	generatedHeader: boolean;
}

export interface ResolvedConfig extends ComposeOptions {
	configPath: string;
	projectRoot: string;
	outputPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRelativePath(value: string, field: string): string {
	if (value.trim().length === 0 || /[\r\n\0]/u.test(value)) {
		throw new AgentsComposeError(
			`${field} must be a non-empty single-line path.`,
		);
	}

	const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
	if (normalized.startsWith("!")) {
		throw new AgentsComposeError(
			`${field} must not use a negative glob pattern: ${value}`,
		);
	}
	if (
		isAbsolute(normalized) ||
		win32.isAbsolute(normalized) ||
		normalized.startsWith("/") ||
		normalized.split("/").includes("..")
	) {
		throw new AgentsComposeError(
			`${field} must stay within the project root: ${value}`,
		);
	}

	if (normalized === "" || normalized === ".") {
		throw new AgentsComposeError(`${field} must identify a file or pattern.`);
	}

	return normalized;
}

function readStringArray(
	raw: Record<string, unknown>,
	key: StringArrayKey,
	required: boolean,
): string[] {
	const value = raw[key];
	if (value === undefined) {
		if (required) {
			throw new AgentsComposeError(
				`Missing required configuration key: ${key}`,
			);
		}
		return [];
	}
	if (!Array.isArray(value) || (required && value.length === 0)) {
		throw new AgentsComposeError(
			`${key} must be ${required ? "a non-empty" : "an"} array.`,
		);
	}
	return value.map((item, index) => {
		if (typeof item !== "string") {
			throw new AgentsComposeError(`${key}[${index}] must be a string.`);
		}
		return normalizeRelativePath(item, `${key}[${index}]`);
	});
}

function readBoolean(
	raw: Record<string, unknown>,
	key: BooleanKey,
	defaultValue: boolean,
): boolean {
	const value = raw[key];
	if (value === undefined) {
		return defaultValue;
	}
	if (typeof value !== "boolean") {
		throw new AgentsComposeError(`${key} must be a boolean.`);
	}
	return value;
}

function readGitSubmodules(raw: Record<string, unknown>): string[] {
	const value = raw.gitSubmodules;
	if (value === undefined) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw new AgentsComposeError("gitSubmodules must be an array.");
	}

	const seen = new Set<string>();
	return value.map((item, index) => {
		if (typeof item !== "string") {
			throw new AgentsComposeError(`gitSubmodules[${index}] must be a string.`);
		}
		const path = posix
			.normalize(normalizeRelativePath(item, `gitSubmodules[${index}]`))
			.replace(/\/+$/u, "");
		if (path === "" || path === ".") {
			throw new AgentsComposeError(
				`gitSubmodules[${index}] must identify a submodule path.`,
			);
		}
		if (isDynamicPattern(path, { caseSensitiveMatch: true })) {
			throw new AgentsComposeError(
				`gitSubmodules[${index}] must not contain a glob pattern.`,
			);
		}
		if (seen.has(path)) {
			throw new AgentsComposeError(`Duplicate gitSubmodules path: ${path}`);
		}
		seen.add(path);
		return path;
	});
}

function assertKnownKeys(raw: Record<string, unknown>): void {
	for (const key of Object.keys(raw)) {
		if (!knownKeys.has(key)) {
			throw new AgentsComposeError(`Unknown configuration key: ${key}`);
		}
	}
}

function readOutput(raw: Record<string, unknown>): string {
	const value = raw.output ?? "AGENTS.md";
	if (typeof value !== "string") {
		throw new AgentsComposeError("output must be a string.");
	}

	const output = normalizeRelativePath(value, "output");
	if (isDynamicPattern(output, { caseSensitiveMatch: true })) {
		throw new AgentsComposeError("output must not contain a glob pattern.");
	}
	return output;
}

export function parseConfig(rawValue: unknown): ComposeOptions {
	if (!isRecord(rawValue)) {
		throw new AgentsComposeError("Configuration must be a JSON object.");
	}

	assertKnownKeys(rawValue);

	if (rawValue.version !== 1) {
		throw new AgentsComposeError("version must be 1.");
	}
	if (rawValue.$schema !== undefined && typeof rawValue.$schema !== "string") {
		throw new AgentsComposeError("$schema must be a string.");
	}

	return {
		version: 1,
		output: readOutput(rawValue),
		sources: readStringArray(rawValue, "sources", true),
		exclude: readStringArray(rawValue, "exclude", false),
		gitSubmodules: readGitSubmodules(rawValue),
		stripFrontmatter: readBoolean(rawValue, "stripFrontmatter", true),
		sourceComments: readBoolean(rawValue, "sourceComments", true),
		generatedHeader: readBoolean(rawValue, "generatedHeader", true),
	};
}

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
	const absoluteConfigPath = resolve(configPath);
	const projectRoot = dirname(absoluteConfigPath);
	const text = await readUtf8(
		absoluteConfigPath,
		`configuration file ${absoluteConfigPath}`,
	);

	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		throw new AgentsComposeError(`Invalid JSON in ${absoluteConfigPath}.`, {
			cause: error,
		});
	}

	const config = parseConfig(raw);
	const outputPath = resolve(projectRoot, config.output);
	const relativeOutput = relative(projectRoot, outputPath);
	if (relativeOutput.startsWith("..") || isAbsolute(relativeOutput)) {
		throw new AgentsComposeError(
			`output must stay within the project root: ${config.output}`,
		);
	}

	return {
		...config,
		configPath: absoluteConfigPath,
		projectRoot,
		outputPath,
	};
}
