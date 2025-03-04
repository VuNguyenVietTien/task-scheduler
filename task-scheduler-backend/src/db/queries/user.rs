use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;

use crate::db::models::user::User;

pub struct UserFilters {
    pub role: Option<String>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

pub async fn get_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT * FROM users 
        WHERE user_id = $1 AND NOT is_deleted
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
}

pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT * FROM users 
        WHERE email = $1 AND NOT is_deleted
        "#,
        email
    )
    .fetch_optional(pool)
    .await
}

pub async fn list_users(pool: &PgPool, filters: &UserFilters) -> Result<Vec<User>, sqlx::Error> {
    let mut query = sqlx::QueryBuilder::new(
        "SELECT u.* FROM users u LEFT JOIN user_roles ur ON u.user_id = ur.user_id WHERE NOT u.is_deleted"
    );

    // Apply filters
    if let Some(role) = &filters.role {
        query.push(" AND ur.role = ");
        query.push_bind(role);
    }

    if let Some(search) = &filters.search {
        query.push(" AND (u.full_name ILIKE ");
        query.push_bind(format!("%{}%", search));
        query.push(" OR u.email ILIKE ");
        query.push_bind(format!("%{}%", search));
        query.push(")");
    }

    // Add pagination
    if let (Some(page), Some(per_page)) = (filters.page, filters.per_page) {
        let offset = (page - 1) * per_page;
        query.push(" LIMIT ");
        query.push_bind(per_page);
        query.push(" OFFSET ");
        query.push_bind(offset);
    }

    query.build_query_as::<User>()
        .fetch_all(pool)
        .await
}

pub async fn create_user(pool: &PgPool, user: User) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (
            user_id, email, full_name, username, password_hash,
            avatar_url, bio, work_capacity,
            created_at, updated_at, is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#,
        user.user_id,
        user.email,
        user.full_name,
        user.username,
        user.password_hash,
        user.avatar_url,
        user.bio,
        user.work_capacity,
        user.created_at,
        user.updated_at,
        user.is_deleted
    )
    .fetch_one(pool)
    .await
}

pub async fn update_user(pool: &PgPool, user: User) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        UPDATE users SET
            email = $1,
            full_name = $2,
            username = $3,
            password_hash = $4,
            avatar_url = $5,
            bio = $6,
            work_capacity = $7,
            updated_at = $8
        WHERE user_id = $9 AND NOT is_deleted
        RETURNING *
        "#,
        user.email,
        user.full_name,
        user.username,
        user.password_hash,
        user.avatar_url,
        user.bio,
        user.work_capacity,
        Utc::now(),
        user.user_id
    )
    .fetch_one(pool)
    .await
}

pub async fn delete_user(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE users
        SET is_deleted = true, updated_at = $1
        WHERE user_id = $2
        "#,
        Utc::now(),
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
