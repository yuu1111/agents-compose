export function normalizeNewlines(value: string): string {
	return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function stripLeadingFrontmatter(value: string): string {
	if (!value.startsWith("---\n")) {
		return value;
	}

	const lines = value.split("\n");
	const closingLine = lines.findIndex(
		(line, index) => index > 0 && line === "---",
	);
	if (closingLine === -1) {
		return value;
	}

	return lines.slice(closingLine + 1).join("\n");
}

export function trimEdgeBlankLines(value: string): string {
	const lines = value.split("\n");
	let start = 0;
	let end = lines.length;

	while (start < end && /^\s*$/u.test(lines[start] ?? "")) {
		start += 1;
	}
	while (end > start && /^\s*$/u.test(lines[end - 1] ?? "")) {
		end -= 1;
	}

	return lines.slice(start, end).join("\n");
}

export function transformSource(
	value: string,
	stripFrontmatter: boolean,
): string {
	const normalized = normalizeNewlines(value);
	const transformed = stripFrontmatter
		? stripLeadingFrontmatter(normalized)
		: normalized;
	return trimEdgeBlankLines(transformed);
}
