pub mod query;
pub mod mutation;

pub use query::PlanQuery;
pub use mutation::PlanMutation;

use async_graphql::{
    Context,
    Object,
    Result,
    SimpleObject,
    InputObject,
    ID,
    Error as GraphQLError,
    ErrorExtensions,
    Json,
};
use uuid::Uuid;
use sqlx::PgPool;
use serde_json::Value as JsonValue;

use crate::db::{self, plans as db_plans}; // Import db functions
use crate::error::{AppError, IntoGraphQLResult}; // Import error types
use crate::graphql::types::{User, Project}; // Import other GraphQL types if needed for relations
use crate::session::AppSession; // Assuming session is passed via context
use crate::auth::error::AuthError; // Import AuthError for specific error handling
use crate::auth::RequireAuth;

// --- GraphQL Object Type for Plan ---

// Mirroring the `db::plans::Plan` struct but for GraphQL
// We might need to resolve relations like `createdBy` here.
#[derive(Debug, Clone)]
pub struct Plan {
    pub plan_id: ID, // Use ID scalar type
    pub project_id: ID,
    pub name: String,
    pub description: Option<String>,
    // created_by: ID, // We'll resolve this to a User object
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
    pub plan_data: Json<serde_json::Value>, // Use async_graphql::Value for JSON

    // Internal fields not exposed directly via GraphQL but needed for resolvers
    #[graphql(skip)]
    pub(crate) raw_created_by: Uuid,
    #[graphql(skip)]
    pub(crate) raw_project_id: Uuid,
}

// Function to convert db::plans::Plan to graphql::Plan
impl From<db_plans::Plan> for Plan {
    fn from(db_plan: db_plans::Plan) -> Self {
        Plan {
            plan_id: ID(db_plan.plan_id.to_string()),
            project_id: ID(db_plan.project_id.to_string()),
            name: db_plan.name,
            description: db_plan.description,
            created_at: db_plan.created_at,
            updated_at: db_plan.updated_at,
            is_active: db_plan.is_active,
            plan_data: Json(db_plan.plan_data.0), // Extract serde_json::Value from sqlx::types::Json
            raw_created_by: db_plan.created_by,
            raw_project_id: db_plan.project_id,
        }
    }
}

// --- Field Resolvers for Plan (Complex Fields) ---
#[Object]
impl Plan {
    // Resolver for the `createdBy` field
    async fn created_by(&self, ctx: &Context<'_>) -> Result<User> {
        let pool = ctx.data::<PgPool>()?;
        // TODO: Implement db::users::find_by_id function
        let user_result = crate::db::find_user_by_id(pool, self.raw_created_by).await;
        user_result
            .map(|db_user| crate::graphql::types::User::from(db_user)) // Chuyển đổi db::User -> graphql::User
            .map_err(|e| {
                 log::error!("Failed to resolve createdBy for plan {}: {}", self.plan_id.0, e);
                 AppError::Database(e).to_graphql_error()
            })
    }
    
    // Maybe resolve `project` field as well?
    // async fn project(&self, ctx: &Context<'_>) -> Result<Project> { ... }
}

// --- GraphQL Input Types ---

#[derive(InputObject, Debug)]
pub struct CreatePlanInput {
    pub project_id: ID,
    pub name: String,
    pub description: Option<String>,
    pub plan_data: Json<serde_json::Value>, // Expecting JSON
}

#[derive(InputObject, Debug)]
pub struct UpdatePlanInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub plan_data: Option<Json<serde_json::Value>>,
}

// --- Query Resolver ---

#[derive(Default)]
pub struct PlanQuery;

#[Object]
impl PlanQuery {
    // Corresponds to `projectPlans(projectId: ID!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn project_plans(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<Plan>> {
        let pool = ctx.data::<PgPool>()?;
        let project_uuid = Uuid::parse_str(project_id.as_str())?;
        
        log::info!("Query: projectPlans for project {}", project_uuid);
        
