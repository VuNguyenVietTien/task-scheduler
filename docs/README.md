# ProjectManager Documentation

Welcome to the ProjectManager documentation. This directory contains comprehensive guides for developers, architects, and stakeholders working with the system.

## Core Documentation

### 1. [System Architecture](./system-architecture.md)
Complete overview of the distributed microservice architecture including:
- Service topology and communication patterns
- Database design and schema
- Authentication and security flows
- Deployment architecture

**Best for**: Architects, senior developers, infrastructure planning

### 2. [Project Overview & PDR](./project-overview-pdr.md)
Product Development Requirements and project vision:
- Feature specifications and functional requirements
- Non-functional requirements (performance, security, availability)
- Success metrics and acceptance criteria
- Risk assessment and timeline

**Best for**: Product managers, stakeholders, requirement verification

### 3. [Code Standards](./code-standards.md)
Development guidelines and conventions:
- Repository structure and file organization
- Naming conventions for each language
- Code organization principles (YAGNI, KISS, DRY)
- Testing standards and database guidelines
- Security and error handling patterns

**Best for**: Developers, code reviewers, onboarding

### 4. [Development Roadmap](./development-roadmap.md)
Project timeline and feature planning:
- Current status and completed features
- Planned phases (Foundation, Enhancement, Collaboration, Intelligence, Integration)
- Feature backlog with prioritization
- Technical debt and maintenance tasks
- Success metrics and dependencies

**Best for**: Team leads, sprint planners, product roadmap alignment

### 5. [Project Changelog](./project-changelog.md)
Release notes and version history:
- Unreleased features and current development
- Previous releases and version records
- Breaking changes and migration guides

**Best for**: Release managers, change tracking, upgrade planning

## Quick Start by Role

### For New Developers
1. Start with [Code Standards](./code-standards.md) - understand conventions
2. Review [System Architecture](./system-architecture.md) - understand the system
3. Check relevant service README in the codebase
4. Read [Project Overview & PDR](./project-overview-pdr.md) for context

### For DevOps/Infrastructure
1. Review [System Architecture](./system-architecture.md) - deployment and communication
2. Check docker-compose.yml in project root
3. Review service-specific Dockerfiles and configuration
4. Reference [Development Roadmap](./development-roadmap.md) for scaling plans

### For Product/Project Managers
1. Start with [Project Overview & PDR](./project-overview-pdr.md) - requirements and vision
2. Review [Development Roadmap](./development-roadmap.md) - timeline and features
3. Check [Project Changelog](./project-changelog.md) - release notes

### For Architects/Tech Leads
1. Deep dive into [System Architecture](./system-architecture.md)
2. Review [Code Standards](./code-standards.md) - patterns and organization
3. Reference [Project Overview & PDR](./project-overview-pdr.md) - constraints and requirements

## Key Features Overview

### Design Document Service (New)
The latest addition to ProjectManager is a comprehensive design document management system built with Rust and Actix-web.

**Key Capabilities**:
- SVG import from Figma and Google Stitch
- Component-to-database field mapping
- Business process flow diagrams (Mermaid)
- Impact analysis and change tracking
- Multilingual descriptions (i18n)
- Audit trail with full change history
- AI-ready export formats

See [System Architecture](./system-architecture.md#2-design-document-service-new) for detailed technical specifications.

## Service Directory

| Service | Language | Framework | Port | Purpose |
|---------|----------|-----------|------|---------|
| task-scheduler-backend | TypeScript | Express.js | 8080 | Task and project management |
| design-doc-service | Rust | Actix-web | 8081 | Design document GraphQL API |
| task-scheduler-frontend | TypeScript | Next.js | 3000 | Web UI for all features |
| PostgreSQL | - | - | 5432 | Shared database |

## Related Files

- **Project README**: See main [README](../README.md) for setup instructions
- **Development Rules**: See [.claude/rules/development-rules.md](../.claude/rules/development-rules.md)
- **Service Repositories**: task-scheduler-backend/, design-doc-service/, task-scheduler-frontend/

## Important Links

- **Docker Compose**: `docker-compose.yml` - multi-container orchestration
- **Database Migrations**: `design-doc-service/migrations/` - schema versions
- **Configuration**: `.env.example` files in each service

## Document Maintenance

These docs are updated regularly as features are implemented:
- Updated: March 23, 2025
- Last review: March 23, 2025
- Version: Aligned with v2.29+ of task-scheduler-backend

### How to Update
1. Edit the relevant markdown file
2. Maintain consistent formatting and structure
3. Update document timestamps and version references
4. Ensure code examples are verified against actual codebase
5. Add entry to [Project Changelog](./project-changelog.md)

## Questions & Support

For documentation questions or improvements, please:
1. Check existing documentation thoroughly
2. Review related files and code
3. Create an issue with specific questions or documentation gaps
