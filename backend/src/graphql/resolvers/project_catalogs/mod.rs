use async_graphql::{Context, Enum, ID, InputObject, MaybeUndefined, Object, Result, SimpleObject};
use sqlx::{Row, Transaction};
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{coded_error, project_authz};
use crate::graphql::types::TaskProgressType;

const MAX_ITEMS_PER_BATCH: usize = 100;
const MAX_LABELS_PER_ITEM: usize = 20;
const MAX_LOCALE_CHARS: usize = 35;
const MAX_NAME_CHARS: usize = 200;

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ProjectCatalogKind {
    #[graphql(name = "PROGRESS_TYPE")]
    ProgressType,
    #[graphql(name = "CATEGORY")]
    Category,
    #[graphql(name = "TASK_TYPE")]
    TaskType,
}

impl ProjectCatalogKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::ProgressType => "PROGRESS_TYPE",
            Self::Category => "CATEGORY",
            Self::TaskType => "TASK_TYPE",
        }
    }
}

#[derive(SimpleObject, Clone, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectCatalogLabel {
    pub locale: String,
    pub name: String,
}

#[derive(SimpleObject, Clone, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectCatalogItem {
    pub catalog_item_id: ID,
    pub project_id: ID,
    pub kind: ProjectCatalogKind,
    pub display_order: i32,
    pub labels: Vec<ProjectCatalogLabel>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectCatalogLabelInput {
    pub locale: String,
    pub name: String,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectCatalogItemDraftInput {
    pub labels: Vec<ProjectCatalogLabelInput>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CreateProjectCatalogItemsInput {
    pub project_id: ID,
    pub kind: ProjectCatalogKind,
    pub items: Vec<ProjectCatalogItemDraftInput>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdateProjectCatalogItemInput {
    pub catalog_item_id: ID,
    pub labels: Vec<ProjectCatalogLabelInput>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ReorderProjectCatalogItemsInput {
    pub project_id: ID,
    pub kind: ProjectCatalogKind,
    pub ordered_catalog_item_ids: Vec<ID>,
    pub expected_catalog_item_ids: Vec<ID>,
}

#[derive(Clone, Debug)]
struct ValidatedLabel {
    locale: String,
    name: String,
}

fn bad(message: impl Into<String>) -> async_graphql::Error {
    coded_error(message, "BAD_USER_INPUT")
}

fn conflict(message: impl Into<String>) -> async_graphql::Error {
    coded_error(message, "CONFLICT")
}

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string()).map_err(|_| bad(format!("invalid {field}")))
}

fn clean(value: &str, field: &str, maximum: usize) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > maximum {
        return Err(bad(format!("{field} must be nonempty and at most {maximum} characters")));
    }
    Ok(value.to_owned())
}

fn validate_labels(labels: &[ProjectCatalogLabelInput]) -> Result<Vec<ValidatedLabel>> {
    if labels.is_empty() || labels.len() > MAX_LABELS_PER_ITEM {
        return Err(bad(format!("labels must contain 1..{MAX_LABELS_PER_ITEM} entries")));
    }
    let mut locales = HashSet::with_capacity(labels.len());
    labels
        .iter()
        .map(|label| {
            let locale = clean(&label.locale, "locale", MAX_LOCALE_CHARS)?;
            if !locales.insert(locale.clone()) {
                return Err(bad("labels must have unique locales"));
            }
            Ok(ValidatedLabel {
                locale,
                name: clean(&label.name, "label name", MAX_NAME_CHARS)?,
            })
        })
        .collect()
}

fn validate_batch(items: &[ProjectCatalogItemDraftInput]) -> Result<Vec<Vec<ValidatedLabel>>> {
    if items.is_empty() || items.len() > MAX_ITEMS_PER_BATCH {
        return Err(bad(format!("items must contain 1..{MAX_ITEMS_PER_BATCH} entries")));
    }
    let mut all_pairs = HashSet::new();
    items
        .iter()
        .map(|item| {
            let labels = validate_labels(&item.labels)?;
            for label in &labels {
                if !all_pairs.insert((label.locale.clone(), label.name.clone())) {
                    return Err(bad("batch contains a duplicate locale and label name"));
                }
            }
            Ok(labels)
        })
        .collect()
}

async fn list_in_tx(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    kind: ProjectCatalogKind,
) -> Result<Vec<ProjectCatalogItem>> {
    let rows = sqlx::query(
        "SELECT catalog_item_id, project_id, display_order FROM project_task_catalog_items \
         WHERE project_id = $1 AND kind = $2 ORDER BY display_order, catalog_item_id",
    )
    .bind(project_id)
    .bind(kind.as_str())
    .fetch_all(&mut **tx)
    .await
    .map_err(AuthError::Database)?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.get("catalog_item_id")).collect();
    let label_rows = sqlx::query(
        "SELECT catalog_item_id, locale, name FROM project_task_catalog_labels \
         WHERE catalog_item_id = ANY($1) ORDER BY catalog_item_id, locale",
    )
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await
    .map_err(AuthError::Database)?;
    let mut labels: HashMap<Uuid, Vec<ProjectCatalogLabel>> = HashMap::new();
    for label in label_rows {
        labels
            .entry(label.get("catalog_item_id"))
            .or_default()
            .push(ProjectCatalogLabel {
                locale: label.get("locale"),
                name: label.get("name"),
            });
    }
    Ok(rows
        .into_iter()
        .map(|row| {
            let catalog_item_id: Uuid = row.get("catalog_item_id");
            ProjectCatalogItem {
                catalog_item_id: catalog_item_id.into(),
                project_id: row.get::<Uuid, _>("project_id").into(),
                kind,
                display_order: row.get("display_order"),
                labels: labels.remove(&catalog_item_id).unwrap_or_default(),
            }
        })
        .collect())
}

