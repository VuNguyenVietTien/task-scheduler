use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    #[sea_orm(column_type = "Text")]
    pub description: Option<String>,
    #[sea_orm(column_type = "String(Some(50))")]
    pub status: String,
    #[sea_orm(column_type = "String(Some(50))")]
    pub priority: String,
    pub priority_order: i32,
    pub effort_hours: Option<f32>,
    pub start_date: Option<DateTimeWithTimeZone>,
    pub deadline: Option<DateTimeWithTimeZone>,
    pub created_by: Uuid,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    #[sea_orm(column_type = "JsonBinary")]
    pub metadata: Json,
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
        belongs_to = "Entity",
        from = "Column::ParentTaskId",
        to = "Column::Id"
    )]
    ParentTask,
    
    #[sea_orm(has_many = "Entity")]
    SubTasks,
    
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    Creator,
    
    #[sea_orm(has_many = "super::comment::Entity")]
    Comments,
    
    #[sea_orm(has_many = "super::attachment::Entity")]
    Attachments,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Creator.def()
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

impl ActiveModelBehavior for ActiveModel {
    fn before_save(mut self, insert: bool) -> Result<Self, DbErr> {
        if insert {
            self.created_at = Set(chrono::Utc::now().into());
        }
        self.updated_at = Set(chrono::Utc::now().into());
        Ok(self)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TaskStatus {
    Backlog,
    InProgress,
    Done,
}

impl From<&str> for TaskStatus {
    fn from(status: &str) -> Self {
        match status {
            "IN_PROGRESS" => TaskStatus::InProgress,
            "DONE" => TaskStatus::Done,
            _ => TaskStatus::Backlog,
        }
    }
}

impl ToString for TaskStatus {
    fn to_string(&self) -> String {
        match self {
            TaskStatus::Backlog => "BACKLOG".to_string(),
            TaskStatus::InProgress => "IN_PROGRESS".to_string(),
            TaskStatus::Done => "DONE".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TaskPriority {
    High,
    Medium,
    Low,
}

impl From<&str> for TaskPriority {
    fn from(priority: &str) -> Self {
        match priority {
            "HIGH" => TaskPriority::High,
            "MEDIUM" => TaskPriority::Medium,
            _ => TaskPriority::Low,
        }
    }
}

impl ToString for TaskPriority {
    fn to_string(&self) -> String {
        match self {
            TaskPriority::High => "HIGH".to_string(),
            TaskPriority::Medium => "MEDIUM".to_string(),
            TaskPriority::Low => "LOW".to_string(),
        }
    }
}
