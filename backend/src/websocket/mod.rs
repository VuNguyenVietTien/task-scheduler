use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use serde::{Deserialize, Serialize};
use actix::prelude::*;
use actix_web_actors::ws;
use uuid::Uuid;

mod message;
mod connect;
pub use message::*;
pub use connect::*;

#[derive(Clone)]
pub struct NotificationBroadcaster {
    sender: broadcast::Sender<NotificationMessage>,
}

impl NotificationBroadcaster {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NotificationMessage> {
        self.sender.subscribe()
    }

    pub fn send(&self, msg: NotificationMessage) -> Result<usize, broadcast::error::SendError<NotificationMessage>> {
        self.sender.send(msg)
    }
}

pub struct WebSocketState {
    pub broadcaster: Arc<NotificationBroadcaster>,
    pub connections: Arc<RwLock<Vec<Uuid>>>,
}

impl WebSocketState {
    pub fn new(broadcaster: NotificationBroadcaster) -> Self {
        Self {
            broadcaster: Arc::new(broadcaster),
            connections: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn add_connection(&self, user_id: Uuid) {
        let mut connections = self.connections.write().await;
        if !connections.contains(&user_id) {
            connections.push(user_id);
        }
    }

    pub async fn remove_connection(&self, user_id: Uuid) {
        let mut connections = self.connections.write().await;
        if let Some(idx) = connections.iter().position(|&id| id == user_id) {
            connections.remove(idx);
        }
    }

    pub async fn is_connected(&self, user_id: Uuid) -> bool {
        let connections = self.connections.read().await;
        connections.contains(&user_id)
    }

    pub async fn get_connected_users(&self) -> Vec<Uuid> {
        let connections = self.connections.read().await;
        connections.clone()
    }

    pub fn broadcast(&self, msg: NotificationMessage) -> Result<usize, broadcast::error::SendError<NotificationMessage>> {
        self.broadcaster.send(msg)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMessage {
    pub id: Uuid,
    pub user_id: Uuid,
    pub type_: String,
    pub content: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
}

impl Actor for WebSocketState {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, _ctx: &mut Self::Context) {}

    fn stopped(&mut self, _ctx: &mut Self::Context) {}
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketState {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => ctx.text(text),
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}