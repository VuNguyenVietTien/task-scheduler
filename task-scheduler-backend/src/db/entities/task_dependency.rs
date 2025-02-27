use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "task_dependencies")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub dependent_task_id: Uuid,
    #[sea_orm(primary_key, auto_increment = false)]
    pub dependency_task_id: Uuid,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::DependentTaskId",
        to = "super::task::Column::Id",
        on_delete = "Cascade"
    )]
    DependentTask,
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::DependencyTaskId",
        to = "super::task::Column::Id",
        on_delete = "Cascade"
    )]
    DependencyTask,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DependentTask.def()
    }
}

// Custom implementation để lấy task được phụ thuộc
impl Entity {
    pub fn find_dependency_tasks() -> RelationDef {
        Relation::DependencyTask.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}