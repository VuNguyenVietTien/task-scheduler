use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WebSocketMessage {
    Connect {
        user_id: Uuid,
    },
    Disconnect {
        user_id: Uuid,
    },
    Notification {
        #[serde(flatten)]
        notification: super::NotificationMessage,
    },
    Error {
        code: String,
        message: String,
    },
}

impl WebSocketMessage {
    pub fn connect(user_id: Uuid) -> Self {
        WebSocketMessage::Connect { user_id }
    }

    pub fn disconnect(user_id: Uuid) -> Self {
        WebSocketMessage::Disconnect { user_id }
    }

    pub fn notification(notification: super::NotificationMessage) -> Self {
        WebSocketMessage::Notification { notification }
    }

    pub fn error<S: Into<String>>(code: S, message: S) -> Self {
        WebSocketMessage::Error {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<WebSocketError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketError {
    pub code: String,
    pub message: String,
}

impl WebSocketResponse {
    pub fn success<T: Serialize>(data: T) -> Self {
        Self {
            success: true,
            data: Some(serde_json::to_value(data).unwrap()),
            error: None,
        }
    }

    pub fn error<S: Into<String>>(code: S, message: S) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(WebSocketError {
                code: code.into(),
                message: message.into(),
            }),
        }
    }
}