async fn list_from_pool(
    pool: &sqlx::PgPool,
    project_id: Uuid,
    kind: ProjectCatalogKind,
) -> Result<Vec<ProjectCatalogItem>> {
    let mut tx = pool.begin().await.map_err(AuthError::Database)?;
    let items = list_in_tx(&mut tx, project_id, kind).await?;
    tx.commit().await.map_err(AuthError::Database)?;
    Ok(items)
}

#[derive(Default)]
pub struct ProjectCatalogQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectCatalogQuery {
    async fn project_catalog_items(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        kind: ProjectCatalogKind,
    ) -> Result<Vec<ProjectCatalogItem>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let caller = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, caller, project_id).await?;
        list_from_pool(&context.db, project_id, kind).await
    }
}

#[derive(Default)]
pub struct ProjectCatalogMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectCatalogMutation {
    async fn create_project_catalog_items(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectCatalogItemsInput,
    ) -> Result<Vec<ProjectCatalogItem>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let labels_by_item = validate_batch(&input.items)?;
        let caller = project_authz::require_user(context)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
        let next_order: i32 = sqlx::query_scalar(
            "SELECT COALESCE(max(display_order) + 1, 0) FROM project_task_catalog_items \
             WHERE project_id = $1 AND kind = $2",
        )
        .bind(project_id)
        .bind(input.kind.as_str())
        .fetch_one(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        for (offset, labels) in labels_by_item.iter().enumerate() {
            let catalog_item_id: Uuid = sqlx::query_scalar(
                "INSERT INTO project_task_catalog_items (project_id, kind, display_order) \
                 VALUES ($1, $2, $3) RETURNING catalog_item_id",
            )
            .bind(project_id)
            .bind(input.kind.as_str())
            .bind(next_order + offset as i32)
            .fetch_one(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
            for label in labels {
                sqlx::query(
                    "INSERT INTO project_task_catalog_labels (catalog_item_id, locale, name) \
                     VALUES ($1, $2, $3)",
                )
                .bind(catalog_item_id)
                .bind(&label.locale)
                .bind(&label.name)
                .execute(&mut *tx)
                .await
                .map_err(AuthError::Database)?;
            }
        }
        let items = list_in_tx(&mut tx, project_id, input.kind).await?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(items)
    }

    async fn update_project_catalog_item(
        &self,
        ctx: &Context<'_>,
        input: UpdateProjectCatalogItemInput,
    ) -> Result<ProjectCatalogItem> {
        let context = ctx.data::<GraphQLContext>()?;
        let catalog_item_id = parse_id(&input.catalog_item_id, "catalog_item_id")?;
        let labels = validate_labels(&input.labels)?;
        let caller = project_authz::require_user(context)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        let scope: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT project_id, kind FROM project_task_catalog_items WHERE catalog_item_id = $1",
        )
        .bind(catalog_item_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let Some((project_id, kind)) = scope else {
            return Err(bad("catalog item is not available"));
        };
        let kind = match kind.as_str() {
            "PROGRESS_TYPE" => ProjectCatalogKind::ProgressType,
            "CATEGORY" => ProjectCatalogKind::Category,
            "TASK_TYPE" => ProjectCatalogKind::TaskType,
            _ => return Err(bad("catalog item is not available")),
        };
        project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
        let locked: Option<Uuid> = sqlx::query_scalar(
            "SELECT catalog_item_id FROM project_task_catalog_items \
             WHERE catalog_item_id = $1 AND project_id = $2 FOR UPDATE",
        )
        .bind(catalog_item_id)
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if locked.is_none() {
            return Err(conflict("catalog item changed; refresh before retrying"));
        }
        sqlx::query("DELETE FROM project_task_catalog_labels WHERE catalog_item_id = $1")
            .bind(catalog_item_id)
            .execute(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
        for label in labels {
            sqlx::query(
                "INSERT INTO project_task_catalog_labels (catalog_item_id, locale, name) \
                 VALUES ($1, $2, $3)",
            )
            .bind(catalog_item_id)
            .bind(label.locale)
            .bind(label.name)
            .execute(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
        }
        sqlx::query("UPDATE project_task_catalog_items SET updated_at = now() WHERE catalog_item_id = $1")
            .bind(catalog_item_id)
            .execute(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
        let item = list_in_tx(&mut tx, project_id, kind)
            .await?
            .into_iter()
            .find(|item| item.catalog_item_id.to_string() == catalog_item_id.to_string())
            .ok_or_else(|| conflict("catalog item changed; refresh before retrying"))?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(item)
    }

    async fn reorder_project_catalog_items(
        &self,
        ctx: &Context<'_>,
        input: ReorderProjectCatalogItemsInput,
    ) -> Result<Vec<ProjectCatalogItem>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let ordered: Vec<Uuid> = input
            .ordered_catalog_item_ids
            .iter()
            .map(|id| parse_id(id, "ordered_catalog_item_ids"))
            .collect::<Result<_>>()?;
        let expected: Vec<Uuid> = input
            .expected_catalog_item_ids
            .iter()
            .map(|id| parse_id(id, "expected_catalog_item_ids"))
            .collect::<Result<_>>()?;
        let caller = project_authz::require_user(context)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
        let current: Vec<Uuid> = sqlx::query_scalar(
            "SELECT catalog_item_id FROM project_task_catalog_items \
             WHERE project_id = $1 AND kind = $2 ORDER BY display_order, catalog_item_id FOR UPDATE",
        )
        .bind(project_id)
        .bind(input.kind.as_str())
        .fetch_all(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let complete_set = |ids: &[Uuid]| {
            ids.len() == current.len()
                && ids.iter().copied().collect::<HashSet<_>>().len() == ids.len()
                && ids.iter().copied().collect::<HashSet<_>>()
                    == current.iter().copied().collect::<HashSet<_>>()
        };
        if !complete_set(&ordered) || !complete_set(&expected) {
            return Err(bad("reorder requires every catalog item exactly once"));
        }
        if expected != current {
            return Err(conflict("catalog order changed; refresh before retrying"));
        }
        sqlx::query("SET CONSTRAINTS project_task_catalog_items_project_kind_order_key DEFERRED")
            .execute(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
        sqlx::query(
            "UPDATE project_task_catalog_items AS item SET display_order = ordered.position - 1, updated_at = now() \
             FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(catalog_item_id, position) \
             WHERE item.catalog_item_id = ordered.catalog_item_id AND item.project_id = $2 AND item.kind = $3",
        )
        .bind(&ordered)
        .bind(project_id)
        .bind(input.kind.as_str())
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let items = list_in_tx(&mut tx, project_id, input.kind).await?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(items)
    }
}

#[derive(Clone, Debug)]
pub enum TaskCatalogId {
    Omitted,
    Null,
    Value(Uuid),
}

pub fn task_catalog_id(value: &MaybeUndefined<ID>) -> Result<TaskCatalogId> {
    match value {
        MaybeUndefined::Undefined => Ok(TaskCatalogId::Omitted),
        MaybeUndefined::Null => Ok(TaskCatalogId::Null),
        MaybeUndefined::Value(value) if value.to_string().is_empty() => Ok(TaskCatalogId::Null),
        MaybeUndefined::Value(value) => Ok(TaskCatalogId::Value(parse_id(value, "catalog item id")?)),
    }
}

#[derive(Clone, Debug)]
pub struct TaskCatalogState {
    pub progress_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub task_type_id: Option<Uuid>,
    pub progress_legacy: Option<String>,
    pub category_legacy: Option<String>,
    pub task_type_legacy: Option<String>,
}

pub fn progress_legacy(value: Option<TaskProgressType>) -> Option<String> {
    value.map(|value| match value {
        TaskProgressType::Study => "study",
        TaskProgressType::Investigate => "investigate",
        TaskProgressType::Code => "code",
        TaskProgressType::Test => "test",
        TaskProgressType::ReviewCode => "review_code",
        TaskProgressType::ReviewTestReport => "review_test_report",
        TaskProgressType::Release => "release",
    }
    .to_owned())
}

pub fn progress_type(value: Option<String>) -> Result<Option<TaskProgressType>> {
    value
        .map(|value| TaskProgressType::from_str(&value).map_err(|_| bad("invalid progress catalog bridge")))
        .transpose()
}

async fn legacy_for_item(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    kind: ProjectCatalogKind,
    item_id: Uuid,
) -> Result<Option<String>> {
    let row: Option<Option<String>> = sqlx::query_scalar(
        "SELECT legacy_value FROM project_task_catalog_items \
         WHERE catalog_item_id = $1 AND project_id = $2 AND kind = $3",
    )
    .bind(item_id)
    .bind(project_id)
    .bind(kind.as_str())
    .fetch_optional(&mut **tx)
    .await
    .map_err(AuthError::Database)?;
    row.ok_or_else(|| bad("catalog item is not valid for this project and kind"))
}

async fn item_for_legacy(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    kind: ProjectCatalogKind,
    legacy: &str,
) -> Result<Option<Uuid>> {
    let row = sqlx::query_scalar(
        "SELECT catalog_item_id FROM project_task_catalog_items \
         WHERE project_id = $1 AND kind = $2 AND legacy_value = $3",
    )
    .bind(project_id)
    .bind(kind.as_str())
    .bind(legacy)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AuthError::Database)?;
    Ok(row)
}

async fn resolve_one(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    kind: ProjectCatalogKind,
    requested: TaskCatalogId,
    supplied_legacy: Option<String>,
    current_id: Option<Uuid>,
    current_legacy: Option<String>,
) -> Result<(Option<Uuid>, Option<String>)> {
    match requested {
        TaskCatalogId::Value(item_id) => {
            let bridge = legacy_for_item(tx, project_id, kind, item_id).await?;
            if let Some(supplied) = supplied_legacy {
                if bridge.as_deref() != Some(supplied.as_str()) {
                    return Err(bad("catalog item conflicts with supplied legacy classification"));
                }
            }
            Ok((Some(item_id), bridge))
        }
        TaskCatalogId::Null => {
            let clear_legacy = match current_id {
                Some(item_id) => {
                    legacy_for_item(tx, project_id, kind, item_id).await?.as_deref()
                        == current_legacy.as_deref()
                }
                None => false,
            };
            Ok((None, if clear_legacy { None } else { current_legacy }))
        }
        TaskCatalogId::Omitted => match supplied_legacy {
            Some(legacy) => Ok((item_for_legacy(tx, project_id, kind, &legacy).await?, Some(legacy))),
            None => Ok((current_id, current_legacy)),
        },
    }
}

pub async fn resolve_create_task_catalogs(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    progress_id: Option<Uuid>,
    category_id: Option<Uuid>,
    task_type_id: Option<Uuid>,
    progress_legacy: Option<String>,
    category_legacy: Option<String>,
    task_type_legacy: Option<String>,
) -> Result<TaskCatalogState> {
    let (progress_id, progress_legacy) = resolve_one(
        tx,
        project_id,
        ProjectCatalogKind::ProgressType,
        progress_id.map(TaskCatalogId::Value).unwrap_or(TaskCatalogId::Omitted),
        progress_legacy,
        None,
        None,
    )
    .await?;
    let (category_id, category_legacy) = resolve_one(
        tx,
        project_id,
        ProjectCatalogKind::Category,
        category_id.map(TaskCatalogId::Value).unwrap_or(TaskCatalogId::Omitted),
        category_legacy,
        None,
        None,
    )
    .await?;
    let (task_type_id, task_type_legacy) = resolve_one(
        tx,
        project_id,
        ProjectCatalogKind::TaskType,
        task_type_id.map(TaskCatalogId::Value).unwrap_or(TaskCatalogId::Omitted),
        task_type_legacy,
        None,
        None,
    )
    .await?;
    Ok(TaskCatalogState {
        progress_id,
        category_id,
        task_type_id,
        progress_legacy,
        category_legacy,
        task_type_legacy,
    })
}

pub async fn resolve_update_task_catalogs(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    project_id: Uuid,
    progress_request: TaskCatalogId,
    category_request: TaskCatalogId,
    task_type_request: TaskCatalogId,
    progress_legacy: Option<String>,
    category_legacy: Option<String>,
    task_type_legacy: Option<String>,
    current: TaskCatalogState,
) -> Result<TaskCatalogState> {
    let (progress_id, progress_legacy) = resolve_one(
        tx, project_id, ProjectCatalogKind::ProgressType, progress_request, progress_legacy,
        current.progress_id, current.progress_legacy,
    )
    .await?;
    let (category_id, category_legacy) = resolve_one(
        tx, project_id, ProjectCatalogKind::Category, category_request, category_legacy,
        current.category_id, current.category_legacy,
    )
    .await?;
    let (task_type_id, task_type_legacy) = resolve_one(
        tx, project_id, ProjectCatalogKind::TaskType, task_type_request, task_type_legacy,
        current.task_type_id, current.task_type_legacy,
    )
    .await?;
    Ok(TaskCatalogState {
        progress_id,
        category_id,
        task_type_id,
        progress_legacy,
        category_legacy,
        task_type_legacy,
    })
}
