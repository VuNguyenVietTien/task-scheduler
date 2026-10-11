# Decision Ledger

## DEC-001 — Repoint stale project authority references

- Date: 2026-09-07
- Status: accepted
- Decision: Update `AGENTS.md` and `CLAUDE.md` to reference the current `docs/` authority instead of restoring missing root `README.md` and `.claude/rules/*` files.
- Chosen by: user
- Constraints: minimal documentation-only change; do not invent absent workflow content; no product code, deployment, database change, commit, push, or secrets.
- Validation: reference-existence scan, targeted diff review, independent docs/process review.
