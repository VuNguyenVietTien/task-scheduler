use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub status_id: Uuid,
    pub priority_order: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: i32,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

impl Task {
    pub fn new(
        project_id: Uuid,
        title: String,
        created_by: Uuid,
    ) -> Self {
        let now = Utc::now();
        Self {
            task_id: Uuid::new_v4(),
            project_id,
            parent_task_id: None,
            title,
            description: None,
            assignee_id: None,
            status_id: Uuid::nil(), // Should be set to project's default status
            priority_order: 0,
            start_date: None,
            due_date: None,
            actual_start_date: None,
            actual_end_date: None,
            effort: None,
            progress: 0,
            created_by,
            created_at: now,
            updated_at: now,
            is_deleted: false,
        }
    }

    pub fn set_description(&mut self, description: Option<String>) -> &mut Self {
        self.description = description;
        self.updated_at = Utc::now();
        self
    }

    pub fn assign_to(&mut self, assignee_id: Option<Uuid>) -> &mut Self {
        self.assignee_id = assignee_id;
        self.updated_at = Utc::now();
        self
    }

    pub fn set_status(&mut self, status_id: Uuid) -> &mut Self {
        self.status_id = status_id;
        self.updated_at = Utc::now();
        self
    }

    pub fn set_dates(
        &mut self,
        start_date: Option<DateTime<Utc>>,
        due_date: Option<DateTime<Utc>>,
    ) -> &mut Self {
        self.start_date = start_date;
        self.due_date = due_date;
        self.updated_at = Utc::now();
        self
    }

    pub fn update_progress(&mut self, progress: i32) -> &mut Self {
        self.progress = progress.clamp(0, 100);
        self.updated_at = Utc::now();
        self
    }

    pub fn set_priority_order(&mut self, order: i32) -> &mut Self {
        self.priority_order = order;
        self.updated_at = Utc::now();
        self
    }

    pub fn mark_started(&mut self) -> &mut Self {
        if self.actual_start_date.is_none() {
            self.actual_start_date = Some(Utc::now());
        }
        self.updated_at = Utc::now();
        self
    }

    pub fn mark_completed(&mut self) -> &mut Self {
        self.actual_end_date = Some(Utc::now());
        self.progress = 100;
        self.updated_at = Utc::now();
        self
    }

    pub fn soft_delete(&mut self) -> &mut Self {
        self.is_deleted = true;
        self.updated_at = Utc::now();
        self
    }
}