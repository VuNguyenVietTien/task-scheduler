use async_graphql::*;
use chrono::Utc;
use log::{debug, error, info};
use regex::Regex;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::collections::HashSet;
use uuid::Uuid;

use crate::firebase::FirebaseService;
use crate::graphql::resolvers::comments::CommentResponse;
use crate::graphql::resolvers::comments::CreateCommentInput;

// Function to extract mentions from comment content
fn extract_mentions(content: &str) -> Vec<(String, String)> {
    // Regex to match mentions in format: <span data-id="UUID" data-username="username" class="mention">@username</span>
    // This regex is updated to match the actual frontend format seen in the log
    // For example: <span data-id="0ae3e4cb-a035-47ef-b27a-203f62395a50" data-label="Zack Awesome" data-username="Zack Awesome" data-mention="" class="mention">@Zack Awesome</span>
    let re = Regex::new(r#"<span[^>]*?data-id="([^"]*)"[^>]*?data-username="([^"]*)"[^>]*?class="mention"[^>]*?>@([^<]*)</span>"#).unwrap();

    let mut mentions = Vec::new();

    for cap in re.captures_iter(content) {
        if let (Some(user_id), Some(username)) = (cap.get(1), cap.get(2)) {
            mentions.push((user_id.as_str().to_string(), username.as_str().to_string()));
        }
    }

    debug!("Found {} mentions in comment content", mentions.len());
    for (user_id, username) in &mentions {
        debug!("Mention: {} ({})", username, user_id);
    }

    mentions
}

// Refactor to use a single notification creation function
async fn create_notification(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    project_id: Uuid,
    comment_id: Uuid,
    sender_id: Uuid,
    notification_type: &str,
    action: &str,
    message: String,
) -> Result<Uuid, Error> {
    let notification_id = Uuid::new_v4();

    let metadata = json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "project_id": project_id.to_string(),
    });

    // Insert notification with taskid and commentid fields (lowercase)
    sqlx::query(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id, 
            message, is_read, created_at, project_id, sender_id, action, metadata

        )
        VALUES (
            $1, $2, $3, 'comment', $4, 
            $5, false, CURRENT_TIMESTAMP, $6, $7, $8,
            $9
        )
        "#,
    )
    .bind(notification_id)
    .bind(user_id)
    .bind(notification_type)
    .bind(comment_id)
    .bind(message)
    .bind(project_id)
    .bind(sender_id)
    .bind(action)
    .bind(metadata)
    .bind(task_id) // taskid field
    .bind(comment_id) // commentid field
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create notification: {:?}", e)))?;

    Ok(notification_id)
}

// Helper function to clean up invalid FCM tokens
async fn cleanup_invalid_tokens(
    pool: &PgPool,
    user_id: Uuid,
    invalid_tokens: &[String],
) -> Result<(), Error> {
    if invalid_tokens.is_empty() {
        return Ok(());
    }

    // Get current tokens
    let user_result = sqlx::query("SELECT fcm_tokens FROM users WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to fetch user tokens: {:?}", e)))?;

    let current_tokens: Option<serde_json::Value> = user_result
        .try_get("fcm_tokens")
        .map_err(|e| Error::new(format!("Failed to get fcm_tokens: {:?}", e)))?;

    // Filter out invalid tokens
    let valid_tokens: Vec<String> = match current_tokens {
        Some(value) if value.is_array() => value
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|t| t.as_str().map(|s| s.to_string()))
            .filter(|token| !invalid_tokens.contains(token))
            .collect(),
        _ => Vec::new(),
    };

    // Update user's tokens
    sqlx::query("UPDATE users SET fcm_tokens = $1 WHERE user_id = $2")
        .bind(serde_json::to_value(valid_tokens).unwrap())
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to update user tokens: {:?}", e)))?;

    Ok(())
}

// Helper function to send FCM notifications
async fn send_fcm_notification(
    firebase: &FirebaseService,
    tokens: Vec<String>,
    notification_payload: crate::firebase::FcmNotificationPayload,
    data_payload: crate::firebase::FcmDataPayload,
    user_id: Uuid,
    pool: &PgPool,
) -> Result<(), Error> {
    if tokens.is_empty() {
        return Ok(());
    }

    // Send notification to all tokens at once
    match firebase
        .send_notification_to_tokens(tokens.clone(), notification_payload, data_payload)
        .await
    {
        Ok(fcm_response) => {
            info!(
                "Successfully sent FCM notification to user {}: {:?}",
                user_id, fcm_response
            );

            // Check for invalid tokens in response
            let invalid_tokens: Vec<String> = fcm_response
                .tokens
                .iter()
                .filter(|(_, result)| {
                    if let Some(error) = result.get("error") {
                        error.as_str() == Some("UNREGISTERED")
                    } else {
                        false
                    }
                })
                .map(|(token, _)| token.clone())
                .collect();

            // Clean up invalid tokens if any
            if !invalid_tokens.is_empty() {
                info!(
                    "Cleaning up {} invalid tokens for user {}",
                    invalid_tokens.len(),
                    user_id
                );
                cleanup_invalid_tokens(pool, user_id, &invalid_tokens).await?;
            }
        }
        Err(e) => {
            error!(
                "Failed to send FCM notification to user {}: {:?}",
                user_id, e
            );
        }
    }

    Ok(())
}

