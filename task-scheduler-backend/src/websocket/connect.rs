use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use std::sync::Arc;

use super::{NotificationBroadcaster, WebSocketState};

pub async fn ws_connect(
    req: HttpRequest,
    stream: web::Payload,
    broadcaster: web::Data<Arc<NotificationBroadcaster>>,
) -> Result<HttpResponse, Error> {
    let state = WebSocketState::new(broadcaster.get_ref().as_ref().clone());
    ws::start(state, &req, stream)
}
