# Development Roadmap

## Project Vision

ProjectManager is an integrated platform for task scheduling, project management, and design document collaboration. The roadmap outlines planned features, improvements, and milestones for 2025-2026.

## Current Status (March 2025)

### Completed ✓
- Task scheduling core functionality (CRUD, dependencies)
- Project management interface
- Team collaboration features
- Real-time notifications (FCM)
- Gantt chart visualization
- Design Document Service v1.0
  - Async GraphQL API
  - SVG import from Figma/Google Stitch
  - Component database mapping
  - Business flow diagrams
  - Audit trail and impact analysis
- UI Refactor v2.29 (Sidebar + Dashboard + Gantt improvements)
  - Dark sidebar with expandable project tree
  - URL-driven navigation
  - Role-based dashboard with real GraphQL data
  - Gantt responsive buttons and task type column
- Task Detail Editable Fields + Task Edit Modal
  - Editable actual_start/actual_end dates in TaskDetail modal
  - Editable actual dates in full TaskDetailPage
  - Task edit modal integrated into KanbanBoard
  - Task edit modal integrated into Timeline/Gantt view
  - Unified left-click (modal) vs Ctrl+click (navigate) behavior across all views
- Documents Tab in Project Detail View (v2.30)
  - "Tai lieu" tab in project sidebar navigation
  - Design systems list integrated into project context
  - Create new design system from project view
  - Isolated Apollo client prevents cache conflicts with main backend

### In Progress 🔄
- Design service performance optimization
- Frontend design pages integration testing
- External link management features
- Reports system refinements (metrics validation)
- Documents tab UI refinements and user testing

### Not Started ⏳
- Real-time design collaboration (WebSocket)
- Advanced AI-powered design analysis
- Component library versioning
- Design system integration
- Code generation from designs

## Roadmap Timeline

### Phase 1: Foundation (Completed)
**Goal**: Establish core task scheduling and design management infrastructure

**Status**: COMPLETE ✓

Deliverables:
- Task scheduler microservice with PostgreSQL
- Design document service with GraphQL API
- React frontend with design pages
- Authentication and authorization layer
- Notification system (FCM)

### Phase 2: Enhancement (Current)
**Goal**: Optimize performance and expand design features

**Timeline**: Q1-Q2 2025

**Status**: IN PROGRESS 🔄 (60% complete)

Deliverables:
- [x] Enhanced UI components (COMPLETE)
  - Dark sidebar with expandable project tree
  - URL-driven navigation with tab switching
  - Role-based dashboard (PM vs member views)
  - Gantt responsive button fixes
  - Task type column with color-coded badges
- [x] Documents Tab Integration (COMPLETE)
  - Design systems list in project sidebar
  - Create design system from project view
  - Isolated Apollo client for design-doc-service
- [ ] Design service performance tuning
  - Query caching optimization
  - Index performance analysis
  - Connection pooling tuning
- [x] Report system refactor (COMPLETE)
  - Role system update (Manager/Leader/Member/Guest)
  - Modular report components (daily/period/weekly/monthly/quarterly)
  - Frontend metrics calculation from Redux state
  - Database schema updates for report tracking
- [ ] Advanced impact analysis
  - Dependency graph visualization
  - Risk assessment scoring
  - Rollback suggestions
- [ ] Component library features
  - Component versioning
  - Change history per component
  - Usage tracking

**Success Metrics**:
- Design query latency < 100ms (p99)
- Component import success rate > 95%
- User satisfaction score > 4/5

### Phase 3: Collaboration (Planned)
**Goal**: Enable real-time team collaboration on designs

**Timeline**: Q2-Q3 2025

**Status**: NOT STARTED ⏳

Deliverables:
- [ ] WebSocket real-time updates
- [ ] Collaborative editing with conflict resolution
- [ ] Comments and mentions system
- [ ] Design review workflow
- [ ] Approval chains and sign-off tracking
- [ ] Activity stream and notifications

### Phase 4: Intelligence (Planned)
**Goal**: Integrate AI for design analysis and insights

**Timeline**: Q3-Q4 2025

**Status**: NOT STARTED ⏳

Deliverables:
- [ ] AI-powered design suggestions
- [ ] Accessibility analysis and recommendations
- [ ] Responsive design validation
- [ ] Component consistency checking
- [ ] Automated documentation generation
- [ ] Design pattern detection

### Phase 5: Integration (Planned)
**Goal**: Expand ecosystem integrations

**Timeline**: Q4 2025 - Q1 2026

**Status**: NOT STARTED ⏳

Deliverables:
- [ ] Figma direct integration (webhooks)
- [ ] Adobe XD support
- [ ] Jira integration for requirements tracking
- [ ] GitHub integration for design branches
- [ ] Design system integration (tokens, components)
- [ ] Code generation (React, Vue, Svelte)

## Feature Backlog

### High Priority
- [ ] Design approval workflow
- [ ] Advanced field mapping UI
- [ ] Bulk export to multiple formats
- [ ] Template management for design documents
- [ ] Design asset library with version control

### Medium Priority
- [ ] Design comparison and diff tools
- [ ] Performance profiling dashboard
- [ ] Advanced search with full-text indexing
- [ ] Custom metadata fields
- [ ] Design pattern library

### Low Priority
- [ ] 3D design preview
- [ ] AR preview capability
- [ ] Mobile app for design review
- [ ] VCS-style branching for designs
- [ ] Design animation preview

## Technical Debt & Maintenance

### Current Issues
- Design service error logging needs enhancement
- Frontend component organization could be modularized
- Test coverage target: 70% → 85%

### Planned Refactors
- [ ] Extract shared types to monorepo packages
- [ ] Consolidate GraphQL schemas
- [ ] Performance audit on design viewer
- [ ] Accessibility audit (WCAG 2.1 AA compliance)

## Dependencies & Constraints

### External Dependencies
- PostgreSQL 12+ (database)
- Firebase Cloud Messaging (notifications)
- Figma API (future integration)
- AWS S3 or equivalent (design asset storage, planned)

### Infrastructure Requirements
- Kubernetes cluster (optional, for scaling)
- CDN for static assets
- Message queue for async jobs (planned)

### Resource Constraints
- 2 backend engineers
- 1 frontend engineer
- 1 DevOps engineer (shared)
- Limited budget for external services

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| System uptime | 99.5% | 99.8% ✓ |
| Design query latency (p99) | < 100ms | 120ms |
| User task completion rate | > 90% | 88% |
| Feature adoption (new design pages) | > 50% | 15% |
| Bug resolution time | < 48h | 72h |
| Code coverage | > 85% | 65% |

## Q&A

- **When will collaborative editing be available?** Phase 3, targeting Q2-Q3 2025
- **Will there be a mobile app?** Planned for Phase 5, mobile-responsive web first
- **What about design system integration?** Phase 5, dependent on community demand
