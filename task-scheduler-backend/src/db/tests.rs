use super::*;
use dotenv::dotenv;
use std::env;
use uuid::Uuid;
use chrono::Utc;

async fn setup_test_db() -> Database {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    Database::new(&database_url).await.expect("Failed to create database connection")
}

#[tokio::test]
async fn test_user_crud_operations() {
    let db = setup_test_db().await;
    
    // Create test user
    let test_user = User {
        user_id: Uuid::new_v4(),
        email: format!("test_{}@example.com", Uuid::new_v4()),
        password_hash: "hashed_password".to_string(),
        full_name: "Test User".to_string(),
        username: Some("testuser".to_string()),
        avatar_url: None,
        bio: None,
        google_id: None,
        is_email_verified: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_login_at: None,
    };

    // Test create user
    let created_user = queries::create_user(db.pool(), test_user.clone())
        .await
        .expect("Failed to create user");
    assert_eq!(created_user.email, test_user.email);
    assert_eq!(created_user.full_name, test_user.full_name);

    // Test get user by id
    let found_user = queries::get_user_by_id(db.pool(), created_user.user_id)
        .await
        .expect("Failed to get user")
        .expect("User not found");
    assert_eq!(found_user.user_id, created_user.user_id);

    // Test get user by email
    let found_by_email = queries::get_user_by_email(db.pool(), &created_user.email)
        .await
        .expect("Failed to get user by email")
        .expect("User not found by email");
    assert_eq!(found_by_email.user_id, created_user.user_id);
}

#[tokio::test]
async fn test_project_operations() {
    let db = setup_test_db().await;

    // First create a test user
    let owner = User {
        user_id: Uuid::new_v4(),
        email: format!("project_owner_{}@example.com", Uuid::new_v4()),
        password_hash: "hashed_password".to_string(),
        full_name: "Project Owner".to_string(),
        username: None,
        avatar_url: None,
        bio: None,
        google_id: None,
        is_email_verified: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_login_at: None,
    };
    let owner = queries::create_user(db.pool(), owner)
        .await
        .expect("Failed to create owner");

    // Create test project
    let test_project = Project {
        project_id: Uuid::new_v4(),
        name: "Test Project".to_string(),
        description: Some("Test Description".to_string()),
        owner_id: owner.user_id,
        start_date: None,
        end_date: None,
        status: "active".to_string(),
        icon_url: None,
        is_public: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Test create project
    let created_project = queries::create_project(db.pool(), test_project.clone())
        .await
        .expect("Failed to create project");
    assert_eq!(created_project.name, test_project.name);
    assert_eq!(created_project.owner_id, test_project.owner_id);

    // Test get project by id
    let found_project = queries::get_project_by_id(db.pool(), created_project.project_id)
        .await
        .expect("Failed to get project")
        .expect("Project not found");
    assert_eq!(found_project.project_id, created_project.project_id);

    // Test list user projects
    let projects = queries::list_user_projects(
        db.pool(),
        owner.user_id,
        &PaginationParams::default()
    )
    .await
    .expect("Failed to list projects");
    
    assert!(!projects.is_empty());
    assert_eq!(projects[0].project_id, created_project.project_id);
}

#[tokio::test]
async fn test_comment_operations() {
    let db = setup_test_db().await;

    // Create test user
    let user = User {
        user_id: Uuid::new_v4(),
        email: format!("comment_user_{}@example.com", Uuid::new_v4()),
        password_hash: "hashed_password".to_string(),
        full_name: "Comment User".to_string(),
        username: None,
        avatar_url: None,
        bio: None,
        google_id: None,
        is_email_verified: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_login_at: None,
    };
    let user = queries::create_user(db.pool(), user)
        .await
        .expect("Failed to create user");

    // Create test project
    let project = Project {
        project_id: Uuid::new_v4(),
        name: "Comment Test Project".to_string(),
        description: None,
        owner_id: user.user_id,
        start_date: None,
        end_date: None,
        status: "active".to_string(),
        icon_url: None,
        is_public: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    let project = queries::create_project(db.pool(), project)
        .await
        .expect("Failed to create project");

    // Create test comment
    let test_comment = Comment {
        comment_id: Uuid::new_v4(),
        task_id: project.project_id, // Using project_id as task_id for testing
        user_id: user.user_id,
        content: "Test comment content".to_string(),
        parent_comment_id: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    };

    // Test create comment
    let created_comment = queries::create_comment(db.pool(), test_comment.clone())
        .await
        .expect("Failed to create comment");
    assert_eq!(created_comment.content, test_comment.content);
    assert_eq!(created_comment.user_id, test_comment.user_id);

    // Test get comment by id
    let found_comment = queries::get_comment_by_id(db.pool(), created_comment.comment_id)
        .await
        .expect("Failed to get comment")
        .expect("Comment not found");
    assert_eq!(found_comment.comment_id, created_comment.comment_id);

    // Test list task comments
    let comments = queries::list_task_comments(
        db.pool(),
        test_comment.task_id,
        &PaginationParams::default()
    )
    .await
    .expect("Failed to list comments");
    
    assert!(!comments.is_empty());
    assert_eq!(comments[0].comment_id, created_comment.comment_id);
}