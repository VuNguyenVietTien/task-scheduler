use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
    IntoActiveModel, Set,
};
use uuid::Uuid;

use crate::{
    db::entities::{
        NotificationEntity, NotificationModel, NotificationActiveModel,
        notification::Column as NotificationColumn,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::Notification,
    },
};

#[derive(Default)]
pub struct NotificationQuery;

#[Object]
impl NotificationQuery {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn notifications(
        &self,
        ctx: &Context<'_>,
        include_read: bool,
    ) -> Result<Vec<Notification>, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        let mut query = NotificationEntity::find()
            .filter(NotificationColumn::UserId.eq(auth_user.id));

        if !include_read {
            query = query.filter(NotificationColumn::ReadAt.is_null());
        }

        let notifications = query
            .order_by(NotificationColumn::CreatedAt, sea_orm::Order::Desc)
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(notifications.into_iter().map(|n| n.into()).collect())
    }
}

#[derive(Default)]
pub struct NotificationMutation;

#[Object]
impl NotificationMutation {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn create_notification(
        &self,
        ctx: &Context<'_>,
        user_id: ID, 
        type_: String,
        content: Json<serde_json::Value>,
    ) -> Result<Notification, Error> {
        let db = ctx.get_db();
        let user_uuid = Uuid::parse_str(&user_id.to_string())?;

        let notification = NotificationActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_uuid),
            type_: Set(type_),
            content: Set(content.0),
            created_at: Set(current_time_db()),
            read_at: Set(None),
        };

        let notification = notification.insert(db).await.map_err(map_db_err)?;

        Ok(notification.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn mark_notification_read(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<Notification, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;
        let notification_id = Uuid::parse_str(&id.to_string())?;

        let notification = NotificationEntity::find_by_id(notification_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Notification not found"))?;

        // Check permissions
        if notification.user_id != auth_user.id {
            return Err("Not authorized to mark this notification as read".into());
        }

        let mut notification = notification.into_active_model();
        notification.read_at = Set(Some(current_time_db()));

        let notification = notification.update(db).await.map_err(map_db_err)?;

        Ok(notification.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn mark_all_notifications_read(
        &self,
        ctx: &Context<'_>,
    ) -> Result<Vec<Notification>, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        let notifications = NotificationEntity::find()
            .filter(NotificationColumn::UserId.eq(auth_user.id))
            .filter(NotificationColumn::ReadAt.is_null())
            .all(db)
            .await
            .map_err(map_db_err)?;

        let mut updated = Vec::new();
        for notification in notifications {
            let mut notification = notification.into_active_model();
            notification.read_at = Set(Some(current_time_db()));
            
            let notification = notification.update(db).await.map_err(map_db_err)?;
            updated.push(notification);
        }

        Ok(updated.into_iter().map(|n| n.into()).collect())
    }
}

impl From<NotificationModel> for Notification {
    fn from(model: NotificationModel) -> Self {
        Notification {
            id: model.id.into(),
            user_id: model.user_id.into(),
            type_: model.type_,
            content: model.content,
            created_at: model.created_at,
            read_at: model.read_at,
        }
    }
}
