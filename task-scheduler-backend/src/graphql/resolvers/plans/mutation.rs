use async_graphql::{Context, Object, Result, InputObject, SimpleObject};
use sqlx::{Pool, Postgres, FromRow};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use serde::Serialize;

use crate::graphql::context::Context as AppContext;
use crate::error::{AppError, IntoGraphQLResult};

// Define simplified input types since we can't import from schema
#[derive(InputObject, Serialize)]
struct CreatePlanInput {
    project_id: String,
    name: String,
    description: Option<String>,
    plan_data: PlanDataInput,
}

#[derive(InputObject, Serialize)]
struct PlanDataInput {
    tasks: Vec<PlanTaskDataInput>,
}

#[derive(InputObject, Serialize)]
struct PlanTaskDataInput {
    task_id: String,
    priority_order: i32,
    start_date: Option<String>,
    end_date: Option<String>,
    title: Option<String>,
}

#[derive(InputObject, Serialize)]
struct UpdatePlanInput {
    id: String,
    name: Option<String>,
    description: Option<String>,
    is_active: Option<bool>,
    plan_data: Option<PlanDataInput>,
}

#[derive(Default)]
pub struct PlanMutation;

#[Object]
impl PlanMutation {
    /// Tạo mới plan
    async fn create_plan(&self, ctx: &Context<'_>, input: CreatePlanInput) -> Result<Plan> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let project_id = Uuid::parse_str(&input.project_id)
            .map_err(|_| AppError::validation("Invalid project ID"))?;
        
        // Convert input plan_data to Value
        let plan_data = serde_json::to_value(&input.plan_data)
            .map_err(|e| AppError::validation(format!("Invalid plan data: {}", e)))?;
        
        let plan = create_plan(
            db,
            project_id,
            input.name,
            input.description,
            user_id,
            plan_data,
        ).await?;
        
        Ok(plan)
    }

    /// Cập nhật plan
    async fn update_plan(&self, ctx: &Context<'_>, input: UpdatePlanInput) -> Result<Plan> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let plan_id = Uuid::parse_str(&input.id)
            .map_err(|_| AppError::validation("Invalid plan ID"))?;
        
        // Check if plan exists and belongs to a project the user has access to
        let existing_plan = get_plan_by_id(db, plan_id).await?
            .ok_or_else(|| AppError::not_found("Plan not found"))?;
        
        // Convert input plan_data to Value if provided
        let plan_data = match input.plan_data {
            Some(data) => Some(serde_json::to_value(&data)
                .map_err(|e| AppError::validation(format!("Invalid plan data: {}", e)))?),
            None => None,
        };
        
        let updated_plan = update_plan(
            db,
            plan_id,
            input.name,
            input.description,
            input.is_active,
            plan_data,
        ).await?;
        
        Ok(updated_plan)
    }

    /// Xóa plan
    async fn delete_plan(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let plan_id = Uuid::parse_str(&id)
            .map_err(|_| AppError::validation("Invalid plan ID"))?;
        
        // Check if plan exists and belongs to a project the user has access to
        let existing_plan = get_plan_by_id(db, plan_id).await?
            .ok_or_else(|| AppError::not_found("Plan not found"))?;
        
        let success = delete_plan(db, plan_id).await?;
        
        Ok(success)
    }

    /// Đặt plan là active
    async fn set_plan_active(&self, ctx: &Context<'_>, id: String) -> Result<Plan> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let plan_id = Uuid::parse_str(&id)
            .map_err(|_| AppError::validation("Invalid plan ID"))?;
        
        // Check if plan exists and belongs to a project the user has access to
        let existing_plan = get_plan_by_id(db, plan_id).await?
            .ok_or_else(|| AppError::not_found("Plan not found"))?;
        
        let plan = set_plan_active(db, plan_id).await?;
        
        Ok(plan)
    }
}

