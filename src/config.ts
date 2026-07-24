import { dirname, isAbsolute, relative, resolve, win32 } from "node:path";

import { isDynamicPattern } from "tinyglobby";

import { AgentsComposeError } from "@/errors";
import { readUtf8 } from "@/utf8";

export const DEFAULT_CONFIG_NAME = "agents-compose.json";

const knownKeys = new Set([
	"$schema",
	"version",
	"output",
	"sources",
	"exclude",
	"stripFrontmatter",
	"sourceComments",
	"generatedHeader",
]);

export interface ComposeOptions {
	version: 1;
	output: string;
	sources: string[];
	exclude: string[];
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
	key: "sources" | "exclude",
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
	key: "stripFrontmatter" | "sourceComments" | "generatedHeader",
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

export function parseConfig(rawValue: unknown): ComposeOptions {
	if (!isRecord(rawValue)) {
		throw new AgentsComposeError("Configuration must be a JSON object.");
	}

	for (const key of Object.keys(rawValue)) {
		if (!knownKeys.has(key)) {
			throw new AgentsComposeError(`Unknown configuration key: ${key}`);
		}
	}

	if (rawValue.version !== 1) {
		throw new AgentsComposeError("version must be 1.");
	}
	if (rawValue.$schema !== undefined && typeof rawValue.$schema !== "string") {
		throw new AgentsComposeError("$schema must be a string.");
	}

	const outputValue = rawValue.output ?? "AGENTS.md";
	if (typeof outputValue !== "string") {
		throw new AgentsComposeError("output must be a string.");
	}
	const output = normalizeRelativePath(outputValue, "output");
	if (isDynamicPattern(output, { caseSensitiveMatch: true })) {
		throw new AgentsComposeError("output must not contain a glob pattern.");
	}

	return {
		version: 1,
		output,
		sources: readStringArray(rawValue, "sources", true),
		exclude: readStringArray(rawValue, "exclude", false),
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
