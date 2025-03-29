use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(SimpleObject)]
pub struct Plan {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
    pub plan_data: PlanData,
}

#[derive(SimpleObject, Deserialize, Serialize)]
pub struct PlanData {
    pub tasks: Vec<PlanTaskData>,
    #[serde(default)]
    pub metadata: Option<PlanMetadata>,
}

#[derive(SimpleObject, Deserialize, Serialize)]
pub struct PlanTaskData {
    pub task_id: String,
    pub priority_order: i32,
    #[serde(default)]
    pub original_priority: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(SimpleObject, Deserialize, Serialize)]
pub struct PlanMetadata {
    #[serde(default)]
    pub last_sorted_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub sort_criteria: Option<String>,
}

#[derive(InputObject)]
pub struct CreatePlanInput {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub plan_data: CreatePlanDataInput,
}

#[derive(InputObject)]
pub struct UpdatePlanInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub plan_data: Option<CreatePlanDataInput>,
}

#[derive(InputObject)]
pub struct CreatePlanDataInput {
    pub tasks: Vec<CreatePlanTaskDataInput>,
    pub metadata: Option<CreatePlanMetadataInput>,
}

#[derive(InputObject)]
pub struct CreatePlanTaskDataInput {
    pub task_id: String,
    pub priority_order: i32,
    pub original_priority: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(InputObject)]
pub struct CreatePlanMetadataInput {
    pub last_sorted_date: Option<DateTime<Utc>>,
    pub sort_criteria: Option<String>,
} 