import { spawn } from "node:child_process";
import { relative, resolve } from "node:path";

import type { ResolvedConfig } from "@/config";
import { AgentsComposeError } from "@/shared/errors";

interface GitResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

interface SubmoduleTarget {
	configuredPath: string;
	repositoryPath: string;
	absolutePath: string;
}

function portablePath(path: string): string {
	return path.replaceAll("\\", "/");
}

function appendGitStderr(message: string, stderr: string): string {
	const detail = stderr.trim();
	return detail.length === 0 ? message : `${message}\n${detail}`;
}

async function runGit(
	cwd: string,
	args: string[],
	context: string,
	allowedExitCodes: readonly number[] = [0],
): Promise<GitResult> {
	const result = await new Promise<GitResult>((resolveResult, reject) => {
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
	}).catch((error: unknown) => {
		throw new AgentsComposeError(`Unable to run Git while ${context}.`, {
			cause: error,
		});
	});

	if (!allowedExitCodes.includes(result.exitCode)) {
		throw new AgentsComposeError(
			appendGitStderr(
				`Git failed while ${context} (exit code ${result.exitCode}).`,
				result.stderr,
			),
		);
	}
	return result;
}

async function findRepositoryRoot(projectRoot: string): Promise<string> {
	const result = await runGit(
		projectRoot,
		["rev-parse", "--is-inside-work-tree", "--show-toplevel"],
		"verifying the project worktree",
	);
	const lines = result.stdout.trim().split(/\r?\n/u);
	if (lines[0] !== "true" || lines[1] === undefined) {
		throw new AgentsComposeError(
			`Project root is not inside a Git worktree: ${projectRoot}`,
		);
	}
	return resolve(lines.slice(1).join("\n"));
}

async function registeredSubmodulePaths(
	repositoryRoot: string,
): Promise<Set<string>> {
	const result = await runGit(
		repositoryRoot,
		[
			"config",
			"--file",
			resolve(repositoryRoot, ".gitmodules"),
			"--get-regexp",
			"^submodule\\..*\\.path$",
		],
		"reading .gitmodules",
		[0, 1],
	);
	const paths = new Set<string>();
	for (const line of result.stdout.split(/\r?\n/u)) {
		const separator = line.search(/\s/u);
		if (separator >= 0) {
			paths.add(portablePath(line.slice(separator).trim()));
		}
	}
	return paths;
}

async function assertCleanIfInitialized(
	repositoryRoot: string,
	target: SubmoduleTarget,
): Promise<void> {
	const status = await runGit(
		repositoryRoot,
		["submodule", "status", "--", target.repositoryPath],
		`checking submodule ${target.configuredPath}`,
	);
	if (status.stdout.startsWith("-")) {
		return;
	}
	if (status.stdout.trim().length === 0) {
		throw new AgentsComposeError(
			`Unable to determine submodule status: ${target.configuredPath}`,
		);
	}

	const workingTree = await runGit(
		target.absolutePath,
		["status", "--porcelain=v1", "--untracked-files=normal"],
		`checking whether submodule ${target.configuredPath} is dirty`,
	);
	if (workingTree.stdout.length > 0) {
		throw new AgentsComposeError(
			`Submodule has uncommitted changes: ${target.configuredPath}`,
		);
	}
}

export async function syncGitSubmodules(config: ResolvedConfig): Promise<void> {
	const repositoryRoot = await findRepositoryRoot(config.projectRoot);
	const registered = await registeredSubmodulePaths(repositoryRoot);
	const targets = config.gitSubmodules.map((configuredPath) => {
		const absolutePath = resolve(config.projectRoot, configuredPath);
		return {
			configuredPath,
			absolutePath,
			repositoryPath: portablePath(relative(repositoryRoot, absolutePath)),
		};
	});

	for (const target of targets) {
		if (!registered.has(target.repositoryPath)) {
			throw new AgentsComposeError(
				`Path is not a submodule registered in .gitmodules: ${target.configuredPath}`,
			);
		}
	}
	for (const target of targets) {
		await assertCleanIfInitialized(repositoryRoot, target);
	}

	if (targets.length > 0) {
		await runGit(
			repositoryRoot,
			[
				"submodule",
				"update",
				"--init",
				"--remote",
				"--",
				...targets.map((target) => target.repositoryPath),
			],
			"updating declared submodules",
		);
	}
}
