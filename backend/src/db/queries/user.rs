use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json;

use crate::db::models::User;

pub struct UserFilters {
    pub role: Option<String>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

pub async fn get_user_by_id(pool: &PgPool, user_id: i32) -> Result<Option<User>, sqlx::Error> {
    sqlx::query(
        "SELECT * FROM users WHERE user_id = $1"
    )
    .bind(&user_id)
    .map(|row: sqlx::postgres::PgRow| {
        Ok(User {
            id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            avatar_url: row.try_get("avatar_url")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            firebase_uid: row.try_get("firebase_uid")?,
            fcm_tokens: row.try_get("fcm_tokens")?,
        })
    })
    .fetch_optional(pool)
    .await?
    .transpose()
}

pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(email)
    .map(|row: sqlx::postgres::PgRow| {
        Ok(User {
            id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            avatar_url: row.try_get("avatar_url")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            firebase_uid: row.try_get("firebase_uid")?,
            fcm_tokens: row.try_get("fcm_tokens")?,
        })
    })
    .fetch_optional(pool)
    .await?
    .transpose()
}

pub async fn list_users(pool: &PgPool, filters: &UserFilters) -> Result<Vec<User>, sqlx::Error> {
    let mut query = sqlx::QueryBuilder::new(
        "SELECT u.* FROM users u"
    );

    // Apply filters
    let mut _has_where = false;

    if let Some(search) = &filters.search {
        query.push(" WHERE (u.name ILIKE ");
        query.push_bind(format!("%{}%", search));
        query.push(" OR u.email ILIKE ");
        query.push_bind(format!("%{}%", search));
        query.push(")");
        _has_where = true;
    }

    // Add pagination
    if let (Some(page), Some(per_page)) = (filters.page, filters.per_page) {
        let offset = (page - 1) * per_page;
        query.push(" LIMIT ");
        query.push_bind(per_page);
        query.push(" OFFSET ");
        query.push_bind(offset);
    }

    let sql = query.build();
    
    let rows = sql.fetch_all(pool).await?;
    
    let mut users = Vec::with_capacity(rows.len());
    for row in rows {
        users.push(User {
            id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            avatar_url: row.try_get("avatar_url")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            firebase_uid: row.try_get("firebase_uid")?,
            fcm_tokens: row.try_get("fcm_tokens")?,
        });
    }
    
    Ok(users)
}

pub async fn create_user(pool: &PgPool, user: User) -> Result<User, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO users (
            name, email, avatar_url, created_at, updated_at, firebase_uid, fcm_tokens
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *"
    )
    .bind(&user.name)
    .bind(&user.email)
    .bind(&user.avatar_url)
    .bind(&user.created_at)
    .bind(&user.updated_at)
    .bind(&user.firebase_uid)
    .bind(&user.fcm_tokens)
    .map(|row: sqlx::postgres::PgRow| -> Result<User, sqlx::Error> {
        Ok(User {
            id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            avatar_url: row.try_get("avatar_url")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            firebase_uid: row.try_get("firebase_uid")?,
            fcm_tokens: row.try_get("fcm_tokens")?,
        })
    })
    .fetch_one(pool)
    .await??;

    Ok(result)
}

pub async fn update_user(pool: &PgPool, user: User) -> Result<User, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE users SET
            name = $1,
            email = $2,
            avatar_url = $3,
            updated_at = $4,
            firebase_uid = $5,
            fcm_tokens = $6
        WHERE user_id = $7
        RETURNING *"
    )
    .bind(&user.name)
    .bind(&user.email)
    .bind(&user.avatar_url)
    .bind(Utc::now())
    .bind(&user.firebase_uid)
    .bind(&user.fcm_tokens)
    .bind(&user.id)
    .map(|row: sqlx::postgres::PgRow| -> Result<User, sqlx::Error> {
        Ok(User {
            id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            avatar_url: row.try_get("avatar_url")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            firebase_uid: row.try_get("firebase_uid")?,
            fcm_tokens: row.try_get("fcm_tokens")?,
        })
    })
    .fetch_one(pool)
    .await??;

    Ok(result)
}

