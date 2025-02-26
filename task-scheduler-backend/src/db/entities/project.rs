use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub description: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    Creator,
    
    #[sea_orm(has_many = "super::task::Entity")]
    Tasks,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Creator.def()
    }
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tasks.def()
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

// Project member role enum
#[derive(Debug, Serialize, Deserialize)]
pub enum ProjectRole {
    Owner,
    Editor,
    Viewer,
}

impl From<&str> for ProjectRole {
    fn from(role: &str) -> Self {
        match role {
            "OWNER" => ProjectRole::Owner,
            "EDITOR" => ProjectRole::Editor,
            _ => ProjectRole::Viewer,
        }
    }
}

impl ToString for ProjectRole {
    fn to_string(&self) -> String {
        match self {
            ProjectRole::Owner => "OWNER".to_string(),
            ProjectRole::Editor => "EDITOR".to_string(),
            ProjectRole::Viewer => "VIEWER".to_string(),
        }
    }
}

// Project member entity (for many-to-many relationship between projects and users)
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "project_members")]
pub struct ProjectMember {
    #[sea_orm(primary_key)]
    pub project_id: Uuid,
    #[sea_orm(primary_key)]
    pub user_id: Uuid,
    #[sea_orm(column_type = "String(Some(50))")]
    pub role: String,
    pub joined_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum ProjectMemberRelation {
    #[sea_orm(
        belongs_to = "Entity",
        from = "Column::ProjectId",
        to = "Column::Id"
    )]
    Project,
    
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
}

impl Related<Entity> for ProjectMember {
    fn to() -> RelationDef {
        ProjectMemberRelation::Project.def()
    }
}

impl Related<super::user::Entity> for ProjectMember {
    fn to() -> RelationDef {
        ProjectMemberRelation::User.def()
    }
}

impl ActiveModelBehavior for ProjectMemberActiveModel {
    fn before_save(mut self, insert: bool) -> Result<Self, DbErr> {
        if insert {
            self.joined_at = Set(chrono::Utc::now().into());
        }
        Ok(self)
    }
}
