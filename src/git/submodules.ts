import { spawn } from "node:child_process";
import { posix, resolve } from "node:path";

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

interface RepositoryLocation {
	root: string;
	projectPrefix: string;
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

async function findRepositoryLocation(
	projectRoot: string,
): Promise<RepositoryLocation> {
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
	const prefix = await runGit(
		projectRoot,
		["rev-parse", "--show-prefix"],
		"locating the project root within the worktree",
	);
	return {
		root: resolve(lines.slice(1).join("\n")),
		projectPrefix: portablePath(prefix.stdout.trim()),
	};
}

async function assertCleanIfInitialized(
	repositoryRoot: string,
	target: SubmoduleTarget,
): Promise<void> {
	const status = await runGit(
		repositoryRoot,
		["submodule", "status", "--", target.repositoryPath],
		`checking submodule ${target.configuredPath}`,
		[0, 1],
	);
	if (status.exitCode !== 0 || status.stdout.trim().length === 0) {
		throw new AgentsComposeError(
			appendGitStderr(
				`Path is not a submodule registered in .gitmodules: ${target.configuredPath}`,
				status.stderr,
			),
		);
	}
	if (status.stdout.startsWith("-")) {
		return;
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
	const repository = await findRepositoryLocation(config.projectRoot);
	const targets = config.gitSubmodules.map((configuredPath) => {
		const absolutePath = resolve(config.projectRoot, configuredPath);
		return {
			configuredPath,
			absolutePath,
			repositoryPath: posix.join(repository.projectPrefix, configuredPath),
		};
	});

	for (const target of targets) {
		await assertCleanIfInitialized(repository.root, target);
	}

	if (targets.length > 0) {
		await runGit(
			repository.root,
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
