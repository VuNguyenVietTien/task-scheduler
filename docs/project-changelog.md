# Project Changelog

All notable changes to the ProjectManager system are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

#### Design Document Service (v1.0.0)
- New microservice: `design-doc-service` (Rust, Actix-web, async-graphql, SQLx)
  - Async GraphQL API for design document operations
  - Clipboard SVG import from Figma and Google Stitch with automatic component extraction
  - Database schema with 12 tables supporting design management:
    - `systems` and `modules`: Hierarchical organization
    - `design_documents`: Primary document storage
    - `screens`: UI screen definitions with SVG
    - `components`: Reusable components with properties
    - `field_mappings`: Component field to database column mappings
    - `flows` and `flow_steps`: Business process flows with Mermaid diagram support
    - `tags` and `entity_tags`: Flexible tagging system
    - `external_links`: External resource tracking (Figma, wireframes, etc.)
    - `document_audit`: Change history and audit trail with JSONB payloads
  - JWT-based authentication with task-scheduler-backend (shared secret)
  - HTTP API for inter-service communication on port 8081
  - GIN index support for full-text search on JSONB fields
  - Batch operation support for bulk imports
  - Query caching for performance optimization

#### Frontend Design Pages & Components
- 4 new page routes under `/designs/`:
  - `/designs`: Design document library with search and filtering
  - `/designs/[id]`: Detail view with split-pane editor
  - `/designs/new`: Create new design with clipboard paste from Figma/Google Stitch
  - `/designs/[id]/impact`: Impact analysis dashboard

- 10+ new React components:
  - `design-viewer-split-pane`: Split-view editor (design and code side-by-side)
  - `paste-design-zone`: Drag-and-drop and clipboard paste handler for SVG imports
  - `design-frame-interactive-svg`: Interactive SVG renderer with hotspot support
  - `component-mapping-editor`: UI for field mapping configuration
  - `flow-diagram-renderer`: Mermaid diagram visualization
  - `tag-manager`: Tag creation and assignment interface
  - `audit-trail-viewer`: Change history viewer with filters
  - `impact-analysis-visualizer`: Visual representation of change impacts
  - `field-mapping-editor`: Advanced mapping configuration
  - `external-link-manager`: Link management and validation

#### Design Features
- **SVG Import**: Parse and store Figma/Google Stitch clipboard exports
- **Component Database Mapping**: Link UI components to database field definitions
- **Impact Analysis**: Identify affected tasks and database changes
- **Business Flows**: Create and visualize process flows with Mermaid syntax
- **i18n Support**: Multilingual description fields for documents and components
- **External Link Tracking**: Maintain references to Figma files, wireframes, specifications
- **AI-Ready Export**: Export design data in JSON/YAML formats for ML processing
- **Audit Trail**: Complete change history with user attribution and timestamps

#### Database Enhancements
- Design document schema in PostgreSQL (shared cluster)
- Migration scripts for incremental schema deployment
- Performance indexes on frequently queried columns
- JSONB support for flexible metadata storage

### Changed
- Frontend now integrates design management alongside task scheduling
- PostgreSQL cluster configured for multi-service access

### Fixed
- (No breaking changes in this release)

## [Previous Releases]

### [v2.29] - 2025-03-23
- Gantt chart improvements and task creation bug fixes
- FCM notification duplicate initialization resolved
- Report logic corrections
- Comment deletion improvements
- Notification link redirect enhancements

### [v2.28] - Prior
- Core task scheduling functionality
- Project management features
- Team collaboration tools
- Real-time notifications via FCM
- Gantt chart visualization
- WebSocket-based real-time updates

---

## How to Update Changelog

1. **When releasing**: Move [Unreleased] items to a new version section with date
2. **Format**: `### [COMPONENT_NAME]` for grouped changes
3. **Severity**: Note breaking changes with `⚠️ BREAKING` prefix
4. **References**: Link to relevant issues/PRs when applicable
5. **Type markers**: Use Added/Changed/Fixed/Removed/Deprecated/Security prefixes

## Version Numbering

- **Major.Minor.Patch** (e.g., 2.29.0)
- **Major**: Significant architectural changes
- **Minor**: New features and enhancements
- **Patch**: Bug fixes and minor improvements
