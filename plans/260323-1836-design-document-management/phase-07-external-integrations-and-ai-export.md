# Phase 07: External Integrations & AI Export

## Context Links
- [DB Research: Jira/Trello Integration](research/researcher-02-db-schema-impact-analysis.md#4-jiratrello-integration-patterns)
- [Phase 01: External Links Table](phase-01-database-schema-and-migrations.md)
- [Scout: Existing Notification System](scout/scout-01-codebase-report.md#6-notification-system)

## Overview
- **Priority**: P3 (nice-to-have, builds on core)
- **Status**: completed
- **Effort**: 3h
- Link design documents/components to Jira/Trello tickets, track Git changes, expose AI-readable GraphQL API, and support webhook notifications.

## Key Insights
- External links table already polymorphic (entity_type + entity_id + provider)
- Jira REST API v3 supports remote links and webhooks
- AI-readable = structured GraphQL with full metadata, no special format needed
- Existing task-scheduler already has notification infrastructure (Firebase, WebSocket)

## Requirements

### Functional
- **Jira linking**: Link document/screen/component to Jira issue (store remote link)
- **Trello linking**: Link to Trello card (simpler API)
- **Git tracking**: Associate documents with Git branches/commits
- **AI export**: GraphQL query returning full document tree with all metadata (components, mappings, translations, flows)
- **Webhooks**: Notify external systems when documents change

### Non-Functional
- Async external API calls (don't block mutations)
- Graceful degradation if Jira/Trello unavailable
- AI export pagination for large documents

## Architecture

### External Link Management
```graphql
type ExternalLink {
  id: UUID!
  entityType: String!
  entityId: UUID!
  provider: String!
  externalId: String!
  externalUrl: String
  syncStatus: String!
  lastSyncedAt: DateTime
  metadata: JSON
}

input LinkExternalInput {
  entityType: String!    # document, screen, component, flow
  entityId: UUID!
  provider: String!      # jira, trello, github
  externalId: String!    # PROJ-123, card_id, branch_name
  externalUrl: String
}

type Mutation {
  linkExternal(input: LinkExternalInput!): ExternalLink!
  unlinkExternal(id: UUID!): Boolean!
  syncExternalLink(id: UUID!): ExternalLink!  # re-fetch status from provider
}
```

### Jira Integration Service
```rust
pub struct JiraService {
    client: reqwest::Client,
    base_url: String,        // https://company.atlassian.net
    api_token: String,
    email: String,
}

impl JiraService {
    // Create remote link on Jira issue pointing to our design doc
    pub async fn create_remote_link(&self, issue_key: &str, doc_url: &str, title: &str) -> Result<()>;

    // Fetch issue status for sync
    pub async fn get_issue_status(&self, issue_key: &str) -> Result<String>;
}
```

### AI-Readable Export Query
```graphql
# Full document tree export for AI consumption
query ExportDocumentForAI($documentId: UUID!) {
  designDocument(id: $documentId) {
    id
    name
    status
    description
    module { id, name, system { id, name } }
    screens {
      id
      name
      breakpoint
      components {
        id
        customId
        name
        componentType
        dataType
        displayLogic
        descriptions        # Full i18n JSONB
        position
        fieldMappings {
          dbTable
          dbColumn
          description
        }
        tags { name }
      }
    }
    flows {
      id
      name
      flowType
      mermaidDefinition
      steps {
        stepOrder
        label
        screen { id, name }
        component { id, customId, name }
      }
    }
    tags { name }
    externalLinks {
      provider
      externalId
      externalUrl
    }
  }
}
```

### Webhook System
```rust
// Simple webhook: POST document change events to registered URLs
pub struct WebhookService {
    client: reqwest::Client,
}

// webhook_subscriptions table (future, skip for MVP)
// For MVP: emit events to task-scheduler's notification system via HTTP

impl WebhookService {
    pub async fn notify_change(&self, event: DocumentChangeEvent) -> Result<()> {
        // POST to task-scheduler notification endpoint
        self.client.post(&format!("{}/api/webhooks/design-change", task_scheduler_url))
            .json(&event)
            .send()
            .await?;
        Ok(())
    }
}
```

## Related Code Files
- **Create**: `design-doc-service/src/services/jira_service.rs`
- **Create**: `design-doc-service/src/services/webhook_service.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/external_link.rs`
- **Modify**: `design-doc-service/src/graphql/resolvers/document.rs` - add export query
- **Create**: `task-scheduler-frontend/src/components/designs/external-link-panel.tsx`

## Implementation Steps
1. Create ExternalLink CRUD resolvers (link, unlink, list by entity)
2. Create `JiraService` with remote link creation + status fetch
3. Create `syncExternalLink` mutation (re-fetch status from provider)
4. Add AI export query to DocumentQuery (deep nested resolution)
5. Create simple webhook notification on document mutations
6. Build `external-link-panel.tsx` - UI for linking/unlinking Jira/Trello
7. Add link indicators on design viewer (icon showing linked tickets)
8. Test with Jira sandbox

## Todo List
- [x] ExternalLink CRUD resolvers
- [x] Jira remote link integration
- [x] Trello card link integration (basic - URL only)
- [x] Git branch/commit association
- [x] AI export query (deep document tree)
- [x] Webhook notification on mutations
- [x] External link panel UI
- [x] Link indicators on design viewer
- [x] Test with Jira API

## Success Criteria
- Link Jira issue to document → remote link visible in Jira
- AI export query returns complete document tree in single request
- External link status syncs on demand
- Webhook fires on document create/update/delete

## Risk Assessment
- **Jira API auth complexity**: Basic auth deprecated, OAuth 2.0 required for Cloud. Mitigation: Use API token (basic auth) for Server, OAuth for Cloud - start with one.
- **Webhook reliability**: External services may be down. Mitigation: Fire-and-forget for MVP; add retry queue later.
- **AI export payload size**: Deep nested document could be huge. Mitigation: Add depth limit param, paginate screens.

## Security Considerations
- Jira/Trello API tokens stored as env vars
- Webhook URLs validated (no internal network access)
- AI export respects same auth as regular queries
- External link metadata sanitized before storage

## Unresolved Questions
1. Jira Cloud vs Server API version support?
2. Should Trello integration be deferred to later release? (Lower priority)
3. Webhook subscription management (user-configurable URLs) or hardcoded?
4. Should AI export support OpenAPI/JSON Schema output format?

## Next Steps
- All phases complete. Integration testing across full feature set.
- Consider: GraphQL federation gateway to merge task-scheduler + design-doc-service schemas
