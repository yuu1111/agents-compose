# PowerShell pre-commit example

Copy `pre-commit` into `.githooks/pre-commit`, then enable tracked hooks:

```console
git config core.hooksPath .githooks
```

The hook invokes PowerShell 7, generates `AGENTS.md`, and stages it.
