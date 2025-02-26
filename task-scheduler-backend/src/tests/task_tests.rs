use super::helpers::*;
use crate::graphql::{
    resolvers::task::{TaskQuery, TaskMutation},
    types::CreateTaskInput,
};
use async_graphql::*;
use uuid::Uuid;
use crate::auth::AuthUser;

#[tokio::test]
async fn test_create_task() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = TaskMutation;
    let input = CreateTaskInput {
        project_id: project.id.into(),
        parent_task_id: None,
        title: "New Task".to_string(),
        description: Some("Task Description".to_string()),
        status: "BACKLOG".to_string(),
        priority: "HIGH".to_string(),
        effort_hours: Some(4.0),
        start_date: None,
        deadline: None,
        assignee_ids: vec![],
    };

    let result = mutation.create_task(&ctx, input).await;
    assert!(result.is_ok());

    let task = result.unwrap();
    assert_eq!(task.title, "New Task");
    assert_eq!(task.status, "BACKLOG");
    assert_eq!(task.priority, "HIGH");
}

#[tokio::test]
async fn test_update_task_status() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let task = create_test_task(&db, project.id, user.id).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = TaskMutation;
    let result = mutation
        .update_task_status(&ctx, task.id.into(), "IN_PROGRESS".to_string())
        .await;

    assert!(result.is_ok());
    let updated_task = result.unwrap();
    assert_eq!(updated_task.status, "IN_PROGRESS");
}

#[tokio::test]
async fn test_assign_task() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let assignee = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let task = create_test_task(&db, project.id, user.id).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = TaskMutation;
    let result = mutation
        .assign_task(&ctx, task.id.into(), assignee.id.into())
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_get_task() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let task = create_test_task(&db, project.id, user.id).await;
    let ctx = create_test_context(db);

    let query = TaskQuery;
    let result = query.task(&ctx, task.id.into()).await;

    assert!(result.is_ok());
    let fetched_task = result.unwrap();
    assert!(fetched_task.is_some());
    let fetched_task = fetched_task.unwrap();
    assert_eq!(fetched_task.id, task.id.into());
    assert_eq!(fetched_task.title, task.title);
}

#[tokio::test]
async fn test_get_tasks() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    
    // Create multiple tasks
    let task1 = create_test_task(&db, project.id, user.id).await;
    let task2 = create_test_task(&db, project.id, user.id).await;
    
    let ctx = create_test_context(db);
    let query = TaskQuery;

    // Test filtering by project
    let result = query.tasks(&ctx, Some(project.id.into()), None, None).await;
    assert!(result.is_ok());
    let tasks = result.unwrap();
    assert_eq!(tasks.len(), 2);

    // Test filtering by status
    let result = query
        .tasks(&ctx, None, Some("BACKLOG".to_string()), None)
        .await;
    assert!(result.is_ok());
    let tasks = result.unwrap();
    assert!(!tasks.is_empty());
}

#[tokio::test]
async fn test_invalid_task_creation() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = TaskMutation;
    let input = CreateTaskInput {
        project_id: Uuid::new_v4().into(), // Non-existent project
        parent_task_id: None,
        title: "New Task".to_string(),
        description: Some("Task Description".to_string()),
        status: "BACKLOG".to_string(),
        priority: "HIGH".to_string(),
        effort_hours: Some(4.0),
        start_date: None,
        deadline: None,
        assignee_ids: vec![],
    };

    let result = mutation.create_task(&ctx, input).await;
    assert!(result.is_err());
}
