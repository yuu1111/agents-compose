import type { ResolvedConfig } from "@/config";
import { discoverSources } from "@/core/discover";
import { type RenderedSource, render } from "@/core/render";
import { transformSource } from "@/core/transform";
import { readUtf8 } from "@/io/utf8";

export interface ComposeResult {
	content: string;
	sources: string[];
}

async function loadSource(
	source: Awaited<ReturnType<typeof discoverSources>>[number],
	stripFrontmatter: boolean,
): Promise<RenderedSource> {
	const content = await readUtf8(
		source.absolutePath,
		`source file ${source.relativePath}`,
	);
	return {
		relativePath: source.relativePath,
		content: transformSource(content, stripFrontmatter),
	};
}

export async function compose(config: ResolvedConfig): Promise<ComposeResult> {
	const sourceFiles = await discoverSources(config);
	const renderedSources = await Promise.all(
		sourceFiles.map((source) => loadSource(source, config.stripFrontmatter)),
	);

	return {
		content: render(config, renderedSources),
		sources: renderedSources.map((source) => source.relativePath),
	};
}
