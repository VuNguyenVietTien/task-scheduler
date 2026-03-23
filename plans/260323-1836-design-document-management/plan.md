---
title: "Design Document Management Microservice"
description: "Microservice for managing design documents with Figma integration, component-DB mapping, impact analysis, and AI-readable exports"
status: completed
priority: P1
effort: "40h"
branch: feat/v2.29
tags: [microservice, design-docs, figma, impact-analysis, i18n]
created: 2026-03-23
---

# Design Document Management Microservice

Separate microservice with own PostgreSQL DB. Communicates via API with existing task-scheduler. Manages design documents, Figma frame imports, component-to-DB-field mapping, impact analysis, business flow diagrams, and AI-readable exports.

## Architecture

- **Backend**: Rust (Actix-web + async-graphql + SQLx) - consistent with existing stack
- **Database**: PostgreSQL + JSONB hybrid (relational structure + flexible metadata)
- **Frontend**: Next.js pages integrated into existing task-scheduler-frontend
- **Auth**: JWT validation (tokens issued by existing auth service)
- **Design Import**: Clipboard paste from Figma/Google Stitch → SVG extraction & render (no Figma API token needed)

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Database Schema & Migrations | completed | 6h | [phase-01](phase-01-database-schema-and-migrations.md) |
| 2 | Backend Service Setup | completed | 5h | [phase-02](phase-02-backend-service-setup.md) |
| 3 | Document CRUD & Versioning | completed | 5h | [phase-03](phase-03-design-document-crud-and-versioning.md) |
| 4 | Clipboard SVG Import & Component Mapping | completed | 8h | [phase-04](phase-04-clipboard-svg-import-and-component-mapping.md) |
| 5 | Frontend Design Viewer | completed | 8h | [phase-05](phase-05-frontend-design-viewer.md) |
| 6 | Impact Analysis & Flow Tracking | completed | 5h | [phase-06](phase-06-impact-analysis-and-flow-tracking.md) |
| 7 | External Integrations & AI Export | completed | 3h | [phase-07](phase-07-external-integrations-and-ai-export.md) |

## Key Dependencies

- Existing task-scheduler JWT auth service (token validation)
- PostgreSQL instance (separate DB from task-scheduler)
- Docker for containerized deployment
- Modern browser with Clipboard API support

## Validation Log

### Session 1 — 2026-03-23
**Trigger:** Initial plan creation validation
**Questions asked:** 5

#### Questions & Answers

1. **[Tech Stack]** Backend tech cho microservice mới - Rust hay Node.js/TypeScript?
   - Options: Rust (Actix-web) | Node.js/TypeScript | Go
   - **Answer:** Rust (Actix-web + async-graphql)
   - **Rationale:** Consistent with existing backend, team already has Rust expertise

2. **[Render Mode]** Khi paste từ Figma, clipboard chứa SVG/HTML data. Render bằng cách nào?
   - Options: SVG render | HTML/CSS render | Image snapshot + SVG overlay
   - **Answer:** SVG render
   - **Rationale:** Preserves exact vector data, colors, dimensions. Scalable, interactive.

3. **[Frontend]** Thêm pages vào existing frontend hay tạo riêng?
   - Options: Thêm vào existing | Frontend riêng | Micro-frontend
   - **Answer:** Thêm vào existing frontend
   - **Rationale:** Share auth/layout/components, avoid duplication

4. **[Impact Scope]** Impact analysis nên cross-document boundaries không?
   - Options: Cross-document trong cùng system | Chỉ trong cùng document | Global cross-system
   - **Answer:** Cross-document trong cùng system
   - **Rationale:** Practical scope - most dependencies are within same system

5. **[Import Flow]** Hỗ trợ clipboard paste + Figma API, hay chỉ một?
   - Options: Cả hai | Chỉ clipboard paste | Chỉ Figma API
   - **Answer:** Chỉ clipboard paste
   - **Rationale:** No Figma API token needed, simpler setup, user-friendly

#### Confirmed Decisions
- Backend: Rust — stack consistency, team expertise
- Design import: Clipboard SVG paste only — no Figma API dependency
- Frontend: Integrated into existing app — shared auth/layout
- Impact scope: Cross-document within system — practical balance
- SVG render: Direct SVG from clipboard — full fidelity

#### Action Items
- [x] Rewrite Phase 04: Figma API → Clipboard SVG paste
- [x] Update Phase 01: Replace figma columns with svg columns
- [x] Update Phase 05: PNG+overlay → Interactive SVG
- [x] Update Phase 06: Add system_id scope to impact queries
- [x] Remove Figma API token from dependencies

#### Impact on Phases
- Phase 01: screens table columns changed (figma → svg), components.figma_node_id → svg_element_id
- Phase 02: Remove figma_access_token from Config, remove reqwest dependency for Figma
- Phase 04: Complete rewrite - clipboard SVG parsing replaces Figma REST API
- Phase 05: Interactive SVG replaces PNG+overlay approach
- Phase 06: Impact queries scoped to system_id
- Phase 07: Figma API integration removed (no token needed)

## Research Reports

- [Figma API & UI Mapping](reports/researcher-01-figma-api-ui-mapping.md)
- [DB Schema & Impact Analysis](research/researcher-02-db-schema-impact-analysis.md)
- [Codebase Scout](scout/scout-01-codebase-report.md)
