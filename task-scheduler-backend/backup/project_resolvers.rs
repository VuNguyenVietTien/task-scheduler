use async_graphql::{Context, Object, Result, ID, InputObject};
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;
use serde_json::{json, Value};

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    CreateProjectInput, Projects, Project, ProjectMember, ProjectResponse, 
    ProjectStatus, ProjectPriority, ProjectVisibility, MemberRole, User
};

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    // Lấy project theo project_id
    async fn project(&self, ctx: &Context<'_>, project_id: ID) -> Result<Project> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        
        // Kiểm tra user đã đăng nhập
        let current_user = context.auth.as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;
            
        let project_id = Uuid::parse_str(&project_id.to_string())?;

        // Kiểm tra quyền truy cập project (là member hoặc owner)
        let access_check = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM projects p 
                WHERE p.project_id = $1
                AND (
                    p.owner_id = $2 
                    OR EXISTS (
                        SELECT 1 FROM project_members pm 
                        WHERE pm.project_id = p.project_id 
                        AND pm.user_id = $2
                    )
                )
            )
            "#
        )
        .bind(project_id)
        .bind(current_user.user_id()?)
        .fetch_one(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let has_access: bool = access_check.get(0);
        if !has_access {
            return Err(AuthError::Forbidden("You don't have access to this project".into()).into());
        }

        // Lấy thông tin project và owner
        let project = sqlx::query(
            r#"
            WITH project_members_count AS (
                SELECT project_id, COUNT(*) as member_count
                FROM project_members
                GROUP BY project_id
            )
            SELECT 
                p.*,
                pmc.member_count,
                u.user_id as owner_id,
                u.email as owner_email,
                u.username as owner_name,
                u.full_name as owner_full_name,
                u.avatar_url as owner_avatar_url
            FROM projects p
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN project_members_count pmc ON p.project_id = pmc.project_id
            WHERE p.project_id = $1
            "#
        )
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Lấy thông tin members trong project
        let members = sqlx::query(
            r#"
            SELECT
                pm.role,
                u.user_id,
                u.username,
                u.avatar_url
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.user_id
            WHERE pm.project_id = $1
            "#
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Map members data
        let project_members: Vec<ProjectMember> = members
            .into_iter()
            .map(|row: PgRow| ProjectMember {
                user_id: row.get("user_id"),
                role: row.get("role"),
                username: row.get("username"),
                avatar_url: row.get::<Option<String>, _>("avatar_url").unwrap_or_default(),
            })
            .collect();

        // Map project data
        let project = Project {
            project_id: project.get("project_id"),
            name: project.get("name"),
            description: project.get::<Option<String>, _>("description"),
            created_at: project.get("created_at"),
            updated_at: project.get("updated_at"),
            priority: project.get("priority"),
            visibility: project.get("visibility"), 
            tags: project.get::<Option<Value>, _>("tags").and_then(|v| v.as_array().map(|arr| arr.iter().filter_map(|val| val.as_str().map(String::from)).collect())),
            progress: project.get::<f64, _>("progress"),
            category: project.get("category"),
            metadata: project.get("metadata"),
            start_date: project.get("start_date"),
            end_date: project.get("end_date"),
            icon_url: project.get("icon_url"),
            is_public: project.get("is_public"),
            status: project.get("status"),
            member_count: project.get("member_count"),
            owner: User {
                user_id: project.get("owner_id"),
                email: project.get("owner_email"),
                username: project.get("owner_name"), 
                full_name: project.get("owner_full_name"),
                avatar_url: project.get::<Option<String>, _>("owner_avatar_url"),
            },
            members: project_members,
        };

        eprintln!("\n=== Get Project Response ===");
        eprintln!("Project: {}", json!({
            "id": project.project_id,
            "name": project.name,
            "owner": {
                "id": project.owner.user_id,
                "email": project.owner.email
            },
            "memberCount": project.member_count
        }));
        eprintln!("=========================\n");

        Ok(project)
    }

    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Projects>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        
        // Kiểm tra user đã đăng nhập
        let current_user = context.auth.as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;

        // Get all projects that user is a member of, including member counts
        let projects = sqlx::query(
            r#"
            WITH project_members_count AS (
            SELECT project_id, COUNT(*) as member_count
            FROM project_members
            GROUP BY project_id
            )
            SELECT 
            p.project_id,
            p.name,
            p.description,
            p.start_date,
            p.end_date,
            p.status,
            p.created_at,
            p.updated_at,
            p.progress,
            p.category,
            p.priority,
            p.visibility,
            p.icon_url,
            pmc.member_count,
            u.user_id as owner_id,
            u.email as owner_email,
            u.username as owner_name,
            u.full_name as owner_full_name,
            u.avatar_url as owner_avatar_url
            FROM projects p
            INNER JOIN project_members pm ON p.project_id = pm.project_id
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN project_members_count pmc ON p.project_id = pmc.project_id
            WHERE pm.user_id = $1
            ORDER BY p.created_at DESC
            "#
        )
        .bind(current_user.user_id()?)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let result: Vec<Projects> = projects.into_iter().map(|row: PgRow| {
            Projects {
                project_id: row.get("project_id"),
                name: row.get("name"),
                start_date: row.get::<Option<_>, _>("start_date").unwrap_or_else(|| Utc::now()),
                end_date: row.get::<Option<_>, _>("end_date").unwrap_or_else(|| Utc::now()),
                status: row.get("status"),
                member_count: row.get("member_count"),
                progress: row.get::<f64, _>("progress"),
                category: row.get::<Option<_>, _>("category").unwrap_or_else(|| "".to_string()),
                priority: row.get("priority"),
                visibility: row.get("visibility"),
                icon_url: row.get("icon_url"),
                owner: User {
                    user_id: row.get("owner_id"),
                    email: row.get("owner_email"),
                    username: row.get("owner_name"),
                    full_name: row.get("owner_full_name"),
                    avatar_url: row.get::<Option<_>, _>("owner_avatar_url"),
                },
            }
        }).collect();

        eprintln!("\n=== Get Projects Response ===");
        eprintln!("Found {} projects", result.len());
        eprintln!("Projects: {}", json!(result.iter().map(|p| {
            json!({
                "project_id": p.project_id,
                "name": p.name,
                "status": p.status,
                "member_count": p.member_count
            })
        }).collect::<Vec<_>>()));
        eprintln!("===========================\n");

        Ok(result)
    }
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectResponse> {
        eprintln!("\n=== Create Project Request ===");
        eprintln!("Input Data: {}", json!({
            "name": &input.name,
            "description": &input.description,
            "startDate": &input.start_date,
            "endDate": &input.end_date,
            "status": &input.status,
            "priority": &input.priority,
            "visibility": &input.visibility,
            "tags": &input.tags
        }));
        eprintln!("===========================\n");

        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Kiểm tra user đã đăng nhập
        let current_user = context.auth.as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;

        // Start transaction
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Create project
        let project_id = Uuid::new_v4();
        let now = Utc::now();
        let owner_id = current_user.user_id()?;

        // Convert tags to JSONB
        let tags_json = if let Some(tags) = input.tags {
            json!(tags)
        } else {
            json!([])
        };

        let project_row = sqlx::query(
            r#"
            WITH inserted_project AS (
            INSERT INTO projects (
                project_id, name, description, owner_id,
                start_date, end_date, created_at, updated_at, 
                status, priority, visibility, tags,
                category, metadata, icon_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
            ),
            member_count AS (
                SELECT project_id, COUNT(member_id) as member_count
                FROM project_members 
                GROUP BY project_id
            )
            SELECT 
                p.*,
                u.user_id as owner_id,
                u.email as owner_email,
                u.username as owner_name,
                u.full_name as owner_full_name,
                u.avatar_url as owner_avatar_url,
                COALESCE(mc.member_count, 0) as member_count
            FROM inserted_project p
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN member_count mc ON p.project_id = mc.project_id
            "#
        )
        .bind(project_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(owner_id)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(now)
        .bind(now)
        .bind(input.status.unwrap_or(ProjectStatus::Active))
        .bind(input.priority.unwrap_or(ProjectPriority::Medium))
        .bind(input.visibility.unwrap_or(ProjectVisibility::Private))
        .bind(tags_json) // Use converted tags
        .bind(&input.category)
        .bind(&input.metadata)
        .bind(&input.icon_url)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Add owner as a member with ADMIN role
        let member_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO project_members (member_id, project_id, user_id, role)
            VALUES ($1, $2, $3, $4)
            "#
        )
        .bind(member_id)
        .bind(project_id)
        .bind(owner_id)
        .bind(MemberRole::Admin)
        .execute(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Commit transaction
        tx.commit().await.map_err(|e| AuthError::Database(e))?;

        let result = ProjectResponse {
            projectId: project_row.get("project_id"),
            name: project_row.get("name"),
            description: project_row.get::<Option<String>, _>("description"),
            startDate: project_row.get::<Option<NaiveDate>, _>("start_date"),
            endDate: project_row.get::<Option<NaiveDate>, _>("end_date"),
            status: project_row.get("status"),
            owner: User {
                user_id: project_row.get("owner_id"),
                email: project_row.get("owner_email"),
                username: project_row.get("owner_name"),
                full_name: project_row.get("owner_full_name"),
                avatar_url: project_row.get("owner_avatar_url"),
            },
            progress: project_row.get::<f64, _>("progress"),
            category: project_row.get::<Option<String>, _>("category"),
            priority: project_row.get("priority"),
            visibility: project_row.get("visibility"),
            iconUrl: project_row.get::<Option<String>, _>("icon_url"),
            createdAt: project_row.get("created_at"),
            metadata: project_row.get::<Option<Value>, _>("metadata"),
            isPublic: project_row.get("is_public"),
            tags: project_row.get::<Option<Value>, _>("tags").and_then(|v| v.as_array().map(|arr| arr.iter().filter_map(|val| val.as_str().map(String::from)).collect())),
            members: vec![], // Owner is added as member
        };

        eprintln!("\n=== Create Project Response ===");
        eprintln!("{:#?}", result);
        eprintln!("============================\n");

        Ok(result)
    }
}
