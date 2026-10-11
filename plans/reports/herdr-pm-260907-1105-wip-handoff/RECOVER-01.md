# RECOVER-01 — verified continuation plan

## Decision
No safe product-code implementation node exists. The branch diff is only local session-state cleanup; remaining issue is docs/process authority gap. IMPL-01 skipped for code.

## Comparison base
- Base: `f81381a` (`HEAD^`).
- Why: `git branch -a -vv` shows only `codex/wip-handoff-20260906` and `origin/codex/wip-handoff-20260906`; no `origin/main`/`origin/master`.
- `git merge-base HEAD HEAD^` = `f81381a`.
- `git rev-list --left-right --count HEAD...HEAD^` = `1 0`.
- Therefore `HEAD^` is the correct comparison base.

## Authority status
- `AGENTS.md` and `CLAUDE.md` both require `./README.md` and `./.claude/rules/*`.
- Root `README.md`: absent (`test -f README.md` => absent).
- `./.claude/rules/`: absent (`find .claude/rules -maxdepth 1 -type f` => empty).
- Result: no canonical Mandatory AI Startup Sequence or Definition of Done in this snapshot.
- Effect: blocks claiming policy compliance; no safe product-code IMPL until authority docs are restored or references rewritten.

## WIP classification
### intentional cleanup
Paths:
- `.claude/session-state/archive/20260415-1734.md`
- `.claude/session-state/archive/20260415-1735.md`
- `.claude/session-state/archive/20260415-1740.md`
- `.claude/session-state/archive/20260415-1743.md`
- `.claude/session-state/archive/20260415-1747.md`
- `.claude/session-state/latest.md`
- `.gitignore`

Evidence: `git show --name-only HEAD^..HEAD` and `git diff --stat HEAD^..HEAD -- .gitignore .claude/session-state`.
Behavior impact: none on app/runtime; only stops local session-state churn from being tracked.
Confidence: high.

### docs/process gap
Paths:
- `plans/260907-wip-handoff-continuation/project-ledger.md`
- `plans/reports/herdr-pm-260907-1105-wip-handoff/SCOUT-01.md`
- `plans/reports/herdr-pm-260907-1105-wip-handoff/ledger.md`
- `plans/reports/herdr-pm-260907-1105-wip-handoff/runtimes.json`

Evidence: untracked PM-ledger/report artifacts in `git status --short -uall`.
Behavior impact: none on app/runtime.
Confidence: high.

### product defect
- None found.

Evidence: no source code diff in `HEAD^..HEAD`; commit only touched session-state cleanup.
Behavior impact: none.
Confidence: high.

### test gap
- None found.

Evidence: no code path changed; targeted verification is read-only and enough for this WIP.
Behavior impact: none.
Confidence: high.

### unknown
Path:
- `NUL`

Evidence: `git status --short -uall`.
Behavior impact: unknown local artifact; preserve untouched.
Confidence: medium.

Note: SCOUT-01R failed before work because provider rejected the model; no report to classify.

## Continuation DAG
| Node | Ownership | Reads | Writes | Acceptance | Stop condition | Status |
|---|---|---|---|---|---|---|
| RECOVER-01 | report-only | git refs/history/status, SCOUT-01, project-ledger, docs manifests | `plans/reports/herdr-pm-260907-1105-wip-handoff/RECOVER-01.md` | base confirmed, authority status confirmed, all WIP classified | stop after report write | done |
| IMPL-01 | skipped | none | none | only if a real source diff exists | no confirmed code defect; no safe product-code node | skipped |
| TEST-01 | read-only | git status, `HEAD^..HEAD`, `.gitignore`, `.claude/session-state`, README/rules presence | none | expected untracked PM artifacts only; no unexpected tracked code diffs; README/rules still absent | any source diff or new behavior evidence => stop and re-scope | ready if needed |
| REVIEW-01 | read-only | RECOVER-01 + git evidence | none | agrees on base, authority gap, and file classification; confirms no product-code IMPL | any disagreement on base or classification => stop | ready if needed |
| Final handoff | user decision | report + evidence | none | decide restore missing authority docs or rewrite references to current docs tree | stop until that decision is made | pending |

## Targeted validation commands
Non-destructive, non-credentialed, no deploy, no DB mutation:
```bash
git status --short -uall
git show --name-only --format=oneline HEAD^..HEAD
git diff --stat HEAD^..HEAD -- .gitignore .claude/session-state
git branch -a -vv
git rev-list --left-right --count HEAD...HEAD^
test -f README.md || echo absent
find .claude/rules -maxdepth 1 -type f 2>/dev/null | sort
```

## Sanitized git status
Before:
```text
?? NUL
?? plans/260907-wip-handoff-continuation/project-ledger.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/SCOUT-01.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/ledger.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/runtimes.json
```
After:
```text
?? NUL
?? plans/260907-wip-handoff-continuation/project-ledger.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/RECOVER-01.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/SCOUT-01.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/ledger.md
?? plans/reports/herdr-pm-260907-1105-wip-handoff/runtimes.json
```

## Unresolved question
Restore the missing root `README.md` and `./.claude/rules/*`, or rewrite `AGENTS.md`/`CLAUDE.md` to point at the current docs tree?
