use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, FixedOffset};
use serde_json::Value as JsonValue;

use crate::db::enums::{ProjectStatus, ProjectPriority, ProjectVisibility};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, DeriveActiveModelBehavior)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_by: Uuid,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
    pub status: String, // Stored as string in DB but validated through enum
    pub priority: String,
    pub category: Option<String>,
    pub metadata: Option<JsonValue>,
    pub visibility: String,
    pub tags: Option<JsonValue>,
    pub progress: f32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        has_many = "super::task::Entity",
        from = "Column::Id",
        to = "super::task::Column::ProjectId"
    )]
    Tasks,

    #[sea_orm(
        has_many = "super::project_member::Entity",
        from = "Column::Id",
        to = "super::project_member::Column::ProjectId"
    )]
    Members,

    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    Creator,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tasks.def()
    }
}

impl Related<super::project_member::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Members.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Creator.def()
    }
}

impl Model {
    pub fn get_status(&self) -> Result<ProjectStatus, String> {
        self.status.parse::<ProjectStatus>()
            .map_err(|_| format!("Invalid project status: {}", self.status))
    }

    pub fn get_priority(&self) -> Result<ProjectPriority, String> {
        self.priority.parse::<ProjectPriority>()
            .map_err(|_| format!("Invalid project priority: {}", self.priority))
    }

    pub fn get_visibility(&self) -> Result<ProjectVisibility, String> {
        self.visibility.parse::<ProjectVisibility>()
            .map_err(|_| format!("Invalid project visibility: {}", self.visibility))
    }

    pub fn set_status(&mut self, status: ProjectStatus) {
        self.status = status.to_string();
    }

    pub fn set_priority(&mut self, priority: ProjectPriority) {
        self.priority = priority.to_string();
    }

    pub fn set_visibility(&mut self, visibility: ProjectVisibility) {
        self.visibility = visibility.to_string();
    }
}
