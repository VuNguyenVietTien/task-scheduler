use async_graphql::{Context, Object, Result};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;

use crate::graphql::context::Context as AppContext;
use crate::graphql::resolvers::plans::mutation::Plan;
use crate::error::AppError;

#[derive(Default)]
pub struct PlanQuery;

#[Object]
impl PlanQuery {
    /// Lấy danh sách plan của project
    async fn get_project_plans(&self, ctx: &Context<'_>, project_id: String) -> Result<Vec<Plan>> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let _user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| AppError::validation("Invalid project ID").to_graphql_error())?;
        
        let plans = get_project_plans(db, project_id)
            .await
            .map_err(|e| e.to_graphql_error())?;
        
        Ok(plans)
    }

    /// Lấy plan mới nhất của project
    async fn get_latest_project_plan(&self, ctx: &Context<'_>, project_id: String) -> Result<Option<Plan>> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let _user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| AppError::validation("Invalid project ID").to_graphql_error())?;
        
        let plan = get_latest_project_plan(db, project_id)
            .await
            .map_err(|e| e.to_graphql_error())?;
        
        Ok(plan)
    }

    /// Lấy chi tiết plan
    async fn get_plan(&self, ctx: &Context<'_>, id: String) -> Result<Option<Plan>> {
        let context = ctx.data::<AppContext>()?;
        let db = &context.db;
        let _user_id = context.auth.as_ref()
            .and_then(|auth| auth.user_id().ok())
            .ok_or_else(|| AppError::forbidden("Unauthorized").to_graphql_error())?;
        
        let plan_id = Uuid::parse_str(&id)
            .map_err(|_| AppError::validation("Invalid plan ID").to_graphql_error())?;
        
        let plan = get_plan(db, plan_id)
            .await
            .map_err(|e| e.to_graphql_error())?;
        
        Ok(plan)
    }
}

pub async fn get_project_plans(db: &Pool<Postgres>, project_id: Uuid) -> Result<Vec<Plan>, AppError> {
    let plans = sqlx::query_as!(
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
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
        project_id
    )
    .fetch_all(db)
    .await?;
    
    Ok(plans)
}

pub async fn get_latest_project_plan(db: &Pool<Postgres>, project_id: Uuid) -> Result<Option<Plan>, AppError> {
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
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
        project_id
    )
    .fetch_optional(db)
    .await?;
    
    Ok(plan)
}

async fn get_plan(db: &Pool<Postgres>, plan_id: Uuid) -> Result<Option<Plan>, AppError> {
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