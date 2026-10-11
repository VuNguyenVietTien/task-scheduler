# CATALOG-API-CONTRACT

**Status: FROZEN.** Backend-to-UI additive wire contract, 2026-09-07 Asia/Bangkok. Validated against mounted `backend/src/graphql/schema.rs`, `backend/src/graphql/types/task.rs`, `backend/src/graphql/resolvers/tasks/{mutation/create.rs,mutation/update.rs}`, and the current `project_authz` guards. Do not infer this catalog from `project_phases`, `project_categories`, `phase_id`, or `category_id`.

```graphql
enum ProjectCatalogKind { PROGRESS_TYPE CATEGORY TASK_TYPE }

type ProjectCatalogLabel { locale: String!, name: String! }

type ProjectCatalogItem {
  catalog_item_id: ID!
  project_id: ID!
  kind: ProjectCatalogKind!
  display_order: Int!
  labels: [ProjectCatalogLabel!]!
}

input ProjectCatalogLabelInput { locale: String!, name: String! }
input ProjectCatalogItemDraftInput { labels: [ProjectCatalogLabelInput!]! }
input CreateProjectCatalogItemsInput {
  project_id: ID!
  kind: ProjectCatalogKind!
  items: [ProjectCatalogItemDraftInput!]!
}
input UpdateProjectCatalogItemInput {
  catalog_item_id: ID!
  labels: [ProjectCatalogLabelInput!]!
}
input ReorderProjectCatalogItemsInput {
  project_id: ID!
  kind: ProjectCatalogKind!
  ordered_catalog_item_ids: [ID!]!
  expected_catalog_item_ids: [ID!]!
}

extend type Query {
  project_catalog_items(project_id: ID!, kind: ProjectCatalogKind!): [ProjectCatalogItem!]!
}
extend type Mutation {
  create_project_catalog_items(input: CreateProjectCatalogItemsInput!): [ProjectCatalogItem!]!
  update_project_catalog_item(input: UpdateProjectCatalogItemInput!): ProjectCatalogItem!
  reorder_project_catalog_items(input: ReorderProjectCatalogItemsInput!): [ProjectCatalogItem!]!
}

# Existing Task uses UUID output fields; task inputs use ID.
extend type Task {
  progress_catalog_item_id: UUID
  category_catalog_item_id: UUID
  task_type_catalog_item_id: UUID
}
extend input CreateTaskInput {
  progress_catalog_item_id: ID
  category_catalog_item_id: ID
  task_type_catalog_item_id: ID
}
extend input UpdateTaskInput {
  progress_catalog_item_id: ID
  category_catalog_item_id: ID
  task_type_catalog_item_id: ID
}
```

`UpdateTaskInput` catalog IDs use the existing Rust `MaybeUndefined<ID>` implementation: omitted preserves; explicit `null` clears catalog ID and clears the nullable legacy scalar only when its seeded bridge matches; a value validates same project and fixed kind before write. `CreateTaskInput` permits omitted/null as unclassified. A supplied catalog ID plus a legacy scalar is accepted only for its matching seeded `legacy_value`; otherwise `BAD_USER_INPUT`. Custom items keep legacy scalar `NULL`; task writers never create catalog items.

Input bounds: `items` 1..100; labels per item 1..20; locale 1..35 characters after trim; label name 1..200 characters after trim. UI should NFC-normalize before submission; server trim-validates and exactly de-duplicates `(locale, name)` pairs in a batch without adding a dependency. Duplicate locales within one item or duplicate exact pairs across a batch are `BAD_USER_INPUT`; no partial batch write. Labels replace the item's complete label set. Returned labels are deterministically `locale ASC`; UI display fallback: exact requested locale, language prefix, first returned label, then stable ID.

Reads use project read authorization. Mutations begin a transaction, lock/recheck the project through `require_project_write_tx`, then validate all IDs. Codes: `UNAUTHENTICATED` unauthenticated; `FORBIDDEN` denied/no project access; `BAD_USER_INPUT` malformed, blank/duplicate, incompatible legacy value, wrong full order, or foreign/wrong-kind ID; `CONFLICT` stale `expected_catalog_item_ids`. Foreign item existence is never disclosed. Reorder requires both vectors contain the exact current complete set, then atomically applies `display_order = 0..n-1`.

Legacy `progress_type`, `type_`/`type`, `category`, `phase_id`, and `category_id` remain unchanged public fields. `ProjectCatalogItem` intentionally exposes no `legacy_value`.

Unresolved questions: none.
