use sqlx::Row;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::db::{
    models::{Project, Task, ProjectMember, TaskStatus, Comment},
    types::{ProjectStatus, ProjectPriority, ProjectVisibility, MemberRole},
};
use sqlx::postgres::PgRow;

pub fn row_to_project(row: PgRow) -> Result<Project, sqlx::Error> {
    Ok(Project {
        project_id: row.try_get("project_id")?,
        name: row.try_get("name")?,
        description: row.try_get("description")?,
        owner_id: row.try_get("owner_id")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        status: row.try_get::<String, _>("status")?.parse().map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid status: {}", e)
            )))
        })?,
        priority: row.try_get::<String, _>("priority")?.parse().map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid priority: {}", e)
            )))
        })?,
        visibility: row.try_get::<String, _>("visibility")?.parse().map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid visibility: {}", e)
            )))
        })?,
        tags: row.try_get("tags")?,
        progress: row.try_get("progress")?,
        category: row.try_get("category")?,
        metadata: row.try_get("metadata")?,
    })
}

pub fn row_to_task(row: PgRow) -> Result<Task, sqlx::Error> {
    Ok(Task {
        task_id: row.try_get("task_id")?,
        project_id: row.try_get("project_id")?,
        parent_task_id: row.try_get("parent_task_id")?,
        title: row.try_get("title")?,
        description: row.try_get("description")?,
        assignee_id: row.try_get("assignee_id")?,
        status: row.try_get("status_id")?,
        priority_order: row.try_get("priority_order")?,
        start_date: row.try_get("start_date")?,
        due_date: row.try_get("due_date")?,
        actual_start_date: row.try_get("actual_start_date")?,
        actual_end_date: row.try_get("actual_end_date")?,
        effort: row.try_get("effort")?,
        progress: row.try_get("progress")?,
        created_by: row.try_get("created_by")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        is_deleted: row.try_get("is_deleted")?,
        type_: row.try_get("type_")?,
        category: row.try_get("category")?,
        progress_type: row.try_get("progress_type")?,
        tags: row.try_get("tags")?,
        priority: row.try_get("priority")?,
    })
}

pub fn row_to_member(row: PgRow) -> Result<ProjectMember, sqlx::Error> {
    Ok(ProjectMember {
        member_id: row.try_get("member_id")?,
        project_id: row.try_get("project_id")?,
        user_id: row.try_get("user_id")?,
        role: row.try_get::<String, _>("role")?.parse().map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid role: {}", e)
            )))
        })?,
        joined_at: row.try_get("joined_at")?,
        invited_by: row.try_get("invited_by")?,
    })
}

pub fn row_to_task_status(row: PgRow) -> Result<TaskStatus, sqlx::Error> {
    Ok(TaskStatus {
        status_id: row.try_get("status_id")?,
        project_id: row.try_get("project_id")?,
        name: row.try_get("name")?,
        description: row.try_get("description")?,
        color: row.try_get("color")?,
        display_order: row.try_get("display_order")?,
        is_default: row.try_get("is_default")?,
        is_done: row.try_get("is_done")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

pub fn row_to_comment(row: PgRow) -> Result<Comment, sqlx::Error> {
    Ok(Comment {
        comment_id: row.try_get("comment_id")?,
        task_id: row.try_get("task_id")?,
        user_id: row.try_get("user_id")?,
        content: row.try_get("content")?,
        parent_comment_id: row.try_get("parent_comment_id")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        is_deleted: row.try_get("is_deleted")?,
    })
}
