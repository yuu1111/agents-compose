import { describe, expect, test } from "bun:test";

import {
	normalizeNewlines,
	stripLeadingFrontmatter,
	transformSource,
	trimEdgeBlankLines,
} from "@/transform";

describe("normalizeNewlines", () => {
	test("normalizes CRLF and CR to LF", () => {
		expect(normalizeNewlines("a\r\nb\rc\n")).toBe("a\nb\nc\n");
	});
});

describe("stripLeadingFrontmatter", () => {
	test("removes only a complete leading block", () => {
		expect(stripLeadingFrontmatter("---\ntitle: Test\n---\n# Body")).toBe(
			"# Body",
		);
	});

	test("keeps a block without a closing delimiter", () => {
		expect(stripLeadingFrontmatter("---\ntitle: Test\n# Body")).toBe(
			"---\ntitle: Test\n# Body",
		);
	});

	test("does not mistake a prefixed delimiter for the closing line", () => {
		expect(stripLeadingFrontmatter("---\n---not-a-delimiter\n---\nBody")).toBe(
			"Body",
		);
	});

	test("keeps horizontal rules in the body", () => {
		expect(stripLeadingFrontmatter("# Body\n\n---\n\nText")).toBe(
			"# Body\n\n---\n\nText",
		);
	});
});

describe("trimEdgeBlankLines", () => {
	test("removes edge blank lines without changing content whitespace", () => {
		expect(trimEdgeBlankLines("\n \t\n  indented  \n\n")).toBe("  indented  ");
	});
});

describe("transformSource", () => {
	test("normalizes before stripping frontmatter", () => {
		expect(
			transformSource("---\r\ncreated: now\r\n---\r\n\r\n本文\r\n", true),
		).toBe("本文");
	});

	test("can preserve frontmatter", () => {
		expect(transformSource("---\na: b\n---\nBody", false)).toBe(
			"---\na: b\n---\nBody",
		);
	});
});
