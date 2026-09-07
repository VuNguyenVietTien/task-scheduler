use async_graphql::{Context, InputObject, Object, Result, ID};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    CreateProjectInput, MemberRole, Project, ProjectMember, ProjectPriority, ProjectResponse,
    ProjectStatus, ProjectVisibility, Projects, User,
};

#[derive(Default)]
pub struct ProjectQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectQuery {
    // Lấy project theo project_id
    async fn project(&self, ctx: &Context<'_>, project_id: ID) -> Result<Project> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Kiểm tra user đã đăng nhập
        let current_user = context
            .auth
            .as_ref()
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
                        AND pm.role IS NOT NULL
                    )
                )
            )
            "#,
        )
        .bind(project_id)
        .bind(current_user.user_id()?)
        .fetch_one(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let has_access: bool = access_check.get(0);
        if !has_access {
            return Err(
                AuthError::Forbidden("You don't have access to this project".into()).into(),
            );
        }

        // Lấy thông tin project và owner
        let project = sqlx::query(
            r#"
            WITH project_members_count AS (
                SELECT project_id, COUNT(*) as member_count
                FROM project_members
                WHERE role IS NOT NULL
                GROUP BY project_id
            )
            SELECT 
                p.*,
                COALESCE(pmc.member_count, 0) AS member_count,
                u.user_id as owner_id,
                u.email as owner_email,
                u.username as owner_name,
                u.full_name as owner_full_name,
                u.avatar_url as owner_avatar_url
            FROM projects p
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN project_members_count pmc ON p.project_id = pmc.project_id
            WHERE p.project_id = $1
            "#,
        )
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Lấy thông tin members trong project
        let members = sqlx::query(
            r#"
            SELECT
                pm.role::text AS role,
                pm.joined_at,
                u.user_id,
                u.username,
                u.avatar_url,
                u.email,
                u.full_name
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.user_id
            WHERE pm.project_id = $1 AND pm.role IS NOT NULL
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Map members data
        let project_members: Vec<ProjectMember> = members
            .into_iter()
            .map(|row: PgRow| {
                Ok(ProjectMember {
                    role: MemberRole::from_database_row(&row)?,
                    joined_at: row.get("joined_at"),
                    user: User {
                        user_id: row.get("user_id"),
                        email: row.get("email"),
                        username: row.get("username"),
                        full_name: row.get("full_name"),
                        avatar_url: row.get::<Option<String>, _>("avatar_url"),
                    },
                })
            })
            .collect::<Result<_>>()?;

        // Lấy thông tin vai trò của user hiện tại trong project
        let user_role = sqlx::query(
            r#"
            SELECT role::text AS role FROM project_members
            WHERE project_id = $1 AND user_id = $2 AND role IS NOT NULL
            "#,
        )
        .bind(project_id)
        .bind(current_user.user_id()?)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let user_role = user_role
            .as_ref()
            .map(MemberRole::from_database_row)
            .transpose()?;

        // In ra log để debug
        match &user_role {
            Some(role) => println!("User role in project: {:?}", role),
            None => println!("User has no specific role in project"),
        }

        // Map project data
        let project = Project {
            project_id: project.get("project_id"),
            name: project.get("name"),
            description: project.get::<Option<String>, _>("description"),
            created_at: project.get("created_at"),
            updated_at: project.get("updated_at"),
            priority: project.get("priority"),
            visibility: project.get("visibility"),
            tags: project.get::<Option<Value>, _>("tags").and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(String::from))
                        .collect()
                })
            }),
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
            created_by: None,
            user_role: user_role,
            members: project_members,
        };

        eprintln!("\n=== Get Project Response ===");
        eprintln!(
            "Project: {}",
            json!({
                "id": project.project_id,
                "name": project.name,
                "owner": {
                    "id": project.owner.user_id,
                    "email": project.owner.email
                },
                "memberCount": project.member_count
            })
        );
        eprintln!("=========================\n");

        Ok(project)
    }

    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Projects>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Kiểm tra user đã đăng nhập
        let current_user = context
            .auth
            .as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;

        // Get all projects that user is a member of, including member counts
        let projects = sqlx::query(
            r#"
            WITH project_members_count AS (
            SELECT project_id, COUNT(*) as member_count
            FROM project_members
            WHERE role IS NOT NULL
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
            COALESCE(pmc.member_count, 0) AS member_count,
            u.user_id as owner_id,
            u.email as owner_email,
            u.username as owner_name,
            u.full_name as owner_full_name,
            u.avatar_url as owner_avatar_url
            FROM projects p
            INNER JOIN users u ON p.owner_id = u.user_id
            LEFT JOIN project_members_count pmc ON p.project_id = pmc.project_id
            WHERE p.owner_id = $1 OR EXISTS (
                SELECT 1 FROM project_members pm
                WHERE pm.project_id = p.project_id AND pm.user_id = $1 AND pm.role IS NOT NULL
            )
            ORDER BY p.created_at DESC
            "#,
        )
        .bind(current_user.user_id()?)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let result: Vec<Projects> = projects
            .into_iter()
            .map(|row: PgRow| {
                // Lấy giá trị date, xử lý null bằng cách sử dụng Option
                let start_date: Option<NaiveDate> = row.get("start_date");
                let end_date: Option<NaiveDate> = row.get("end_date");

                // Chuyển đổi NaiveDate sang DateTime<Utc> với xử lý null
                let start_datetime = start_date.map_or_else(
                    || Utc::now(), // Giá trị mặc định nếu null
                    |date| {
                        DateTime::<Utc>::from_utc(
                            date.and_hms_opt(0, 0, 0).unwrap_or_default(),
                            Utc,
                        )
                    },
                );
                let end_datetime = end_date.map_or_else(
                    || Utc::now() + chrono::Duration::days(30), // Giá trị mặc định nếu null
                    |date| {
                        DateTime::<Utc>::from_utc(
                            date.and_hms_opt(0, 0, 0).unwrap_or_default(),
                            Utc,
                        )
                    },
                );

                Projects {
                    project_id: row.get("project_id"),
                    name: row.get("name"),
                    start_date: start_datetime,
                    end_date: end_datetime,
                    status: row.get("status"),
                    member_count: row.get("member_count"),
                    progress: row.get("progress"),
                    category: row.get("category"),
                    priority: row.get("priority"),
                    visibility: row.get("visibility"),
                    icon_url: row.get("icon_url"),
                    owner: User {
                        user_id: row.get("owner_id"),
                        email: row.get("owner_email"),
                        username: row.get::<Option<String>, _>("owner_name"),
                        full_name: row.get::<Option<String>, _>("owner_full_name"),
                        avatar_url: row.get::<Option<String>, _>("owner_avatar_url"),
                    },
                }
            })
            .collect();

        eprintln!("\n=== Get Projects Response ===");
        eprintln!("Found {} projects", result.len());
        eprintln!(
            "Projects: {}",
            json!(result
                .iter()
                .map(|p| {
                    json!({
                        "project_id": p.project_id,
                        "name": p.name,
                        "status": p.status,
                        "member_count": p.member_count
                    })
                })
                .collect::<Vec<_>>())
        );
        eprintln!("===========================\n");

        Ok(result)
    }
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectResponse> {
        eprintln!("\n=== Create Project Request ===");
        eprintln!(
            "Input Data: {}",
            json!({
                "name": &input.name,
                "description": &input.description,
                "startDate": &input.start_date,
                "endDate": &input.end_date,
                "status": &input.status.map(|s| format!("{:?}", s)),
                "priority": &input.priority.map(|p| format!("{:?}", p)),
                "visibility": &input.visibility.map(|v| format!("{:?}", v)),
                "tags": &input.tags
            })
        );

        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Kiểm tra user đã đăng nhập
        let current_user = context
            .auth
            .as_ref()
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;

        // Start transaction
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Create project
        let project_id = Uuid::new_v4();
        let now = Utc::now();
        let owner_id = current_user.user_id()?;

        // Convert tags to JSONB if provided
        let tags_json = if let Some(tags) = input.tags {
            json!(tags)
        } else {
            json!([])
        };

        // Manually set default and convert enum values to lowercase strings
        let status_str = match input.status {
            Some(status) => match status {
                ProjectStatus::Active => "active",
                ProjectStatus::Completed => "completed",
                ProjectStatus::OnHold => "on_hold",
                ProjectStatus::Cancelled => "cancelled",
            },
            None => "active", // Default
        };

        let priority_str = match input.priority {
            Some(priority) => match priority {
                ProjectPriority::Low => "low",
                ProjectPriority::Medium => "medium",
                ProjectPriority::High => "high",
                ProjectPriority::Urgent => "urgent",
            },
            None => "medium", // Default
        };

        let visibility_str = match input.visibility {
            Some(visibility) => match visibility {
                ProjectVisibility::Public => "public",
                ProjectVisibility::Private => "private",
                ProjectVisibility::Team => "team",
            },
            None => "private", // Default
        };

        eprintln!("Enum values for DB insertion:");
        eprintln!("- status: {}", status_str);
        eprintln!("- priority: {}", priority_str);
        eprintln!("- visibility: {}", visibility_str);
        eprintln!("===========================\n");

        // Use a modified query with text values for enums
        let project_row = sqlx::query(
            r#"
            WITH inserted_project AS (
            INSERT INTO projects (
                project_id, name, description, owner_id,
                start_date, end_date, created_at, updated_at, 
                status, priority, visibility, tags,
                category, metadata, icon_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::project_status, $10::project_priority, $11::project_visibility, $12, $13, $14, $15)
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
        .bind(status_str)     // Use string value instead of enum
        .bind(priority_str)   // Use string value instead of enum
        .bind(visibility_str) // Use string value instead of enum
        .bind(tags_json)
        .bind(&input.category)
        .bind(&input.metadata)
        .bind(&input.icon_url)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            eprintln!("ERROR creating project: {:?}", e);
            AuthError::Database(e)
        })?;

        // Create the owner's canonical resource identity and access together.
        let member_id = Uuid::new_v4();
        let resource_member_id = Uuid::new_v4();
        let display_name = [
            project_row.get::<Option<String>, _>("owner_full_name"),
            project_row.get::<Option<String>, _>("owner_name"),
        ]
        .into_iter()
        .flatten()
        .find(|name| !name.trim().is_empty())
        .unwrap_or_else(|| project_row.get("owner_email"));
        sqlx::query(
            r#"
            INSERT INTO project_members
                (member_id, resource_member_id, project_id, display_name, user_id, role, joined_at)
            VALUES ($1, $2, $3, $4, $5, 'manager', $6)
            "#,
        )
        .bind(member_id)
        .bind(resource_member_id)
        .bind(project_id)
        .bind(display_name)
        .bind(owner_id)
        .bind(now)
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
            tags: project_row.get::<Option<Value>, _>("tags").and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(String::from))
                        .collect()
                })
            }),
            members: vec![], // Owner is added as member
        };

        eprintln!("\n=== Create Project Response ===");
        eprintln!("{:#?}", result);
        eprintln!("============================\n");

        Ok(result)
    }
}
