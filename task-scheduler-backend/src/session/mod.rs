use actix_session::Session;
use actix_web::{dev::Payload, Error, FromRequest, HttpRequest};
use futures::future::{ready, Ready};

#[derive(Clone)]
pub struct AppSession(Session);

impl FromRequest for AppSession {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let session = Session::extract(req);
        ready(match session.into_inner() {
            Ok(session) => Ok(AppSession(session)),
            Err(e) => Err(e.into()),
        })
    }
}

impl From<Session> for AppSession {
    fn from(session: Session) -> Self {
        Self(session)
    }
}

impl AppSession {
    pub fn get_user_id(&self) -> Option<String> {
        self.0.get::<String>("user_id").ok()?
    }

    pub fn set_user_id(&self, user_id: String) {
        self.0.insert("user_id", user_id).ok();
    }

    pub fn get_firebase_uid(&self) -> Option<String> {
        self.0.get::<String>("firebase_uid").ok()?
    }

    pub fn set_firebase_uid(&self, firebase_uid: String) {
        self.0.insert("firebase_uid", firebase_uid).ok();
    }

    pub fn get_roles(&self) -> Option<Vec<String>> {
        self.0.get::<Vec<String>>("roles").ok()?
    }

    pub fn set_roles(&self, roles: Vec<String>) {
        self.0.insert("roles", roles).ok();
    }

    pub fn get_value<T: for<'de> serde::Deserialize<'de>>(&self, key: &str) -> Option<T> {
        self.0.get::<T>(key).ok()?
    }

    pub fn set_value<T: serde::Serialize>(&self, key: &str, value: T) {
        self.0.insert(key, value).ok();
    }

    pub fn destroy(&self) {
        self.0.purge();
    }

    pub fn renew(&self) {
        self.0.renew();
    }
}