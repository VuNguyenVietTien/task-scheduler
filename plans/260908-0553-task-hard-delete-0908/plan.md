---
title: "TASK-HARD-DELETE-0908"
description: "Permanently remove a writable project task and its descendants; ARCHIVED remains persisted."
status: complete
priority: P1
effort: "small"
tags: [tasks, backend, frontend]
created: 2026-09-08
---

# TASK-HARD-DELETE-0908

## Overview

Add one authorized, transactional hard-delete path. It returns every deleted task ID so Redux removes the same recursive subtree. Selecting `REJECTED` triggers the confirmed delete path; `ARCHIVED` remains a normal persisted status.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Delete only a writable project's task subtree and dependent rows safely. | P1 |
| 2 | Make explicit Delete and REJECTED require descendant-impact confirmation. | P1 |
| 3 | Keep List, Kanban, Gantt, and detail state consistent after deletion. | P1 |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Implement and verify](./phase-01-start.md) | Complete |

## Success Criteria

- [x] Delete locks and authorizes the target, deletes its full same-project subtree, and returns IDs.
- [x] REJECTED is not persisted by task status mutations; ARCHIVED is.
- [x] Confirmed frontend deletion removes returned IDs from Redux; cancel/error leaves UI intact.
- [x] Focused contract/reducer tests pass; report is written; branch is committed and pushed.

<!-- slug: task-hard-delete-0908 -->