/// Add a new FCM token for a user
pub async fn add_fcm_token(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    token: &str,
    _device_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    // Get current tokens as JSON
    let current_tokens_json: Option<serde_json::Value> = sqlx::query(
        "SELECT fcm_tokens FROM users WHERE user_id = $1"
    )
    .bind(&user_id)
    .map(|row: sqlx::postgres::PgRow| row.try_get("fcm_tokens"))
    .fetch_optional(pool)
    .await?
    .transpose()?;
    
    // Parse tokens or create new array
    let tokens_array = match current_tokens_json {
        Some(json) => {
            if json.is_array() {
                let mut arr = json.as_array().unwrap().clone();
                // Check if token already exists
                if !arr.iter().any(|t| t.is_string() && t.as_str().unwrap() == token) {
                    arr.push(serde_json::Value::String(token.to_string()));
                }
                arr
            } else {
                vec![serde_json::Value::String(token.to_string())]
            }
        },
        None => vec![serde_json::Value::String(token.to_string())]
    };
    
    let tokens_json = serde_json::Value::Array(tokens_array);
    
    // Update user's FCM tokens
    sqlx::query(
        "UPDATE users SET fcm_tokens = $1 WHERE user_id = $2"
    )
    .bind(&tokens_json)
    .bind(&user_id)
    .execute(pool)
    .await?;
    
    Ok(())
}

/// Remove an FCM token from a user
pub async fn remove_fcm_token(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    token: &str,
) -> Result<(), sqlx::Error> {
    // Get current tokens as JSON
    let current_tokens_json: Option<serde_json::Value> = sqlx::query(
        "SELECT fcm_tokens FROM users WHERE user_id = $1"
    )
    .bind(&user_id)
    .map(|row: sqlx::postgres::PgRow| row.try_get("fcm_tokens"))
    .fetch_optional(pool)
    .await?
    .transpose()?;
    
    // Remove token if it exists
    if let Some(json) = current_tokens_json {
        if json.is_array() {
            let arr = json.as_array().unwrap();
            let filtered: Vec<serde_json::Value> = arr.iter()
                .filter(|&t| !(t.is_string() && t.as_str().unwrap() == token))
                .cloned()
                .collect();
            
            let tokens_json = serde_json::Value::Array(filtered);
            
            // Update user's FCM tokens
            sqlx::query(
                "UPDATE users SET fcm_tokens = $1 WHERE user_id = $2"
            )
            .bind(&tokens_json)
            .bind(&user_id)
            .execute(pool)
            .await?;
        }
    }
    
    Ok(())
}

/// Get all FCM tokens for a user
pub async fn get_fcm_tokens(
    pool: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    let tokens_json: Option<serde_json::Value> = sqlx::query(
        "SELECT fcm_tokens FROM users WHERE user_id = $1"
    )
    .bind(&user_id)
    .map(|row: sqlx::postgres::PgRow| row.try_get("fcm_tokens"))
    .fetch_optional(pool)
    .await?
    .transpose()?;
    
    // Convert JSON array to Vec<String>
    let tokens = match tokens_json {
        Some(json) if json.is_array() => {
            json.as_array()
                .unwrap()
                .iter()
                .filter_map(|v| {
                    if v.is_string() {
                        Some(v.as_str().unwrap().to_string())
                    } else {
                        None
                    }
                })
                .collect()
        },
        _ => Vec::new()
    };
    
    Ok(tokens)
}

/// Get all FCM tokens for a user by their Firebase UID
pub async fn get_fcm_tokens_by_firebase_uid(
    pool: &sqlx::PgPool,
    firebase_uid: &str,
) -> Result<Vec<String>, sqlx::Error> {
    let tokens_json: Option<serde_json::Value> = sqlx::query(
        "SELECT fcm_tokens FROM users WHERE firebase_uid = $1"
    )
    .bind(firebase_uid)
    .map(|row: sqlx::postgres::PgRow| row.try_get("fcm_tokens"))
    .fetch_optional(pool)
    .await?
    .transpose()?;
    
    // Convert JSON array to Vec<String>
    let tokens = match tokens_json {
        Some(json) if json.is_array() => {
            json.as_array()
                .unwrap()
                .iter()
                .filter_map(|v| {
                    if v.is_string() {
                        Some(v.as_str().unwrap().to_string())
                    } else {
                        None
                    }
                })
                .collect()
        },
        _ => Vec::new()
    };
    
    Ok(tokens)
}
