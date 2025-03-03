use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, FixedOffset};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, DeriveActiveModelBehavior)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub role: String,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        has_many = "super::project::Entity",
        from = "Column::Id",
        to = "super::project::Column::CreatedBy"
    )]
    CreatedProjects,

    #[sea_orm(
        has_many = "super::project_member::Entity",
        from = "Column::Id",
        to = "super::project_member::Column::UserId"
    )]
    ProjectMemberships,

    #[sea_orm(
        has_many = "super::task::Entity",
        from = "Column::Id",
        to = "super::task::Column::CreatedBy"
    )]
    CreatedTasks,

    #[sea_orm(
        has_many = "super::comment::Entity",
        from = "Column::Id",
        to = "super::comment::Column::UserId"
    )]
    Comments,

    #[sea_orm(
        has_many = "super::notification::Entity",
        from = "Column::Id",
        to = "super::notification::Column::UserId"
    )]
    Notifications,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CreatedProjects.def()
    }
}

impl Related<super::project_member::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProjectMemberships.def()
    }
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CreatedTasks.def()
    }
}

impl Related<super::comment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Comments.def()
    }
}

impl Related<super::notification::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Notifications.def()
    }
}

impl Model {
    pub fn is_admin(&self) -> bool {
        self.role == "admin"
    }
}
