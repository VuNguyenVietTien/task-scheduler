use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub comment_id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub parent_comment_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

impl Comment {
    pub fn new(
        task_id: Uuid,
        user_id: Uuid,
        content: String,
        parent_comment_id: Option<Uuid>,
    ) -> Self {
        let now = Utc::now();
        Self {
            comment_id: Uuid::new_v4(),
            task_id,
            user_id,
            content,
            parent_comment_id,
            created_at: now,
            updated_at: now,
            is_deleted: false,
        }
    }

    pub fn update_content(&mut self, content: String) -> &mut Self {
        self.content = content;
        self.updated_at = Utc::now();
        self
    }

    pub fn soft_delete(&mut self) -> &mut Self {
        self.is_deleted = true;
        self.updated_at = Utc::now();
        self
    }
}
