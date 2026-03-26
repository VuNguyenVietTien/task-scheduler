use super::helpers::*;
use crate::graphql::{
    resolvers::project::{ProjectQuery, ProjectMutation},
    types::{CreateProjectInput, AddProjectMemberInput},
};
use async_graphql::*;
use uuid::Uuid;
use crate::auth::AuthUser;

#[tokio::test]
async fn test_create_project() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context with manager role
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: "MANAGER".to_string(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = ProjectMutation;
    let input = CreateProjectInput {
        name: "Test Project".to_string(),
        description: Some("Project Description".to_string()),
    };

    let result = mutation.create_project(&ctx, input).await;
    assert!(result.is_ok());

    let project = result.unwrap();
    assert_eq!(project.name, "Test Project");
    assert_eq!(project.description, Some("Project Description".to_string()));
}

#[tokio::test]
async fn test_update_project() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context with manager role
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: "MANAGER".to_string(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = ProjectMutation;
    let result = mutation
        .update_project(
            &ctx,
            project.id.into(),
            Some("Updated Project".to_string()),
            Some("Updated Description".to_string()),
        )
        .await;

    assert!(result.is_ok());
    let updated_project = result.unwrap();
    assert_eq!(updated_project.name, "Updated Project");
    assert_eq!(updated_project.description, Some("Updated Description".to_string()));
}

#[tokio::test]
async fn test_add_project_member() {
    let db = setup_test_db().await;
    let owner = create_test_user(&db).await;
    let member = create_test_user(&db).await;
    let project = create_test_project(&db, owner.id).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user (owner) to context
    let auth_user = AuthUser {
        id: owner.id,
        email: owner.email.clone(),
        role: "MANAGER".to_string(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = ProjectMutation;
    let input = AddProjectMemberInput {
        project_id: project.id.into(),
        user_id: member.id.into(),
        role: "EDITOR".to_string(),
    };

    let result = mutation.add_project_member(&ctx, input).await;
    assert!(result.is_ok());

    let project_member = result.unwrap();
    assert_eq!(project_member.role, "EDITOR");
}

#[tokio::test]
async fn test_get_project() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let project = create_test_project(&db, user.id).await;
    let ctx = create_test_context(db);

    let query = ProjectQuery;
    let result = query.project(&ctx, project.id.into()).await;

    assert!(result.is_ok());
    let fetched_project = result.unwrap();
    assert!(fetched_project.is_some());
    let fetched_project = fetched_project.unwrap();
    assert_eq!(fetched_project.id, project.id.into());
    assert_eq!(fetched_project.name, project.name);
}

#[tokio::test]
async fn test_get_projects() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let mut ctx = create_test_context(db.clone());

    // Add authenticated user to context
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: 0,
    };
    ctx.insert(auth_user);

    // Create multiple projects
    let project1 = create_test_project(&db, user.id).await;
    let project2 = create_test_project(&db, user.id).await;

    let query = ProjectQuery;
    let result = query.projects(&ctx).await;

    assert!(result.is_ok());
    let projects = result.unwrap();
    assert_eq!(projects.len(), 2);
}

#[tokio::test]
async fn test_unauthorized_project_creation() {
    let db = setup_test_db().await;
    let user = create_test_user(&db).await;
    let mut ctx = create_test_context(db);

    // Add authenticated user to context with regular member role
    let auth_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: "MEMBER".to_string(), // Regular member can't create projects
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = ProjectMutation;
    let input = CreateProjectInput {
        name: "Test Project".to_string(),
        description: Some("Project Description".to_string()),
    };

    let result = mutation.create_project(&ctx, input).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_project_member_permissions() {
    let db = setup_test_db().await;
    let owner = create_test_user(&db).await;
    let unauthorized_user = create_test_user(&db).await;
    let project = create_test_project(&db, owner.id).await;
    let mut ctx = create_test_context(db);

    // Add unauthorized user to context
    let auth_user = AuthUser {
        id: unauthorized_user.id,
        email: unauthorized_user.email.clone(),
        role: "MEMBER".to_string(),
        exp: 0,
    };
    ctx.insert(auth_user);

    let mutation = ProjectMutation;
    let result = mutation
        .update_project(
            &ctx,
            project.id.into(),
            Some("Updated Project".to_string()),
            None,
        )
        .await;

    // Should fail because user is not a project member
    assert!(result.is_err());
}
