use async_trait::async_trait;
use sea_orm::{DatabaseConnection, EntityTrait, ModelTrait};
use std::collections::HashMap;
use uuid::Uuid;
use crate::db::entities::*;
use crate::error::AppResult;

pub struct UserLoader {
    pub db: DatabaseConnection
}

pub struct TaskLoader {
    pub db: DatabaseConnection
}

pub struct ProjectLoader {
    pub db: DatabaseConnection
}

pub struct CommentLoader {
    pub db: DatabaseConnection
}

pub struct AttachmentLoader {
    pub db: DatabaseConnection
}

#[async_trait]
impl DataLoader for UserLoader {
    type Key = Uuid;
    type Value = user::Model;
    type Error = sea_orm::DbErr;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let users = user::Entity::find()
            .filter(user::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(users.into_iter().map(|u| (u.id, u)).collect())
    }
}

#[async_trait]
impl DataLoader for TaskLoader {
    type Key = Uuid;
    type Value = task::Model;
    type Error = sea_orm::DbErr;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let tasks = task::Entity::find()
            .filter(task::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(tasks.into_iter().map(|t| (t.id, t)).collect())
    }
}

#[async_trait]
impl DataLoader for ProjectLoader {
    type Key = Uuid;
    type Value = project::Model;
    type Error = sea_orm::DbErr;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let projects = project::Entity::find()
            .filter(project::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(projects.into_iter().map(|p| (p.id, p)).collect())
    }
}

#[async_trait]
impl DataLoader for CommentLoader {
    type Key = Uuid;
    type Value = comment::Model;
    type Error = sea_orm::DbErr;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let comments = comment::Entity::find()
            .filter(comment::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(comments.into_iter().map(|c| (c.id, c)).collect())
    }
}

#[async_trait]
impl DataLoader for AttachmentLoader {
    type Key = Uuid;
    type Value = attachment::Model;
    type Error = sea_orm::DbErr;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let attachments = attachment::Entity::find()
            .filter(attachment::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(attachments.into_iter().map(|a| (a.id, a)).collect())
    }
}

pub trait DataLoader: Send + Sync {
    type Key: Send + Sync + std::hash::Hash + Eq + Clone;
    type Value: Send + Sync;
    type Error: Send + Sync + std::fmt::Debug;

    async fn load(&self, keys: &[Self::Key]) -> Result<HashMap<Self::Key, Self::Value>, Self::Error>;
}
