use std::sync::Arc;
use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct TaskLoader;

#[derive(Clone)]
pub struct ProjectLoader;

#[derive(Clone)]
pub struct UserLoader;

#[derive(Clone)]
pub struct CommentLoader;

#[derive(Clone)]
pub struct Loaders {
    pub task: TaskLoader,
    pub project: ProjectLoader,
    pub user: UserLoader,
    pub comment: CommentLoader,
}

impl Loaders {
    pub fn new(_db: Arc<DatabaseConnection>) -> Self {
        Self {
            task: TaskLoader,
            project: ProjectLoader,
            user: UserLoader,
            comment: CommentLoader,
        }
    }
}
