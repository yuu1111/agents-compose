import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
	type CommandResult,
	runCli,
	withTempDirectory,
	writeText,
} from "../helpers";

const identity = [
	"-c",
	"user.name=agents-compose tests",
	"-c",
	"user.email=agents-compose@example.invalid",
];

async function git(cwd: string, args: string[]): Promise<CommandResult> {
	return await new Promise<CommandResult>((resolveResult, reject) => {
		const child = spawn("git", ["-C", cwd, ...args], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (exitCode) => {
			resolveResult({ exitCode: exitCode ?? -1, stdout, stderr });
		});
	}).then((result) => {
		if (result.exitCode !== 0) {
			throw new Error(`git ${args.join(" ")} failed:\n${result.stderr}`);
		}
		return result;
	});
}

interface RepositoryFixture {
	consumer: string;
	upstream: string;
	submodulePath: string;
}

async function createRepositoryFixture(
	directory: string,
): Promise<RepositoryFixture> {
	const upstream = join(directory, "upstream");
	const remote = join(directory, "shared.git");
	const consumer = join(directory, "consumer");
	const submodulePath = ".agents/rules/shared";

	await writeText(join(upstream, "rules.md"), "# Shared v1\n");
	await git(upstream, ["init", "--initial-branch=main"]);
	await git(upstream, ["add", "rules.md"]);
	await git(upstream, [...identity, "commit", "-m", "initial shared rules"]);
	await git(directory, ["clone", "--bare", upstream, remote]);

	await writeText(
		join(consumer, "agents-compose.json"),
		JSON.stringify({
			version: 1,
			sources: [`${submodulePath}/rules.md`],
			gitSubmodules: [submodulePath],
		}),
	);
	await git(consumer, ["init", "--initial-branch=main"]);
	await git(consumer, [
		"-c",
		"protocol.file.allow=always",
		"submodule",
		"add",
		"--branch",
		"main",
		remote,
		submodulePath,
	]);
	await git(consumer, ["add", "."]);
	await git(consumer, [...identity, "commit", "-m", "add shared rules"]);

	return { consumer, upstream, submodulePath };
}

const fileProtocol = { GIT_ALLOW_PROTOCOL: "file" };

describe("sync CLI", () => {
	test("initializes an uninitialized submodule and generates AGENTS.md", async () => {
		await withTempDirectory(async (directory) => {
			const fixture = await createRepositoryFixture(directory);
			await git(fixture.consumer, [
				"submodule",
				"deinit",
				"--force",
				"--",
				fixture.submodulePath,
			]);

			const result = await runCli(["sync"], fixture.consumer, fileProtocol);

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toContain("Generated AGENTS.md");
			expect(
				await readFile(join(fixture.consumer, "AGENTS.md"), "utf8"),
			).toContain("# Shared v1");
		});
	}, 60_000);

	test("tracks the configured branch and regenerates after an upstream update", async () => {
		await withTempDirectory(async (directory) => {
			const fixture = await createRepositoryFixture(directory);
			await writeText(join(fixture.upstream, "rules.md"), "# Shared v2\n");
			await git(fixture.upstream, ["add", "rules.md"]);
			await git(fixture.upstream, [
				...identity,
				"commit",
				"-m",
				"update shared rules",
			]);
			await git(fixture.upstream, [
				"push",
				join(directory, "shared.git"),
				"main",
			]);

			const result = await runCli(["sync"], fixture.consumer, fileProtocol);

			expect(result.exitCode).toBe(0);
			expect(
				await readFile(join(fixture.consumer, "AGENTS.md"), "utf8"),
			).toContain("# Shared v2");
		});
	}, 60_000);

	test("rejects a dirty initialized submodule before updating", async () => {
		await withTempDirectory(async (directory) => {
			const fixture = await createRepositoryFixture(directory);
			await writeText(
				join(fixture.consumer, fixture.submodulePath, "rules.md"),
				"# Dirty\n",
			);

			const result = await runCli(["sync"], fixture.consumer, fileProtocol);

			expect(result.exitCode).toBe(2);
			expect(result.stderr).toContain(
				`Submodule has uncommitted changes: ${fixture.submodulePath}`,
			);
		});
	}, 60_000);

	test("rejects a path that is not registered in .gitmodules", async () => {
		await withTempDirectory(async (directory) => {
			const fixture = await createRepositoryFixture(directory);
			await writeText(
				join(fixture.consumer, "agents-compose.json"),
				JSON.stringify({
					version: 1,
					sources: [`${fixture.submodulePath}/rules.md`],
					gitSubmodules: [".agents/rules/missing"],
				}),
			);

			const result = await runCli(["sync"], fixture.consumer, fileProtocol);

			expect(result.exitCode).toBe(2);
			expect(result.stderr).toContain(
				"not a submodule registered in .gitmodules",
			);
			expect(result.stderr).toContain(".agents/rules/missing");
		});
	}, 60_000);

	test("returns exit code 2 outside a Git worktree", async () => {
		await withTempDirectory(async (directory) => {
			await writeText(
				join(directory, "agents-compose.json"),
				JSON.stringify({ version: 1, sources: ["rules.md"] }),
			);
			await writeText(join(directory, "rules.md"), "# Rules\n");

			const result = await runCli(["sync"], directory);

			expect(result.exitCode).toBe(2);
			expect(result.stderr).toContain(
				"Git failed while verifying the project worktree",
			);
		});
	}, 60_000);

	test("preserves Git diagnostics when an update fails", async () => {
		await withTempDirectory(async (directory) => {
			const fixture = await createRepositoryFixture(directory);
			await git(join(fixture.consumer, fixture.submodulePath), [
				"remote",
				"set-url",
				"origin",
				join(directory, "missing.git"),
			]);

			const result = await runCli(["sync"], fixture.consumer, fileProtocol);

			expect(result.exitCode).toBe(2);
			expect(result.stderr).toContain(
				"Git failed while updating declared submodules",
			);
			expect(result.stderr).toContain("fatal:");
		});
	}, 60_000);
});
