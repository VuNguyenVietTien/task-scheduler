use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, FixedOffset};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, DeriveActiveModelBehavior)]
#[sea_orm(table_name = "task_dependencies")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub dependent_task_id: Uuid,
    #[sea_orm(primary_key)]
    pub dependency_task_id: Uuid,
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::DependentTaskId",
        to = "super::task::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    DependentTask,

    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::DependencyTaskId",
        to = "super::task::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    DependencyTask,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DependencyTask.def()
    }
}
