use async_graphql::dataloader::*;
use sea_orm::{DatabaseConnection, EntityTrait, ColumnTrait, QueryFilter};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::db::entities::{
    TaskEntity, TaskModel,
    ProjectEntity, ProjectModel,
    UserEntity, UserModel,
    CommentEntity, CommentModel,
    task::Column as TaskColumn,
    project::Column as ProjectColumn,
    user::Column as UserColumn,
    comment::Column as CommentColumn,
};

#[derive(Clone)]
pub struct Loaders {
    pub task: TaskLoader,
    pub project: ProjectLoader,
    pub user: UserLoader,
    pub comment: CommentLoader,
}

impl Loaders {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self {
            task: TaskLoader::new(db.clone()),
            project: ProjectLoader::new(db.clone()),
            user: UserLoader::new(db.clone()),
            comment: CommentLoader::new(db),
        }
    }
}

#[derive(Clone)]
pub struct TaskLoader {
    db: Arc<DatabaseConnection>,
}

impl TaskLoader {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for TaskLoader {
    type Value = TaskModel;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let tasks = TaskEntity::find()
            .filter(TaskColumn::Id.is_in(keys.to_vec()))
            .all(&*self.db)
            .await?;

        Ok(tasks.into_iter().map(|task| (task.id, task)).collect())
    }
}

#[derive(Clone)]
pub struct ProjectLoader {
    db: Arc<DatabaseConnection>,
}

impl ProjectLoader {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for ProjectLoader {
    type Value = ProjectModel;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let projects = ProjectEntity::find()
            .filter(ProjectColumn::Id.is_in(keys.to_vec()))
            .all(&*self.db)
            .await?;

        Ok(projects.into_iter().map(|project| (project.id, project)).collect())
    }
}

#[derive(Clone)]
pub struct UserLoader {
    db: Arc<DatabaseConnection>,
}

impl UserLoader {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for UserLoader {
    type Value = UserModel;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let users = UserEntity::find()
            .filter(UserColumn::Id.is_in(keys.to_vec()))
            .all(&*self.db)
            .await?;

        Ok(users.into_iter().map(|user| (user.id, user)).collect())
    }
}

#[derive(Clone)]
pub struct CommentLoader {
    db: Arc<DatabaseConnection>,
}

impl CommentLoader {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Loader<Uuid> for CommentLoader {
    type Value = CommentModel;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Self::Value>, Self::Error> {
        let comments = CommentEntity::find()
            .filter(CommentColumn::TaskId.is_in(keys.to_vec()))
            .all(&*self.db)
            .await?;

        Ok(comments.into_iter().map(|comment| (comment.id, comment)).collect())
    }
}
