use async_graphql::*;
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, QueryOrder};
use uuid::Uuid;
use std::sync::Arc;
use crate::{
    db::entities::{notification, user},
    error::AppError,
    graphql::types::*,
    websocket::{NotificationBroadcaster, WebSocketMessage},
};

pub struct NotificationQuery;

#[Object]
impl NotificationQuery {
    async fn notifications(
        &self,
        ctx: &Context<'_>,
        #[arg(default = false)] include_read: bool,
    ) -> Result<Vec<Notification>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        // Build query conditions
        let mut condition = notification::Column::UserId.eq(auth_user.id);
        
        if !include_read {
            condition = condition.and(notification::Column::ReadAt.is_null());
        }

        let notifications = notification::Entity::find()
            .filter(condition)
            .order_by_desc(notification::Column::CreatedAt)
            .all(db)
            .await?;

        Ok(notifications.into_iter().map(Into::into).collect())
    }

    async fn unread_notification_count(&self, ctx: &Context<'_>) -> Result<i32> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let count = notification::Entity::find()
            .filter(
                notification::Column::UserId.eq(auth_user.id)
                    .and(notification::Column::ReadAt.is_null())
            )
            .count(db)
            .await?;

        Ok(count as i32)
    }
}

pub struct NotificationMutation;

#[Object]
impl NotificationMutation {
    async fn mark_notification_as_read(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<Notification> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let notification_id = Uuid::parse_str(id.as_str())?;

        // Fetch notification
        let notification = notification::Entity::find_by_id(notification_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Notification not found"))?;

        // Verify ownership
        if notification.user_id != auth_user.id {
            return Err(Error::new("Not authorized to modify this notification"));
        }

        // Update notification
        let mut notification: notification::ActiveModel = notification.into();
        notification.read_at = Set(Some(chrono::Utc::now().into()));

        let updated = notification.update(db).await?;

        Ok(updated.into())
    }

    async fn mark_all_notifications_as_read(
        &self,
        ctx: &Context<'_>,
    ) -> Result<bool> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        // Update all unread notifications for user
        let now = chrono::Utc::now();
        let result = notification::Entity::update_many()
            .filter(
                notification::Column::UserId.eq(auth_user.id)
                    .and(notification::Column::ReadAt.is_null())
            )
            .set(notification::ActiveModel {
                read_at: Set(Some(now.into())),
                ..Default::default()
            })
            .exec(db)
            .await?;

        Ok(result.rows_affected > 0)
    }

    async fn delete_notification(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<ID> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let notification_id = Uuid::parse_str(id.as_str())?;

        // Verify ownership
        let notification = notification::Entity::find_by_id(notification_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Notification not found"))?;

        if notification.user_id != auth_user.id {
            return Err(Error::new("Not authorized to delete this notification"));
        }

        // Delete notification
        notification::Entity::delete_by_id(notification_id)
            .exec(db)
            .await?;

        Ok(id)
    }
}

// Helper functions for creating notifications
pub async fn create_notification(
    db: &sea_orm::DatabaseConnection,
    broadcaster: &NotificationBroadcaster,
    user_id: Uuid,
    notification_type: &str,
    content: serde_json::Value,
) -> Result<notification::Model, AppError> {
    // Create notification record
    let notification = notification::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        type_: Set(notification_type.to_string()),
        content: Set(content.clone()),
        created_at: Set(chrono::Utc::now().into()),
        read_at: Set(None),
    };

    let notification = notification.insert(db).await?;

    // Send real-time notification via WebSocket
    broadcaster.send(WebSocketMessage::NotificationCreated {
        user_id,
        notification: serde_json::json!({
            "id": notification.id,
            "type": notification_type,
            "content": content
        }),
    });

    Ok(notification)
}

// Implement conversion from database model to GraphQL type
impl From<notification::Model> for Notification {
    fn from(model: notification::Model) -> Self {
        Notification {
            id: model.id.into(),
            user_id: model.user_id.into(),
            type_: model.type_,
            content: model.content,
            created_at: model.created_at.into(),
            read_at: model.read_at.map(Into::into),
        }
    }
}
