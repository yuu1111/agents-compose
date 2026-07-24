export { type CheckResult, checkOutput } from "@/check";
export { type ComposeResult, compose } from "@/compose";
export {
	type ComposeOptions,
	DEFAULT_CONFIG_NAME,
	loadConfig,
	parseConfig,
	type ResolvedConfig,
} from "@/config";
export { discoverSources, type SourceFile } from "@/discover";
export { AgentsComposeError } from "@/errors";
export { type WriteResult, writeOutput } from "@/output";
export { GENERATED_HEADER, type RenderedSource, render } from "@/render";
export {
	normalizeNewlines,
	stripLeadingFrontmatter,
	transformSource,
	trimEdgeBlankLines,
} from "@/transform";
