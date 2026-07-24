import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const fixtureRoot = join(projectRoot, "tests", "fixtures", "workspace");

export async function withTempDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), "agents-compose-test-"));
	try {
		return await run(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function writeText(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
}

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function runCli(args: string[], cwd: string): Promise<CommandResult> {
	const cliPath = join(projectRoot, "src", "cli.ts");
	return await new Promise((resolveResult, reject) => {
		const child = spawn(process.execPath, [cliPath, ...args], {
			cwd,
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
	});
}
