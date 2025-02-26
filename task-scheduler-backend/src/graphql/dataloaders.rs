use async_graphql::dataloader::*;
use sea_orm::{DatabaseConnection, EntityTrait, ModelTrait};
use std::collections::HashMap;
use uuid::Uuid;

use crate::db::entities::{user, task, project, comment, attachment};
use crate::error::AppResult;

pub struct Loaders {
    pub user: UserLoader,
    pub task: TaskLoader,
    pub project: ProjectLoader,
    pub comment: CommentLoader,
    pub attachment: AttachmentLoader,
}

impl Loaders {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            user: UserLoader::new(db.clone()),
            task: TaskLoader::new(db.clone()),
            project: ProjectLoader::new(db.clone()),
            comment: CommentLoader::new(db.clone()),
            attachment: AttachmentLoader::new(db.clone()),
        }
    }
}

// User loader
pub struct UserLoader {
    db: DatabaseConnection,
}

impl UserLoader {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for UserLoader {
    type Value = user::Model;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let users = user::Entity::find()
            .filter(user::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(users.into_iter().map(|u| (u.id, u)).collect())
    }
}

// Task loader
pub struct TaskLoader {
    db: DatabaseConnection,
}

impl TaskLoader {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for TaskLoader {
    type Value = task::Model;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let tasks = task::Entity::find()
            .filter(task::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(tasks.into_iter().map(|t| (t.id, t)).collect())
    }
}

// Project loader
pub struct ProjectLoader {
    db: DatabaseConnection,
}

impl ProjectLoader {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for ProjectLoader {
    type Value = project::Model;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let projects = project::Entity::find()
            .filter(project::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(projects.into_iter().map(|p| (p.id, p)).collect())
    }
}

// Comment loader
pub struct CommentLoader {
    db: DatabaseConnection,
}

impl CommentLoader {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for CommentLoader {
    type Value = comment::Model;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let comments = comment::Entity::find()
            .filter(comment::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(comments.into_iter().map(|c| (c.id, c)).collect())
    }
}

// Attachment loader
pub struct AttachmentLoader {
    db: DatabaseConnection,
}

impl AttachmentLoader {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for AttachmentLoader {
    type Value = attachment::Model;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let attachments = attachment::Entity::find()
            .filter(attachment::Column::Id.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(attachments.into_iter().map(|a| (a.id, a)).collect())
    }
}
