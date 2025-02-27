use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    #[sea_orm(nullable)]
    pub parent_task_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub title: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub description: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub status: String,  // 'BACKLOG', 'IN_PROGRESS', 'DONE'
    #[sea_orm(column_type = "Text")]
    pub priority: String,  // 'HIGH', 'MEDIUM', 'LOW'
    #[sea_orm(column_type = "Float", nullable)]
    pub effort_hours: Option<f32>,
    #[sea_orm(nullable)]
    pub start_date: Option<DateTimeWithTimeZone>,
    #[sea_orm(nullable)]
    pub deadline: Option<DateTimeWithTimeZone>,
    pub created_by: Uuid,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub metadata: Option<Value>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::project::Entity",
        from = "Column::ProjectId",
        to = "super::project::Column::Id"
    )]
    Project,
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::ParentTaskId",
        to = "Column::Id"
    )]
    ParentTask,
    #[sea_orm(
        has_many = "super::task::Entity",
        from = "Column::Id",
        to = "Column::ParentTaskId"
    )]
    Subtasks,
    #[sea_orm(has_many = "super::task_assignment::Entity")]
    TaskAssignment,
    #[sea_orm(has_many = "super::comment::Entity")]
    Comment,
    #[sea_orm(has_many = "super::attachment::Entity")]
    Attachment,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    Creator,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::task_assignment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TaskAssignment.def()
    }
}

impl Related<super::comment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Comment.def()
    }
}

impl Related<super::attachment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Attachment.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Creator.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