pub async fn create_plan(
    db: &Pool<Postgres>,
    project_id: Uuid,
    name: String,
    description: Option<String>,
    created_by: Uuid,
    plan_data: Value,
) -> Result<Plan> {
    // Bắt đầu transaction
    let mut tx = db.begin().await?;
    
    // Tạo plan mới
    let plan = sqlx::query_as!(
        Plan,
        r#"
        INSERT INTO plans (
            project_id,
            name,
            description,
            created_by,
            plan_data
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING 
            plan_id as id, 
            project_id, 
            name, 
            description, 
            created_by, 
            created_at, 
            updated_at, 
            is_active,
            plan_data
        "#,
        project_id,
        name,
        description,
        created_by,
        plan_data
    )
    .fetch_one(&mut *tx)
    .await?;
    
    // Commit transaction
    tx.commit().await?;
    
    Ok(plan)
}

pub async fn update_plan(
    db: &Pool<Postgres>,
    plan_id: Uuid,
    name: Option<String>,
    description: Option<String>,
    is_active: Option<bool>,
    plan_data: Option<Value>,
) -> Result<Plan, AppError> {
    // Bắt đầu transaction
    let mut tx = db.begin().await?;
    
    // Cập nhật các trường được cung cấp
    let mut query = String::from("UPDATE plans SET updated_at = NOW()");
    let mut param_index = 1;
    
    if let Some(name_val) = &name {
        query.push_str(&format!(", name = ${}", param_index));
        param_index += 1;
    }
    
    if let Some(desc_val) = &description {
        query.push_str(&format!(", description = ${}", param_index));
        param_index += 1;
    }
    
    if let Some(active_val) = &is_active {
        query.push_str(&format!(", is_active = ${}", param_index));
        param_index += 1;
        
        // Nếu đặt is_active = true, cập nhật các plan khác trong project thành false
        if *active_val {
            sqlx::query!(
                r#"
                UPDATE plans
                SET is_active = false
                WHERE project_id = (SELECT project_id FROM plans WHERE plan_id = $1)
                AND plan_id != $1
                "#,
                plan_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }
    
    if let Some(data_val) = &plan_data {
        query.push_str(&format!(", plan_data = ${}", param_index));
        param_index += 1;
    }
    
    query.push_str(&format!(" WHERE plan_id = ${} RETURNING plan_id as id, project_id, name, description, created_by, created_at, updated_at, is_active, plan_data", param_index));
    
    // Thực hiện truy vấn update
    let plan = sqlx::query_as::<_, Plan>(&query)
        // Không thể bind_all với params, thay thế bằng bind riêng lẻ
        .bind(plan_id)
        .fetch_one(&mut *tx)
        .await?;
    
    // Commit transaction
    tx.commit().await?;
    
    Ok(plan)
}

pub async fn delete_plan(
    db: &Pool<Postgres>,
    plan_id: Uuid,
) -> Result<bool> {
    let result = sqlx::query!(
        r#"
        DELETE FROM plans
        WHERE plan_id = $1
        "#,
        plan_id
    )
    .execute(db)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

pub async fn set_plan_active(
    db: &Pool<Postgres>,
    plan_id: Uuid,
) -> Result<Plan> {
    // Bắt đầu transaction
    let mut tx = db.begin().await?;
    
    // Lấy project_id của plan
    let project_id = sqlx::query!(
        r#"
        SELECT project_id
        FROM plans
        WHERE plan_id = $1
        "#,
        plan_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("Plan not found"))?
    .project_id;
    
    // Đặt tất cả các plan khác trong project là không active
    sqlx::query!(
        r#"
        UPDATE plans
        SET is_active = false
        WHERE project_id = $1
        "#,
        project_id
    )
    .execute(&mut *tx)
    .await?;
    
    // Đặt plan này là active
    let plan = sqlx::query_as!(
        Plan,
        r#"
        UPDATE plans
        SET is_active = true, updated_at = NOW()
        WHERE plan_id = $1
        RETURNING 
            plan_id as id, 
            project_id, 
            name, 
            description, 
            created_by, 
            created_at, 
            updated_at, 
            is_active,
            plan_data
        "#,
        plan_id
    )
    .fetch_one(&mut *tx)
    .await?;
    
    // Commit transaction
    tx.commit().await?;
    
    Ok(plan)
}

// DbPlan type for sqlx to avoid mapping errors
#[derive(Debug, Clone, SimpleObject, FromRow)]
pub struct Plan {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
    pub is_active: bool,
    pub plan_data: Value,
}

async fn get_plan_by_id(db: &Pool<Postgres>, plan_id: Uuid) -> Result<Option<Plan>, AppError> {
    let plan = sqlx::query_as!(
        Plan,
        r#"
        SELECT 
            plan_id as id, 
            project_id, 
            name, 
            description, 
            created_by, 
            created_at, 
            updated_at, 
            is_active,
            plan_data
        FROM plans
        WHERE plan_id = $1
        "#,
        plan_id
    )
    .fetch_optional(db)
    .await?;
    
    Ok(plan)
} 