pub async fn create_comment_with_mentions(
    pool: &PgPool,
    user_id: Uuid,
    input: CreateCommentInput,
    firebase_service: Option<&FirebaseService>,
) -> Result<CommentResponse, Error> {
    info!(
        "Creating comment for task {} with mention detection",
        input.task_id
    );
    debug!("Comment content: {}", input.content);
    debug!("Firebase service available: {}", firebase_service.is_some());

    let task_id = Uuid::parse_str(&input.task_id).map_err(|_| Error::new("Invalid task ID"))?;

    let parent_id = if let Some(pid) = &input.parent_id {
        Some(Uuid::parse_str(pid).map_err(|_| Error::new("Invalid parent comment ID"))?)
    } else {
        None
    };

    // Get task details for notifications
    let task_row =
        sqlx::query("SELECT title, project_id, assignee_id FROM tasks WHERE task_id = $1")
            .bind(task_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!("Failed to fetch task details: {:?}", e);
                Error::new(format!("Failed to fetch task: {:?}", e))
            })?;

    let task_title: String = task_row.try_get("title").map_err(|e| {
        error!("Failed to get task title: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;

    let project_id: Uuid = task_row.try_get("project_id").map_err(|e| {
        error!("Failed to get project_id: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;

    let assignee_id: Option<Uuid> = task_row.try_get("assignee_id").map_err(|e| {
        error!("Failed to get assignee_id: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;

    info!(
        "Fetched task details: {}, project_id: {}",
        task_title, project_id
    );

    let comment_id = Uuid::new_v4();
    let now = Utc::now();

    // Insert the comment in the database
    let record = sqlx::query(
        "WITH inserted_comment AS (
            INSERT INTO comments (
                comment_id, content, user_id, task_id, parent_id,
                metadata, is_deleted, created_at, updated_at
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, false, $7, $7)
            RETURNING *
        )
        SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, 
               c.metadata, c.is_deleted, c.created_at, c.updated_at, u.username as name, u.full_name, u.avatar_url
        FROM inserted_comment c
        JOIN users u ON c.user_id = u.user_id",
    )
    .bind(comment_id)
    .bind(&input.content)
    .bind(user_id)
    .bind(task_id)
    .bind(parent_id)
    .bind(input.metadata)
    .bind(now)
    .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("Database error while creating comment: {:?}", e);
        Error::new(format!("Database error: {:?}", e))
    })?
    .map_err(|e| {
        error!("Row mapping error: {:?}", e);
        Error::new(format!("Row mapping error: {:?}", e))
    })?;

    info!("Comment created with ID: {}", comment_id);

    // Process mentions and create notifications
    let mentions = extract_mentions(&input.content);
    info!("Found {} mentions in comment", mentions.len());

    // Keep track of which users we've already sent notifications to
    let mut notified_users = HashSet::new();

    // Get commenter username for notifications
    let commenter_row = sqlx::query("SELECT username FROM users WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to fetch user: {:?}", e)))?;

    let commenter_name: String = commenter_row
        .try_get("username")
        .map_err(|e| Error::new(format!("Failed to get username: {:?}", e)))?;

    // First, process all mentions (these take priority)
    for (mentioned_user_id, username) in mentions {
        match Uuid::parse_str(&mentioned_user_id) {
            Ok(mentioned_uuid) => {
                // Skip if the mentioned user is the comment author
                if mentioned_uuid != user_id {
                    debug!("Processing mention notification for user: {}", username);

                    // Create mention notification message
                    let message = format!(
                        "{} mentioned you in a comment on task: {}",
                        commenter_name, task_title
                    );

                    match create_notification(
                        pool,
                        mentioned_uuid,
                        task_id,
                        project_id,
                        comment_id,
                        user_id,
                        "COMMENT_MENTION",
                        "mention",
                        message,
                    )
                    .await
                    {
                        Ok(notification_id) => {
                            info!("Created mention notification for user {}", username);
                            notified_users.insert(mentioned_uuid);

                            // Send FCM notification if Firebase service is available
                            if let Some(firebase) = firebase_service {
                                // Get FCM tokens for the mentioned user
                                let user_result =
                                    sqlx::query("SELECT fcm_tokens FROM users WHERE user_id = $1")
                                        .bind(mentioned_uuid)
                                        .fetch_one(pool)
                                        .await;

                                if let Ok(user_row) = user_result {
                                    // Process FCM tokens from JSONB
                                    let fcm_tokens_value: Option<serde_json::Value> =
                                        user_row.try_get("fcm_tokens").ok();
                                    debug!(
                                        "FCM tokens for user {}: {:?}",
                                        mentioned_uuid, fcm_tokens_value
                                    );

                                    let tokens = match fcm_tokens_value {
                                        Some(value) if value.is_array() => value
                                            .as_array()
                                            .unwrap()
                                            .iter()
                                            .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                            .collect::<Vec<String>>(),
                                        _ => Vec::new(),
                                    };

                                    if !tokens.is_empty() {
                                        info!(
                                            "Found {} FCM tokens for user {}",
                                            tokens.len(),
                                            mentioned_uuid
                                        );

                                        let notification_title =
                                            format!("You were mentioned in a comment");
                                        let notification_body = format!(
                                            "{} mentioned you in a comment on task '{}'",
                                            commenter_name, task_title
                                        );

                                        let notification_payload =
                                            crate::firebase::FcmNotificationPayload {
                                                title: notification_title,
                                                body: notification_body,
                                            };

                                        let data_payload = crate::firebase::FcmDataPayload {
                                            notification_id: notification_id.to_string(),
                                            notification_type: "COMMENT_MENTION".to_string(),
                                            project_id: Some(project_id.to_string()),
                                            task_id: Some(task_id.to_string()),
                                            comment_id: Some(comment_id.to_string()),
                                            user_id: mentioned_uuid.to_string(),
                                            sender_id: Some(user_id.to_string()),
                                            extra: std::collections::HashMap::new(),
                                        };

                                        // Send FCM notification
                                        send_fcm_notification(
                                            firebase,
                                            tokens,
                                            notification_payload,
                                            data_payload,
                                            mentioned_uuid,
                                            pool,
                                        )
                                        .await?;
                                    } else {
                                        debug!(
                                            "No FCM tokens found for mentioned user: {}",
                                            mentioned_uuid
                                        );
                                    }
                                }
                            }
                        }
                        Err(e) => error!("Failed to create mention notification: {:?}", e),
                    }
                } else {
                    debug!("Skipping self-mention for user: {}", username);
                }
            }
            Err(e) => error!(
                "Invalid UUID in mention: {}, error: {:?}",
                mentioned_user_id, e
            ),
        }
    }

    // Now, only notify the task assignee if they haven't already been notified via a mention
    if let Some(assignee_id) = assignee_id {
        if assignee_id != user_id && !notified_users.contains(&assignee_id) {
            debug!("Notifying task assignee: {}", assignee_id);

            // Create task comment notification message
            let message = format!("{} commented on task: {}", commenter_name, task_title);

            match create_notification(
                pool,
                assignee_id,
                task_id,
                project_id,
                comment_id,
                user_id,
                "TASK_COMMENT",
                "comment",
                message,
            )
            .await
            {
                Ok(notification_id) => {
                    info!("Created task comment notification for assignee");

                    // Send FCM notification if Firebase service is available
                    if let Some(firebase) = firebase_service {
                        // Get FCM tokens for the assignee
                        let user_query = sqlx::query!(
                            "SELECT fcm_tokens FROM users WHERE user_id = $1",
                            assignee_id
                        )
                        .fetch_one(pool)
                        .await;

                        if let Ok(user) = user_query {
                            // Process FCM tokens from JSONB
                            let tokens = match user.fcm_tokens {
                                Some(value) if value.is_array() => value
                                    .as_array()
                                    .unwrap()
                                    .iter()
                                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                    .collect::<Vec<String>>(),
                                _ => Vec::new(),
                            };

                            if !tokens.is_empty() {
                                info!(
                                    "Found {} FCM tokens for assignee {}",
                                    tokens.len(),
                                    assignee_id
                                );

                                let notification_title = format!("New comment on your task");
                                let notification_body = format!(
                                    "{} commented on task '{}'",
                                    commenter_name, task_title
                                );

                                let notification_payload =
                                    crate::firebase::FcmNotificationPayload {
                                        title: notification_title,
                                        body: notification_body,
                                    };

                                let data_payload = crate::firebase::FcmDataPayload {
                                    notification_id: notification_id.to_string(),
                                    notification_type: "TASK_COMMENT".to_string(),
                                    project_id: Some(project_id.to_string()),
                                    task_id: Some(task_id.to_string()),
                                    comment_id: Some(comment_id.to_string()),
                                    user_id: assignee_id.to_string(),
                                    sender_id: Some(user_id.to_string()),
                                    extra: std::collections::HashMap::new(),
                                };

                                // Send FCM notification
                                send_fcm_notification(
                                    firebase,
                                    tokens,
                                    notification_payload,
                                    data_payload,
                                    assignee_id,
                                    pool,
                                )
                                .await?;
                            } else {
                                debug!("No FCM tokens found for task assignee: {}", assignee_id);
                            }
                        }
                    }
                }
                Err(e) => error!("Failed to create task comment notification: {:?}", e),
            }
        }
    }

    Ok(record)
}
