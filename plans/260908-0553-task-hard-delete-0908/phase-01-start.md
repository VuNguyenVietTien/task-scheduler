---
title: "Phase 1: Implement and verify"
status: complete
---

# Phase 1: Implement and verify

## Requirements

- [x] Transactional, project-authorized recursive hard delete with dependent cleanup and returned IDs.
- [x] Confirmed explicit/REJECTED frontend path; ARCHIVED persists.
- [x] Focused contract and Redux/unit verification; required report, commit, and push.

## Implementation Steps

1. Replaced the single-row soft delete with a locked subtree delete and GraphQL payload.
2. Routed status REJECTED and explicit actions through one Redux delete thunk.
3. Verified focused frontend tests; Rust tooling is unavailable in this environment.

## Success Criteria

The acceptance criteria in `plan.md` pass without a migration or production data change.
