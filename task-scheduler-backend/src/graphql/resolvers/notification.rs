use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, EntityTrait, IntoActiveModel, Set,
};
use uuid::Uuid;
use serde_json::Value as JsonValue;

use crate::{
    db::entities::{
        NotificationEntity, NotificationModel,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        types::Notification,
    },
};

#[derive(Default)]
pub struct NotificationQuery;

#[Object]
impl NotificationQuery {
    async fn notification(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Notification>, Error> {
        let db = ctx.get_db();
        let notification = NotificationEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(notification.map(|n| n.into()))
    }

    async fn notifications(&self, ctx: &Context<'_>) -> Result<Vec<Notification>, Error> {
        let db = ctx.get_db();
        let notifications = NotificationEntity::find()
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
    async fn mark_notification_as_read(&self, ctx: &Context<'_>, id: ID) -> Result<Notification, Error> {
        let db = ctx.get_db();
        let now = chrono::Utc::now().fixed_offset();

        // Find notification
        let notification_id = Uuid::parse_str(&id.to_string())?;
        let mut notification = NotificationEntity::find_by_id(notification_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Notification not found"))?
            .into_active_model();

        // Update read_at timestamp 
        notification.read_at = Set(Some(now));

        let notification = notification.update(db).await.map_err(map_db_err)?;

        Ok(notification.into())
    }
}

impl From<NotificationModel> for Notification {
    fn from(model: NotificationModel) -> Self {
        Notification {
            id: model.id.into(),
            user_id: model.user_id.into(),
            type_: model.type_,
            content: Json(model.content),
            created_at: model.created_at,
            read_at: model.read_at,
        }
    }
}