        db_plans::find_by_project_id(pool, project_uuid).await
            .map(|plans| plans.into_iter().map(Plan::from).collect())
            .into_graphql_result()
    }

    // Corresponds to `latestProjectPlan(projectId: ID!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn latest_project_plan(&self, ctx: &Context<'_>, project_id: ID) -> Result<Option<Plan>> {
        let pool = ctx.data::<PgPool>()?;
        let project_uuid = Uuid::parse_str(project_id.as_str())?;
            
        log::info!("Query: latestProjectPlan for project {}", project_uuid);

        db_plans::find_latest_by_project_id(pool, project_uuid).await
            .map(|opt_plan| opt_plan.map(Plan::from))
            .into_graphql_result()
    }

    // Corresponds to `plan(planId: ID!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn plan(&self, ctx: &Context<'_>, plan_id: ID) -> Result<Option<Plan>> {
        let pool = ctx.data::<PgPool>()?;
        let plan_uuid = Uuid::parse_str(plan_id.as_str())?;
            
        log::info!("Query: plan {}", plan_uuid);

        let maybe_plan = db_plans::find_by_id(pool, plan_uuid).await.into_graphql_result()?;

        Ok(maybe_plan)
    }
}

// --- Mutation Resolver ---

#[derive(Default)]
pub struct PlanMutation;

#[Object]
impl PlanMutation {
    // Corresponds to `createPlan(input: CreatePlanInput!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn create_plan(&self, ctx: &Context<'_>, input: CreatePlanInput) -> Result<Plan> {
        let pool = ctx.data::<PgPool>()?;
        let project_uuid = Uuid::parse_str(input.project_id.as_str())?;

        log::info!("Mutation: createPlan '{}' for project {}", input.name, project_uuid);

        let plan_data_json: serde_json::Value = input.plan_data.0;
        let db_plan_data = sqlx::types::Json(plan_data_json);

        let db_input = db_plans::CreatePlanData {
            project_id: project_uuid,
            name: input.name,
            description: input.description,
            plan_data: db_plan_data,
        };

        db_plans::create(pool, Uuid::nil(), db_input).await
            .map(Plan::from)
            .into_graphql_result()
    }

    // Corresponds to `updatePlan(planId: ID!, input: UpdatePlanInput!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn update_plan(&self, ctx: &Context<'_>, plan_id: ID, input: UpdatePlanInput) -> Result<Plan> {
        let pool = ctx.data::<PgPool>()?;
        let plan_uuid = Uuid::parse_str(plan_id.as_str())?;
        
        log::info!("Mutation: updatePlan {}", plan_uuid);

        let db_plan_data = input.plan_data.map(|json_val| sqlx::types::Json(json_val.0));

        let db_input = db_plans::UpdatePlanData {
            name: input.name,
            description: input.description,
            plan_data: db_plan_data,
        };

        db_plans::update(pool, plan_uuid, db_input).await
            .map_err(AppError::from)
            .and_then(|opt_plan| opt_plan.ok_or_else(|| AppError::not_found("Plan not found")))
            .map(Plan::from)
            .into_graphql_result()
    }

    // Corresponds to `deletePlan(planId: ID!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn delete_plan(&self, ctx: &Context<'_>, plan_id: ID) -> Result<bool> {
        let pool = ctx.data::<PgPool>()?;
        let plan_uuid = Uuid::parse_str(plan_id.as_str())?;
        
        log::info!("Mutation: deletePlan {}", plan_uuid);

        let rows_affected = db_plans::delete(pool, plan_uuid).await.into_graphql_result()?;
        
        Ok(rows_affected > 0)
    }

    // Corresponds to `setPlanActive(planId: ID!)`
    #[graphql(guard = "RequireAuth::default()")]
    async fn set_plan_active(&self, ctx: &Context<'_>, project_id: ID, plan_id: ID) -> Result<Plan> {
        let pool = ctx.data::<PgPool>()?;
        let project_uuid = Uuid::parse_str(project_id.as_str())?;
        let plan_uuid = Uuid::parse_str(plan_id.as_str())?;
        
        log::info!("Mutation: setPlanActive {} for project {}", plan_uuid, project_uuid);

        let plan_to_activate = db_plans::find_by_id(pool, plan_uuid).await
            .map_err(AppError::from)
            .and_then(|opt_plan| opt_plan.ok_or_else(|| AppError::not_found("Plan to activate not found")))
            .into_graphql_result()?;
        
        if plan_to_activate.project_id != project_uuid {
             return Err(AppError::BadRequest("Plan does not belong to the specified project".into()).into());
        }

        Ok(Plan::from(plan_to_activate))
    }
}

// Helper to get user_uuid from session stored in context
fn get_user_uuid_from_session(session: &AppSession) -> Result<Uuid, GraphQLError> {
    let user_id_str = session.get_user_id()
        .ok_or_else(|| AppError::Auth(AuthError::Unauthorized("User not found in session".to_string())).to_graphql_error())?;
    Uuid::parse_str(&user_id_str)
        .map_err(|_| AppError::Internal("Invalid user ID format in session".to_string()).to_graphql_error())
} 