import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { parseArguments } from "@/cli/arguments";

const currentDirectory = resolve("workspace", "project");

describe("parseArguments", () => {
	test.each([
		[[], "help"],
		[["--help"], "help"],
		[["-h"], "help"],
		[["--version"], "version"],
		[["-v"], "version"],
	] as const)("recognizes global option %#", (args, expected) => {
		expect(parseArguments([...args], currentDirectory)).toBe(expected);
	});

	test("applies defaults and resolves an explicit configuration path", () => {
		expect(parseArguments(["build", "--stdout"], currentDirectory)).toEqual({
			command: "build",
			configPath: resolve(currentDirectory, "agents-compose.json"),
			stdout: true,
			diff: false,
		});
		expect(
			parseArguments(
				["check", "--config", "config/custom.json", "--diff"],
				currentDirectory,
			),
		).toEqual({
			command: "check",
			configPath: resolve(currentDirectory, "config", "custom.json"),
			stdout: false,
			diff: true,
		});
		expect(parseArguments(["sync"], currentDirectory)).toEqual({
			command: "sync",
			configPath: resolve(currentDirectory, "agents-compose.json"),
			stdout: false,
			diff: false,
		});
	});

	test.each([
		[["unknown"], "Unknown command"],
		[["build", "--unknown"], "Unknown option"],
		[["build", "--config"], "--config requires a path"],
		[["build", "--diff"], "--diff can only be used with check"],
		[["check", "--stdout"], "--stdout can only be used with build"],
		[["sync", "--stdout"], "sync only accepts --config"],
		[["sync", "--diff"], "sync only accepts --config"],
	])("rejects invalid arguments %#", (args, message) => {
		expect(() => parseArguments(args, currentDirectory)).toThrow(message);
	});
});
