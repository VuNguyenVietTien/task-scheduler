# DOCS-01 — authority docs update

## Status

DONE

## Outcome

Implemented DEC-001 with minimal edits to `AGENTS.md` and `CLAUDE.md`:

- Added aligned **Mandatory AI Startup Sequence** using only current docs.
- Added aligned **Definition of Done** grounded in code standards, architecture, and deployment constraints.
- Removed stale root README, `.claude/rules/*`, absent docs-tree, and absent `opencode.json` references.
- Preserved CLAUDE-specific privacy-hook and Python skill guidance; Python guidance now points to existing `.claude/skills/INSTALLATION.md`.
- No product, dependency, database, test, deployment, plan, or ledger changes.

## Validation

- Read completely: `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/project-overview-pdr.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/development-roadmap.md`, `docs/deployment.md`, `plans/260907-wip-handoff-continuation/decision-ledger.md`, and `plans/reports/herdr-pm-260907-1105-wip-handoff/REVIEW-01.md`.
- Loaded required skills: `ak-docs`, `ak-cook`; applied agent-context and documentation-content guidance.
- Root `README.md` existence check: absent; no root README read.
- Reference scan: PASS; no `./README.md` or `.claude/rules` references in either authority file.
- Local path checks: PASS for all referenced paths: `docs/README.md`, `docs/project-overview-pdr.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/development-roadmap.md`, `docs/deployment.md`, `.claude/skills/`, `.claude/skills/INSTALLATION.md`.
- `git diff --check`: PASS.
- Tracked diff names: only `AGENTS.md` and `CLAUDE.md`.
- App tests/build/deployment: not run; docs-only scope with no source, dependency, runtime, or deployment changes.
- No commit, push, deploy, network, credential, secret, database, migration, or destructive action performed.

## Sanitized git status

Before:

```text
?? NUL
?? plans/260907-wip-handoff-continuation/
?? plans/reports/herdr-pm-260907-1105-wip-handoff/
```

After:

```text
 M AGENTS.md
 M CLAUDE.md
?? NUL
?? plans/260907-wip-handoff-continuation/
?? plans/reports/chrome-gantt-members-20260907.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/
```

`NUL` and PM artifacts were preserved. The `chrome-gantt-members-20260907.md` artifact was observed but not read or modified.

## Notes

A harness-side scripted reference probe failed closed (`scout-block.cjs`, exit 70); equivalent direct stale-reference, path-existence, diff, and status checks passed.

## Unresolved questions

None.
