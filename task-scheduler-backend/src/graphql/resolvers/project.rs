use async_graphql::{Context, Object, ID, Result, InputObject};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row, pool::PoolConnection, Postgres, Transaction, Acquire};
use uuid::Uuid;

use crate::graphql::dataloaders::{ProjectLoader, UserLoader};

pub struct ProjectResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub workspace_id: Option<String>,
    pub icon_url: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_public: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[Object]
impl ProjectResponse {
    async fn id(&self) -> &str {
        &self.id
    }

    async fn name(&self) -> &str {
        &self.name
    }

    async fn description(&self) -> Option<&str> {
        self.description.as_deref()
    }

    async fn owner_id(&self) -> &str {
        &self.owner_id
    }

    async fn workspace_id(&self) -> Option<&str> {
        self.workspace_id.as_deref()
    }

    async fn icon_url(&self) -> Option<&str> {
        self.icon_url.as_deref()
    }

    async fn metadata(&self) -> Option<&JsonValue> {
        self.metadata.as_ref()
    }

    async fn is_public(&self) -> bool {
        self.is_public
    }

    async fn created_at(&self) -> chrono::DateTime<Utc> {
        self.created_at
    }

    async fn updated_at(&self) -> chrono::DateTime<Utc> {
        self.updated_at
    }

    async fn owner(&self, ctx: &Context<'_>) -> Result<Option<crate::graphql::dataloaders::UserInfo>> {
        let loader = ctx.data::<UserLoader>().unwrap();
        let owner_id = Uuid::parse_str(&self.owner_id)
            .map_err(|_| async_graphql::Error::new("Invalid owner ID"))?;
        Ok(loader.load(owner_id).await)
    }
}

impl TryFrom<sqlx::postgres::PgRow> for ProjectResponse {
    type Error = sqlx::Error;

    fn try_from(row: sqlx::postgres::PgRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.get::<Uuid, _>("project_id").to_string(),
            name: row.get("name"),
            description: row.get("description"),
            owner_id: row.get::<Uuid, _>("owner_id").to_string(),
            workspace_id: row.get::<Option<Uuid>, _>("workspace_id").map(|id| id.to_string()),
            icon_url: row.get("icon_url"),
            metadata: row.get("metadata"),
            is_public: row.get("is_public"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    pub async fn project(&self, ctx: &Context<'_>, id: ID) -> Result<Option<ProjectResponse>> {
        let db = ctx.data::<PgPool>().unwrap();
        let project_id = Uuid::parse_str(&id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;

        let record = sqlx::query(
            "SELECT project_id, name, description, owner_id, workspace_id,
                    icon_url, metadata, is_public, created_at, updated_at 
             FROM projects 
             WHERE project_id = $1"
        )
        .bind(project_id)
        .map(|row: sqlx::postgres::PgRow| ProjectResponse::try_from(row))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .transpose()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }

    pub async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<ProjectResponse>> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();

        let records = sqlx::query(
            "SELECT p.project_id, p.name, p.description, p.owner_id, p.workspace_id,
                    p.icon_url, p.metadata, p.is_public, p.created_at, p.updated_at
             FROM projects p
             INNER JOIN project_members pm ON p.project_id = pm.project_id
             WHERE pm.user_id = $1
             ORDER BY p.created_at DESC"
        )
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| ProjectResponse::try_from(row))
        .fetch_all(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(records)
    }
}

#[derive(InputObject, Deserialize, Clone)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub workspace_id: Option<String>,
    pub icon_url: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_public: Option<bool>,
}

#[derive(InputObject, Deserialize, Clone)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub workspace_id: Option<String>,
    pub icon_url: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_public: Option<bool>,
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    pub async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectResponse> {
        let pool = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;

        let input_clone = input.clone();
        let workspace_id = input.workspace_id.map(|id| {
            Uuid::parse_str(&id).map_err(|_| async_graphql::Error::new("Invalid workspace ID"))
        }).transpose()?;

        let mut tx = pool.begin().await
            .map_err(|e| async_graphql::Error::new(format!("Failed to start transaction: {}", e)))?;

        let project_id = Uuid::new_v4();
        let now = Utc::now();

        // Create project
        let record = sqlx::query(
            "INSERT INTO projects (
                project_id, name, description, owner_id, workspace_id,
                icon_url, metadata, is_public, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
            RETURNING project_id, name, description, owner_id, workspace_id,
                      icon_url, metadata, is_public, created_at, updated_at"
        )
        .bind(project_id)
        .bind(&input_clone.name)
        .bind(&input_clone.description)
        .bind(user_id)
        .bind(workspace_id)
        .bind(&input_clone.icon_url)
        .bind(&input_clone.metadata)
        .bind(input_clone.is_public.unwrap_or(false))
        .bind(now)
        .map(|row: sqlx::postgres::PgRow| ProjectResponse::try_from(row))
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to create project: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Failed to map project: {}", e)))?;

        // Add creator as admin member
        sqlx::query(
            "INSERT INTO project_members (project_id, user_id, role, created_at, updated_at)
             VALUES ($1, $2, 'admin', $3, $3)"
        )
        .bind(project_id)
        .bind(user_id)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to add project member: {}", e)))?;

        tx.commit().await
            .map_err(|e| async_graphql::Error::new(format!("Failed to commit transaction: {}", e)))?;

        Ok(record)
    }

    pub async fn update_project(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: UpdateProjectInput,
    ) -> Result<ProjectResponse> {
        let db = ctx.data::<PgPool>().unwrap();
        let project_id = Uuid::parse_str(&id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;

        let workspace_id = input.workspace_id.map(|id| {
            Uuid::parse_str(&id).map_err(|_| async_graphql::Error::new("Invalid workspace ID"))
        }).transpose()?;

        let now = Utc::now();

        let record = sqlx::query(
            "UPDATE projects 
             SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                workspace_id = COALESCE($3, workspace_id),
                icon_url = COALESCE($4, icon_url),
                metadata = COALESCE($5, metadata),
                is_public = COALESCE($6, is_public),
                updated_at = $7
             WHERE project_id = $8
             RETURNING project_id, name, description, owner_id, workspace_id,
                       icon_url, metadata, is_public, created_at, updated_at"
        )
        .bind(input.name)
        .bind(input.description)
        .bind(workspace_id)
        .bind(input.icon_url)
        .bind(input.metadata)
        .bind(input.is_public)
        .bind(now)
        .bind(project_id)
        .map(|row: sqlx::postgres::PgRow| ProjectResponse::try_from(row))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }
}
