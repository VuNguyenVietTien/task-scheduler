use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub password_hash: String,
    #[sea_orm(column_type = "String(Some(50))")]
    pub role: String,
    pub work_capacity: f32,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::task::Entity")]
    Task,
    #[sea_orm(has_many = "super::project::Entity")]
    Project,
    #[sea_orm(has_many = "super::comment::Entity")]
    Comment,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::comment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Comment.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    /// Custom behavior on before_save
    fn before_save(mut self, insert: bool) -> Result<Self, DbErr> {
        if insert {
            self.created_at = Set(chrono::Utc::now().into());
        }
        self.updated_at = Set(chrono::Utc::now().into());
        Ok(self)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum UserRole {
    Admin,
    Manager,
    Member,
}

impl From<&str> for UserRole {
    fn from(role: &str) -> Self {
        match role {
            "ADMIN" => UserRole::Admin,
            "MANAGER" => UserRole::Manager,
            _ => UserRole::Member,
        }
    }
}

impl ToString for UserRole {
    fn to_string(&self) -> String {
        match self {
            UserRole::Admin => "ADMIN".to_string(),
            UserRole::Manager => "MANAGER".to_string(),
            UserRole::Member => "MEMBER".to_string(),
        }
    }
}
