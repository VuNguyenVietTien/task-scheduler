use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "attachments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    #[sea_orm(column_type = "Text")]
    pub storage_path: String,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::TaskId",
        to = "super::task::Column::Id"
    )]
    Task,
    
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn before_save(mut self, insert: bool) -> Result<Self, DbErr> {
        if insert {
            self.created_at = Set(chrono::Utc::now().into());
        }
        Ok(self)
    }
}

// Helper methods for file validation
impl Model {
    pub fn is_valid_size(&self, max_size: i64) -> bool {
        self.file_size <= max_size
    }

    pub fn is_allowed_type(&self, allowed_types: &[&str]) -> bool {
        allowed_types.contains(&self.mime_type.as_str())
    }

    pub fn storage_key(&self) -> String {
        format!("attachments/{}/{}", self.task_id, self.file_name)
    }
}

// Constants for file validation
pub const MAX_FILE_SIZE: i64 = 10 * 1024 * 1024; // 10MB
pub const ALLOWED_MIME_TYPES: [&str; 7] = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
];
