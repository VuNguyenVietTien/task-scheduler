//! `SeaORM` Entity. This file is partially generated.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use super::{project_members, tasks, users};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub description: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub status: String,  // 'NEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'
    pub priority: String, // 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    #[sea_orm(column_type = "Text", nullable)]
    pub category: Option<String>,
    #[sea_orm(column_type = "Json", nullable)]
    pub metadata: Option<JsonValue>,
    pub visibility: String, // 'PUBLIC', 'PRIVATE', 'TEAM'
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub tags: Option<JsonValue>,
    pub progress: f32,  // 0-100%
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    ProjectMembers,
    Tasks,
    Users,
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::ProjectMembers => Entity::has_many(project_members::Entity).into(),
            Self::Tasks => Entity::has_many(tasks::Entity).into(),
            Self::Users => Entity::belongs_to(users::Entity)
                .from(Column::CreatedBy)
                .to(users::Column::Id)
                .into(),
        }
    }
}

impl Related<project_members::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProjectMembers.def()
    }
}

impl Related<tasks::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tasks.def()
    }
}

impl Related<users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
