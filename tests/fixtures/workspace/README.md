# Workspace fixture

The workspace fixture is an anonymized, minimal reproduction of the source ordering and transformation rules used by the original PowerShell generator.

It covers:

- a literal source followed by an overlapping glob
- deterministic ordering within a glob
- duplicate removal
- exclusion after expansion
- frontmatter removal per source
- preservation of a horizontal rule in the body
- Japanese UTF-8 content
- source comments and the generated header

The full private workspace is reserved for dogfooding and is not copied into the public test fixture.
