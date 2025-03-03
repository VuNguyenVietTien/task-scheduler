use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, FixedOffset};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, DeriveActiveModelBehavior)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: i32,
    pub effort_hours: Option<f64>,
    pub start_date: Option<DateTime<FixedOffset>>,
    pub deadline: Option<DateTime<FixedOffset>>,
    pub created_by: Uuid,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::project::Entity",
        from = "Column::ProjectId",
        to = "super::project::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Project,

    #[sea_orm(
        belongs_to = "Entity",
        from = "Column::ParentTaskId",
        to = "Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    ParentTask,

    #[sea_orm(
        has_many = "super::comment::Entity",
        from = "Column::Id",
        to = "super::comment::Column::TaskId"
    )]
    Comments,

    #[sea_orm(
        has_many = "super::attachment::Entity",  
        from = "Column::Id",
        to = "super::attachment::Column::TaskId"
    )]
    Attachments,

    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id",
        on_update = "Cascade",
        on_delete = "NoAction"
    )]
    Creator,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::comment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Comments.def()
    }
}

impl Related<super::attachment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Attachments.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Creator.def()
    }
}
