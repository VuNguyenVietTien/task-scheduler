use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::sync::Arc;
use std::fs;
use tokio::sync::RwLock;

const FIREBASE_PUBLIC_KEYS_URL: &str = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

#[derive(Debug, Serialize, Deserialize)]
pub struct FirebaseUser {
    pub uid: String,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub provider: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseClaims {
    #[serde(rename = "sub")]
    subject: String,
    #[serde(rename = "aud")]
    audience: String,
    #[serde(rename = "iss")]
    issuer: String,
    #[serde(rename = "iat")]
    issued_at: i64,
    #[serde(rename = "exp")]
    expires_at: i64,
    email: Option<String>,
    email_verified: Option<bool>,
    name: Option<String>,
    picture: Option<String>,
    auth_time: i64,
    firebase: Option<FirebaseProvider>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseProvider {
    sign_in_provider: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServiceAccount {
    project_id: String,
}

pub struct FirebaseService {
    project_id: String,
    http_client: Client,
    public_keys: Arc<RwLock<Value>>,
}

impl std::fmt::Debug for FirebaseService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FirebaseService")
            .field("project_id", &self.project_id)
            .field("http_client", &"Client{...}")
            .field("public_keys", &"Arc<RwLock<Value>>{...}")
            .finish()
    }
}

impl FirebaseService {
    pub fn new(service_account_path: String) -> Result<Self, Box<dyn Error>> {
        // Read and parse the service account file
        let contents = fs::read_to_string(service_account_path)?;
        let service_account: ServiceAccount = serde_json::from_str(&contents)?;

        Ok(Self {
            project_id: service_account.project_id,
            http_client: Client::new(),
            public_keys: Arc::new(RwLock::new(Value::Null)),
        })
    }

    async fn refresh_public_keys(&self) -> Result<(), Box<dyn Error>> {
        let response = self.http_client.get(FIREBASE_PUBLIC_KEYS_URL).send().await?;
        let keys = response.json::<Value>().await?;
        *self.public_keys.write().await = keys;
        Ok(())
    }

    pub async fn verify_id_token(&self, token: &str) -> Result<FirebaseUser, Box<dyn Error>> {
        // Refresh public keys if needed
        if self.public_keys.read().await.is_null() {
            self.refresh_public_keys().await?;
        }

        let keys = self.public_keys.read().await;
        let header = jsonwebtoken::decode_header(token)?;
        let kid = header.kid.ok_or("No 'kid' in token header")?;
        
        let public_key = keys.get(&kid).ok_or("No matching public key found")?;
        let decoding_key = DecodingKey::from_rsa_pem(public_key.as_str().unwrap().as_bytes())?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[&self.project_id]);
        validation.set_issuer(&[&format!(
            "https://securetoken.google.com/{}",
            self.project_id
        )]);

        let claims = decode::<FirebaseClaims>(token, &decoding_key, &validation)?.claims;

        Ok(FirebaseUser {
            uid: claims.subject,
            email: claims.email,
            email_verified: claims.email_verified,
            name: claims.name,
            picture: claims.picture,
            provider: claims.firebase.and_then(|f| f.sign_in_provider),
        })
    }

    pub async fn verify_token_and_get_claims(
        &self,
        token: &str,
    ) -> Result<(FirebaseUser, Vec<String>), Box<dyn Error>> {
        let user = self.verify_id_token(token).await?;
        // Note: Custom claims handling would need to be implemented based on your specific needs
        Ok((user, vec![]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[tokio::test]
    async fn test_firebase_service() {
        let test_path = PathBuf::from("tests/mocks/service-account.json");
        if !test_path.exists() {
            println!("Skipping test: service account file not found");
            return;
        }

        let service = FirebaseService::new(test_path.to_str().unwrap().to_string()).unwrap();

        // Test with invalid token
        let test_token = "invalid_token";
        let result = service.verify_id_token(test_token).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_token_claims() {
        let test_path = PathBuf::from("tests/mocks/service-account.json");
        if !test_path.exists() {
            println!("Skipping test: service account file not found");
            return;
        }

        let service = FirebaseService::new(test_path.to_str().unwrap().to_string()).unwrap();

        let test_token = "invalid_token";
        let result = service.verify_token_and_get_claims(test_token).await;
        assert!(result.is_err());
    }
}
