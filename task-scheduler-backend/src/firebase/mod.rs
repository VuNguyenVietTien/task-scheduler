use firebase_admin_sdk::{
    auth::{DecodedIdToken, IdTokenVerifier},
    credentials::Credentials,
    App, AppSettings,
};
use serde::{Deserialize, Serialize};
use std::error::Error;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct FirebaseUser {
    pub uid: String,
    pub email: Option<String>,
    pub email_verified: bool,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub provider: String,
}

pub struct FirebaseService {
    app: App,
    verifier: IdTokenVerifier,
}

impl FirebaseService {
    pub async fn new(service_account_path: &str) -> Result<Self, Box<dyn Error>> {
        let credentials = Credentials::from_file(service_account_path)?;
        let app = App::new(AppSettings::new(credentials))?;
        let verifier = IdTokenVerifier::new(&app);

        Ok(Self { app, verifier })
    }

    pub async fn verify_id_token(&self, token: &str) -> Result<FirebaseUser, Box<dyn Error>> {
        let decoded = self.verifier.verify_id_token(token).await?;
        self.extract_user_info(&decoded)
    }

    fn extract_user_info(&self, token: &DecodedIdToken) -> Result<FirebaseUser, Box<dyn Error>> {
        Ok(FirebaseUser {
            uid: token.sub.clone(),
            email: token.email.clone(),
            email_verified: token.email_verified.unwrap_or(false),
            name: token.name.clone(),
            picture: token.picture.clone(),
            provider: token
                .firebase
                .sign_in_provider
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
        })
    }

    pub async fn verify_token_and_get_claims(
        &self,
        token: &str,
    ) -> Result<(FirebaseUser, Vec<String>), Box<dyn Error>> {
        let decoded = self.verifier.verify_id_token(token).await?;
        let user = self.extract_user_info(&decoded)?;

        // Extract custom claims (roles)
        let roles: Vec<String> = decoded
            .custom_claims
            .get("roles")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        Ok((user, roles))
    }

    pub async fn create_custom_token(
        &self,
        user_id: Uuid,
        claims: Option<serde_json::Value>,
    ) -> Result<String, Box<dyn Error>> {
        let auth = self.app.auth();
        auth.create_custom_token(user_id.to_string(), claims).await
    }

    pub async fn revoke_tokens(&self, uid: &str) -> Result<(), Box<dyn Error>> {
        let auth = self.app.auth();
        auth.revoke_refresh_tokens(uid).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_firebase_service() {
        let service = FirebaseService::new("path/to/test/service-account.json")
            .await
            .unwrap();

        // Mock token verification
        let test_token = "test_token";
        let result = service.verify_id_token(test_token).await;
        assert!(result.is_err()); // Should fail with invalid token

        // Test custom token creation
        let user_id = Uuid::new_v4();
        let claims = Some(json!({
            "roles": ["user"]
        }));
        
        let token = service.create_custom_token(user_id, claims).await;
        assert!(token.is_ok());
    }

    #[tokio::test]
    async fn test_token_claims() {
        let service = FirebaseService::new("path/to/test/service-account.json")
            .await
            .unwrap();

        let test_token = "test_token";
        let result = service.verify_token_and_get_claims(test_token).await;
        assert!(result.is_err()); // Should fail with invalid token
    }
}