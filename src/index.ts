export {
	type ComposeOptions,
	DEFAULT_CONFIG_NAME,
	loadConfig,
	parseConfig,
	type ResolvedConfig,
} from "@/config";
export { type ComposeResult, compose } from "@/core/compose";
export { discoverSources, type SourceFile } from "@/core/discover";
export { GENERATED_HEADER, type RenderedSource, render } from "@/core/render";
export {
	normalizeNewlines,
	stripLeadingFrontmatter,
	transformSource,
	trimEdgeBlankLines,
} from "@/core/transform";
export { type CheckResult, checkOutput } from "@/io/check";
export { type WriteResult, writeOutput } from "@/io/output";
export { AgentsComposeError } from "@/shared/errors";
