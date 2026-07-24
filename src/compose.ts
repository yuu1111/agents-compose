import type { ResolvedConfig } from "@/config";
import { discoverSources } from "@/discover";
import { render } from "@/render";
import { transformSource } from "@/transform";
import { readUtf8 } from "@/utf8";

export interface ComposeResult {
	content: string;
	sources: string[];
}

export async function compose(config: ResolvedConfig): Promise<ComposeResult> {
	const sourceFiles = await discoverSources(config);
	const renderedSources = await Promise.all(
		sourceFiles.map(async (source) => ({
			relativePath: source.relativePath,
			content: transformSource(
				await readUtf8(
					source.absolutePath,
					`source file ${source.relativePath}`,
				),
				config.stripFrontmatter,
			),
		})),
	);

	return {
		content: render(config, renderedSources),
		sources: sourceFiles.map((source) => source.relativePath),
	};
}
