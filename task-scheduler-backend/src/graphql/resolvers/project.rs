use async_graphql::{Context, Object, Result, ID, InputObject};
use chrono::Utc;
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;
use serde_json::json;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    CreateProjectInput, Projects, Project, ProjectMember, ProjectResponse, ProjectStatus, MemberRole, User
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
        let current_user = context.current_user.as_ref()
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
        .bind(current_user.user_id)
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
            description: Some(project.get::<Option<String>, _>("description").unwrap_or_default()),
            created_at: project.get("created_at"),
            updated_at: Some(project.get::<Option<DateTime<Utc>>, _>("updated_at").unwrap_or_default()),
            priority: project.get("priority"),
            visibility: project.get("visibility"), 
            tags: project.get::<Option<Vec<String>>, _>("tags").unwrap_or_default(),
            progress: project.get("progress"),
            category: project.get::<Option<String>, _>("category").unwrap_or_default(),
            metadata: project.get::<Option<serde_json::Value>, _>("metadata").unwrap_or_default(),
            start_date: project.get::<Option<DateTime<Utc>>, _>("start_date").unwrap_or_default(),
            end_date: project.get::<Option<DateTime<Utc>>, _>("end_date").unwrap_or_default(),
            icon_url: Some(project.get::<Option<String>, _>("icon_url").unwrap_or_default()),
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

    async fn projects(&self, ctx: &Context<'_>, user_id: ID) -> Result<Vec<Projects>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        
        // Kiểm tra user đã đăng nhập
        let current_user = context.current_user.as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;
        
        let user_id = Uuid::parse_str(&user_id.to_string())?;

        // Chỉ cho phép user lấy projects của chính họ
        if current_user.user_id != user_id {
            return Err(AuthError::Forbidden("You can only view your own projects".into()).into());
        }

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
        .bind(user_id)
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
            progress: row.get("progress"),
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
        eprintln!("Found {} projects for user {}", result.len(), user_id);
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
            "ownerId": &input.ownerId,
            "startDate": &input.start_date,
            "endDate": &input.end_date,
            "members": &input.members
        }));
        eprintln!("===========================\n");

        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Kiểm tra user đã đăng nhập
        let current_user = context.current_user.as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;

        // Chỉ cho phép user tạo project với owner là chính họ
        if current_user.user_id != input.ownerId {
            return Err(AuthError::Forbidden("You can only create projects for yourself".into()).into());
        }

        // Start transaction
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Create project
        let project_id = Uuid::new_v4();
        let now = Utc::now();
        let project_row = sqlx::query(
            r#"
            WITH inserted_project AS (
            INSERT INTO projects (
                project_id, name, description, owner_id,
                start_date, end_date, created_at, updated_at, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            )
            SELECT 
            p.*,
            u.user_id as owner_id,
            u.email as owner_email,
            u.username as owner_name,
            u.full_name as owner_full_name,
            u.avatar_url as owner_avatar_url,
            COUNT(pm.member_id) as member_count
            FROM inserted_project p
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN project_members pm ON p.project_id = pm.project_id
            GROUP BY p.project_id, u.user_id, u.email, u.name, u.full_name, u.avatar_url
            "#
        )
        .bind(project_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.ownerId)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(now)
        .bind(now)
        .bind(ProjectStatus::active)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Add members
        let mut members = Vec::new();
        for member in input.members {
            let member_id = Uuid::new_v4();
            let member_row = sqlx::query(
            r#"
            INSERT INTO project_members (
                member_id, project_id, user_id, role
            )
            VALUES ($1, $2, $3, $4)
            RETURNING 
                pm.role,
                u.user_id,
                u.username,
                u.avatar_url
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.user_id
            "#
            )
            .bind(member_id)
            .bind(project_id)
            .bind(member.user_id)
            .bind(member.role)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AuthError::Database(e))?;

            members.push(ProjectMember {
            user_id: member_row.get("user_id"),
            role: member_row.get("role"),
            username: member_row.get("username"),
            avatar_url: member_row.get::<Option<String>, _>("avatar_url").unwrap_or_default(),
            });
        }

        // Commit transaction
        tx.commit().await.map_err(|e| AuthError::Database(e))?;

        let result = ProjectResponse {
            project_id: project_row.get("project_id"),
            name: project_row.get("name"),
            description: project_row.get("description"),
            start_date: project_row.get("start_date"),
            end_date: project_row.get("end_date"),
            status: project_row.get("status"),
            owner: User {
                user_id: project_row.get("owner_id"),
                email: project_row.get("owner_email"),
                username: project_row.get("owner_name"),
                full_name: project_row.get("owner_full_name"),
                avatar_url: project_row.get("owner_avatar_url"),
            },
            progress: project_row.get("progress"),
            category: project_row.get("category"),
            priority: project_row.get("priority"),
            visibility: project_row.get("visibility"),
            icon_url: project_row.get("icon_url"),
            created_at: project_row.get("created_at"),
            metadata: project_row.get("metadata"),
            is_public: project_row.get("is_public"),
            tags: project_row.get::<Option<Vec<String>>, _>("tags").unwrap_or_default(),
            members,
        };

        eprintln!("\n=== Create Project Response ===");
        eprintln!("{:#?}", result);
        eprintln!("============================\n");

        Ok(result)
    }
}
