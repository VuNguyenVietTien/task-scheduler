use std::sync::Arc;
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use actix_web_actors::ws;
use actix::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WebSocketMessage {
    TaskUpdated {
        task_id: Uuid,
        changes: serde_json::Value,
    },
    CommentAdded {
        task_id: Uuid,
        comment: serde_json::Value,
    },
    NotificationCreated {
        user_id: Uuid,
        notification: serde_json::Value,
    },
}

pub struct WebSocketConnection {
    user_id: Uuid,
    tx: broadcast::Sender<WebSocketMessage>,
    rx: broadcast::Receiver<WebSocketMessage>,
}

impl Actor for WebSocketConnection {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to the broadcast channel
        let mut rx = self.rx.resubscribe();
        let addr = ctx.address();

        // Handle incoming messages from broadcast channel
        ctx.spawn(async move {
            while let Ok(msg) = rx.recv().await {
                addr.do_send(msg);
            }
        }.into_actor(self));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketConnection {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

impl Handler<WebSocketMessage> for WebSocketConnection {
    type Result = ();

    fn handle(&mut self, msg: WebSocketMessage, ctx: &mut Self::Context) {
        // Filter messages based on user_id for notifications
        if let WebSocketMessage::NotificationCreated { user_id, .. } = &msg {
            if *user_id != self.user_id {
                return;
            }
        }

        // Send message to client
        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
        }
    }
}

pub struct NotificationBroadcaster {
    tx: broadcast::Sender<WebSocketMessage>,
}

impl NotificationBroadcaster {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WebSocketMessage> {
        self.tx.subscribe()
    }

    pub fn send(&self, message: WebSocketMessage) {
        let _ = self.tx.send(message);
    }
}

// WebSocket connection handler
pub async fn ws_handler(
    req: actix_web::HttpRequest,
    stream: web::Payload,
    broadcaster: web::Data<Arc<NotificationBroadcaster>>,
    config: web::Data<crate::config::Config>,
) -> Result<actix_web::HttpResponse, actix_web::Error> {
    // Extract and validate token from query params
    let query_params = web::Query::<std::collections::HashMap<String, String>>::from_query(req.query_string())?;
    let token = query_params.get("token").ok_or_else(|| {
        actix_web::error::ErrorUnauthorized("Missing token")
    })?;

    // Verify token and get user_id
    let auth_user = crate::auth::Auth::verify_token(token, &config)
        .map_err(|_| actix_web::error::ErrorUnauthorized("Invalid token"))?;

    let user_id = auth_user.id;
    let rx = broadcaster.subscribe();
    let tx = broadcaster.tx.clone();

    let ws = WebSocketConnection {
        user_id,
        tx,
        rx,
    };

    ws::start(ws, &req, stream)
}
