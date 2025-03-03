use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, FixedOffset};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, DeriveActiveModelBehavior)]
#[sea_orm(table_name = "attachments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_path: String,
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::TaskId",
        to = "super::task::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Task,

    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Uploader,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Uploader.def()
    }
}
