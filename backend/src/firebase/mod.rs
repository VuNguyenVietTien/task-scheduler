use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation, decode_header, encode, Header, EncodingKey};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::sync::Arc;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use tokio::sync::RwLock;
use log::{info, error, debug, warn};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use std::collections::HashMap;

const FIREBASE_PUBLIC_KEYS_URL: &str = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const FCM_AUTH_URL: &str = "https://oauth2.googleapis.com/token";
const FCM_V1_SEND_URL: &str = "https://fcm.googleapis.com/v1/projects/{}/messages:send";

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
pub struct ServiceAccount {
    project_id: String,
    client_email: String,
    private_key: String,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FcmNotificationPayload {
    pub title: String,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FcmDataPayload {
    pub notification_id: String,
    pub notification_type: String,
    pub project_id: Option<String>,
    pub task_id: Option<String>,
    pub comment_id: Option<String>,
    pub user_id: String,
    pub sender_id: Option<String>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FcmMessage {
    pub to: String,
    pub notification: FcmNotificationPayload,
    pub data: FcmDataPayload,
    pub priority: Option<String>,
}

pub struct FirebaseService {
    project_id: String,
    http_client: Client,
    public_keys: Arc<RwLock<Value>>,
    server_key: Option<String>,
    service_account: ServiceAccount,
}

impl std::fmt::Debug for FirebaseService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FirebaseService")
            .field("project_id", &self.project_id)
            .field("http_client", &"Client{...}")
            .field("public_keys", &"Arc<RwLock<Value>>{...}")
            .field("server_key", &self.server_key.as_ref().map(|_| "***"))
            .finish()
    }
}

impl FirebaseService {
    pub fn new(service_account_path: String) -> Result<Self, Box<dyn Error>> {
        info!("[Firebase] Loading service account from: {}", service_account_path);

        // Read and parse the service account file
        let contents = fs::read_to_string(&service_account_path)?;
        let service_account: ServiceAccount = serde_json::from_str(&contents)
            .map_err(|e| {
                error!("[Firebase] Failed to parse service account JSON: {}", e);
                e
            })?;

        info!("[Firebase] Initialized with project_id: {}", service_account.project_id);

        // Tìm server key từ nhiều nguồn khác nhau
        // 1. Đầu tiên, thử từ biến môi trường
        let mut server_key = std::env::var("FIREBASE_SERVER_KEY").ok();
        
        // 2. Nếu không có, thử đọc từ file riêng 
        if server_key.is_none() {
            let server_key_path = format!("{}.key", service_account_path);
            if let Ok(key) = fs::read_to_string(&server_key_path) {
                info!("[Firebase] FCM server key loaded from file: {}", server_key_path);
                server_key = Some(key.trim().to_string());
            }
        }
        
        // 3. Fallback: Sử dụng key test cứng cho phát triển
        if server_key.is_none() {
            // SỬ DỤNG KEY MẶC ĐỊNH CHỈ CHO MÔI TRƯỜNG DEV
            if cfg!(debug_assertions) { // Kiểm tra nếu đang trong chế độ debug
                warn!("[Firebase] USING DEVELOPMENT SERVER KEY - NOT SECURE FOR PRODUCTION");
                server_key = Some("DEVELOPMENT_SERVER_KEY".to_string());
            }
        }
        
        if server_key.is_some() {
            info!("[Firebase] FCM server key loaded successfully");
        } else {
            warn!("[Firebase] FCM server key not found, FCM functionality will be limited");
        }

        Ok(Self {
            project_id: service_account.project_id.clone(),
            http_client: Client::new(),
            public_keys: Arc::new(RwLock::new(Value::Null)),
            server_key,
            service_account,
        })
    }

    fn has_valid_credentials(&self) -> bool {
        !self.service_account.private_key.is_empty() && 
        !self.service_account.client_email.is_empty()
    }

    async fn refresh_public_keys(&self) -> Result<(), Box<dyn Error>> {
        info!("[Firebase] Refreshing public keys from {}", FIREBASE_PUBLIC_KEYS_URL);
        
        let response = self.http_client.get(FIREBASE_PUBLIC_KEYS_URL).send().await?;
        let keys = response.json::<Value>().await?;
        
        debug!("[Firebase] Received public keys: {:?}", keys);
        
        *self.public_keys.write().await = keys;
        info!("[Firebase] Public keys refreshed successfully");
        
        Ok(())
    }

    pub async fn verify_id_token(&self, token: &str) -> Result<FirebaseUser, Box<dyn Error>> {
        info!("[Firebase] Starting token verification");

        // Parse and validate token header
        let header = decode_header(token)
            .map_err(|e| {
                error!("[Firebase] Failed to decode token header: {}", e);
                e
            })?;
        info!("[Firebase] Token header: {:?}", header);

        // Check algorithm
        if header.alg != Algorithm::RS256 {
            error!("[Firebase] Invalid token algorithm: {:?}", header.alg);
            return Err("Invalid token algorithm".into());
        }

        // Get kid from header
        let kid = header.kid.ok_or_else(|| {
            error!("[Firebase] No 'kid' in token header");
            "No 'kid' in token header"
        })?;

        // Refresh public keys if needed
        if self.public_keys.read().await.is_null() {
            info!("[Firebase] No public keys cached, refreshing...");
            self.refresh_public_keys().await?;
        }

        // Get the right public key
        let keys = self.public_keys.read().await;
        let public_key = keys.get(&kid).ok_or_else(|| {
            error!("[Firebase] No matching public key found for kid: {}", kid);
            "No matching public key found"
        })?;

        let decoding_key = DecodingKey::from_rsa_pem(public_key.as_str().unwrap().as_bytes())?;

        // Set up validation
        let mut validation = Validation::new(Algorithm::RS256);
        let expected_issuer = format!(
            "https://securetoken.google.com/{}",
            self.project_id
        );
        validation.set_audience(&[&self.project_id]);
        validation.set_issuer(&[&expected_issuer]);

        info!("[Firebase] Verifying token with:");
        info!("[Firebase] - Project ID: {}", self.project_id);
        info!("[Firebase] - Expected issuer: {}", expected_issuer);

        // Decode and verify token
        let token_data = decode::<FirebaseClaims>(token, &decoding_key, &validation)
            .map_err(|e| {
                error!("[Firebase] Token verification failed: {}", e);
                error!("[Firebase] Token claims may not match expected values:");
                error!("[Firebase] - Expected project_id (aud): {}", self.project_id);
                error!("[Firebase] - Expected issuer: {}", expected_issuer);
                e
            })?;

        info!("[Firebase] Token verified successfully");
        debug!("[Firebase] Token claims: {:?}", token_data.claims);

        Ok(FirebaseUser {
            uid: token_data.claims.subject,
            email: token_data.claims.email,
            email_verified: token_data.claims.email_verified,
            name: token_data.claims.name,
            picture: token_data.claims.picture,
            provider: token_data.claims.firebase.and_then(|f| f.sign_in_provider),
        })
    }

    pub async fn verify_token_and_get_claims(
        &self,
        token: &str,
    ) -> Result<(FirebaseUser, Vec<String>), Box<dyn Error>> {
        let user = self.verify_id_token(token).await?;
        Ok((user, vec![]))
    }

    /// Send a Firebase Cloud Messaging (FCM) notification to a specific device
    pub async fn send_fcm_notification(
        &self,
        device_token: &str,
        notification: FcmNotificationPayload,
        data: FcmDataPayload,
    ) -> Result<(), Box<dyn Error>> {
        info!("[Firebase] Sending FCM notification to device: {}", device_token);
        debug!("[Firebase] Notification data: {:?}", notification);

        // Nếu đang ở chế độ debug và dev_mode = true thì chỉ log không gửi
        // DEBUG: Tạm thời vô hiệu hóa kiểm tra debug_assertions để FCM luôn được gửi
        // if cfg!(debug_assertions) {
        //     info!("[Firebase] Running in debug mode, not sending FCM notification");
        //     info!("[Firebase] Would send to: {}", device_token);
        //     info!("[Firebase] Title: {}", notification.title);
        //     info!("[Firebase] Body: {}", notification.body);
        //     return Ok(());
        // }

        let fcm_message = self.build_fcm_message(device_token, &notification, &data);
        
        // DEV MODE FALLBACK
        if cfg!(debug_assertions) && !self.has_valid_credentials() {
            warn!("[Firebase] Running in DEV MODE without valid credentials");
            info!("[Firebase] DEV MODE: FCM would be sent to: {}", device_token);
            info!("[Firebase] DEV MODE: Title: {}", notification.title);
            info!("[Firebase] DEV MODE: Body: {}", notification.body);
            return Ok(());
        }
        
        info!("[Firebase] Sending FCM notification to device: {}", device_token);
        debug!("[Firebase] Notification data: {:?}", notification);
        
        // Đầu tiên, authenticate với Google để lấy access token
        // Sử dụng service account để tạo JWT và exchange lấy access token
        let jwt = create_auth_token(&self.service_account)?;
        
        let token_response = self.http_client
            .post(FCM_AUTH_URL)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", &jwt)
            ])
            .send()
            .await?;
            
        if !token_response.status().is_success() {
            let status = token_response.status();
            let error_text = token_response.text().await?;
            error!("[Firebase] FCM auth failed: Status: {}, Response: {}", status, error_text);
            return Err(format!("FCM auth failed: {}", error_text).into());
        }
        
        let token_data: AccessTokenResponse = token_response.json().await?;
        
        // Gửi request đến FCM HTTP v1 API
        let fcm_url = FCM_V1_SEND_URL.replace("{}", &self.project_id);
        
        let response = self.http_client
            .post(&fcm_url)
            .bearer_auth(&token_data.access_token)
            .header("Content-Type", "application/json")
            .json(&fcm_message)
            .send()
            .await?;
            
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            error!("[Firebase] FCM send failed: Status: {}, Response: {}", status, error_text);
            return Err(format!("FCM send failed: {}", error_text).into());
        }
        
        let response_json = response.json::<Value>().await?;
        info!("[Firebase] FCM send successful: {:?}", response_json);
        
        // Log more detailed FCM response for debugging
        debug!("[Firebase] FCM detailed response for token {}: {}", 
               device_token,
               serde_json::to_string_pretty(&response_json).unwrap_or_else(|_| "Could not serialize response".to_string()));
                
        // Extract the message ID from response for tracking
        if let Some(name) = response_json.get("name") {
            if let Some(message_id) = name.as_str() {
                info!("[Firebase] FCM message sent with ID: {}", message_id);
            }
        }
        
        Ok(())
    }
    
    /// Send a Firebase Cloud Messaging (FCM) notification to multiple devices
    pub async fn send_fcm_notification_to_multiple(
        &self,
        device_tokens: &[String],
        notification: FcmNotificationPayload,
        data: FcmDataPayload,
    ) -> Result<(), Box<dyn Error>> {
        for token in device_tokens {
            match self.send_fcm_notification(token, notification.clone(), data.clone()).await {
                Ok(_) => info!("[Firebase] FCM notification sent to device: {}", token),
                Err(e) => error!("[Firebase] Failed to send FCM to device {}: {}", token, e),
            }
        }
        Ok(())
    }
    
    /// Send a Firebase Cloud Messaging (FCM) notification to multiple tokens and return detailed response
    pub async fn send_notification_to_tokens(
        &self,
        device_tokens: Vec<String>,
        notification: FcmNotificationPayload,
        data: FcmDataPayload,
    ) -> Result<FcmSendResult, FirebaseError> {
        if device_tokens.is_empty() {
            return Ok(FcmSendResult {
                success_count: 0,
                failure_count: 0,
                total: 0,
                tokens: serde_json::Map::new(),
            });
        }

        let mut success_count = 0;
        let mut failure_count = 0;
        let mut results = serde_json::Map::new();

        for token in device_tokens {
            match self.send_fcm_notification(&token, notification.clone(), data.clone()).await {
                Ok(_) => {
                    success_count += 1;
                    results.insert(token.clone(), serde_json::json!({ "status": "success" }));
                },
                Err(e) => {
                    failure_count += 1;
                    results.insert(token.clone(), serde_json::json!({ 
                        "status": "error",
                        "error": e.to_string()
                    }));
                }
            }
        }

        Ok(FcmSendResult {
            success_count,
            failure_count,
            total: success_count + failure_count,
            tokens: results,
        })
    }

    fn build_fcm_message(
        &self,
        device_token: &str,
        notification: &FcmNotificationPayload,
        data: &FcmDataPayload,
    ) -> FcmV1Message {
        let android_config = AndroidConfig {
            priority: Some("high".to_string()),
            notification: Some(AndroidNotification {
                title: Some(notification.title.clone()),
                body: Some(notification.body.clone()),
                channel_id: Some("task_notifications".to_string()),
                notification_priority: Some("PRIORITY_HIGH".to_string()),
                default_vibrate_timings: Some(true),
                default_sound: Some(true),
                ..Default::default()
            }),
            ..Default::default()
        };

        let apns_config = ApnsConfig {
            headers: Some(HashMap::from([
                ("apns-priority".to_string(), "10".to_string()),
            ])),
            payload: Some(ApnsPayload {
                aps: Aps {
                    alert: Some(ApsAlert {
                        title: Some(notification.title.clone()),
                        body: Some(notification.body.clone()),
                        ..Default::default()
                    }),
                    badge: Some(1),
                    sound: Some("default".to_string()),
                    content_available: Some(true),
                    mutable_content: Some(true),
                    ..Default::default()
                },
                ..Default::default()
            }),
            ..Default::default()
        };
        
        // Thêm Web Push config
        let webpush_config = WebPushConfig {
            headers: Some(HashMap::from([
                ("Urgency".to_string(), "high".to_string()),
            ])),
            ..Default::default()
        };

        // Serialize data to a JSON object that FCM can handle
        let mut fcm_data = HashMap::new();
        fcm_data.insert("notification_id".to_string(), data.notification_id.clone());
        fcm_data.insert("notification_type".to_string(), data.notification_type.clone());
        
        if let Some(project_id) = &data.project_id {
            fcm_data.insert("project_id".to_string(), project_id.clone());
        }
        
        if let Some(task_id) = &data.task_id {
            fcm_data.insert("task_id".to_string(), task_id.clone());
        }
        
        if let Some(comment_id) = &data.comment_id {
            fcm_data.insert("comment_id".to_string(), comment_id.clone());
        }
        
        fcm_data.insert("user_id".to_string(), data.user_id.clone());
        
        if let Some(sender_id) = &data.sender_id {
            fcm_data.insert("sender_id".to_string(), sender_id.clone());
        }
        
        // Thêm các giá trị extra nếu có
        for (key, value) in &data.extra {
            fcm_data.insert(key.clone(), value.clone());
        }

        // Tạo FCM message với cấu trúc đúng
        let fcm_message = FcmV1Message {
            validate_only: Some(false),
            message: Message {
                token: Some(device_token.to_string()),
                notification: Some(Notification {
                    title: Some(notification.title.clone()),
                    body: Some(notification.body.clone()),
                }),
                android: Some(android_config),
                apns: Some(apns_config),
                webpush: Some(webpush_config),
                data: Some(fcm_data),
                ..Default::default()
            },
        };
        
        // Log the final message structure for debugging
        debug!("[Firebase] Final FCM message structure: {}", 
               serde_json::to_string_pretty(&fcm_message).unwrap_or_else(|_| "Could not serialize message".to_string()));
        
        fcm_message
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

fn create_auth_token(service_account: &ServiceAccount) -> Result<String, Box<dyn Error>> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let token_expiration = 3600; // 1 hour
    
    let claims = serde_json::json!({
        "iss": service_account.client_email,
        "sub": service_account.client_email,
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + token_expiration,
        "scope": "https://www.googleapis.com/auth/firebase.messaging"
    });
    
    // Create JWT header with RS256 algorithm (standard for Google services)
    let header = Header::new(Algorithm::RS256);
    
    // Normalize private key - replace escaped newlines and clean up
    let mut private_key = service_account.private_key.replace("\\n", "\n");
    
    // Also handle Windows line endings and any whitespace issues
    private_key = private_key.replace("\r\n", "\n").trim().to_string();
    
    info!("[Firebase] Processing private key for JWT creation (length: {})", private_key.len());
    
    // If the private key doesn't have the proper PEM header/footer, add them
    let formatted_key = if !private_key.contains("-----BEGIN PRIVATE KEY-----") {
        format!("-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----", private_key)
    } else {
        private_key
    };
    
    // Method 1: Try to create encoding key from standard PEM format
    match EncodingKey::from_rsa_pem(formatted_key.as_bytes()) {
        Ok(key) => {
            info!("[Firebase] Successfully loaded RSA key");
            match encode(&header, &claims, &key) {
                Ok(token) => {
                    info!("[Firebase] JWT token created successfully with RSA PEM");
                    return Ok(token);
                },
                Err(e) => {
                    warn!("[Firebase] Failed to encode JWT with RSA key: {}", e);
                    // Continue to next method
                }
            }
        },
        Err(e) => {
            warn!("[Firebase] Failed to load RSA key: {}", e);
            // Continue to next method
        }
    }
    
    // Method 2: Try with EC PEM instead
    info!("[Firebase] Trying EC PEM key format");
    match EncodingKey::from_ec_pem(formatted_key.as_bytes()) {
        Ok(key) => {
            info!("[Firebase] Successfully loaded EC PEM key");
            match encode(&header, &claims, &key) {
                Ok(token) => {
                    info!("[Firebase] JWT token created successfully with EC PEM");
                    return Ok(token);
                },
                Err(e) => {
                    warn!("[Firebase] Failed to encode JWT with EC PEM key: {}", e);
                    // Continue to next method
                }
            }
        },
        Err(e) => {
            warn!("[Firebase] Failed to load EC PEM key: {}", e);
            // Continue to next method
        }
    }
    
    // Method 3: Try to extract the base64 content from PEM and decode to DER
    info!("[Firebase] Trying with base64 extraction from PEM");
    let pem_content = formatted_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace("\n", "")
        .trim()
        .to_string();
    
    if let Ok(der_bytes) = BASE64.decode(&pem_content) {
        info!("[Firebase] Successfully decoded base64 to DER (length: {})", der_bytes.len());
        
        // Create an encoding key using simpler approach
        let der_result = EncodingKey::from_rsa_der(&der_bytes);
        info!("[Firebase] Successfully created RSA key from DER");
        
        match encode(&header, &claims, &der_result) {
            Ok(token) => {
                info!("[Firebase] JWT token created successfully with RSA DER");
                return Ok(token);
            },
            Err(e) => {
                warn!("[Firebase] Failed to encode JWT with RSA DER key: {}", e);
            }
        }
    } else {
        warn!("[Firebase] Failed to decode base64 to DER");
    }
    
    // Method 4: Last resort - try with secret key
    info!("[Firebase] Trying with secret key as last resort");
    let secret_key = EncodingKey::from_secret(formatted_key.as_bytes());
    match encode(&header, &claims, &secret_key) {
        Ok(token) => {
            info!("[Firebase] JWT token created successfully with secret key");
            return Ok(token);
        },
        Err(e) => {
            error!("[Firebase] All key parsing methods failed. Last error: {}", e);
            error!("[Firebase] Private key length: {}", service_account.private_key.len());
            error!("[Firebase] Please verify the service account key is valid");
            
            return Err(format!("Failed to create JWT token: {}", e).into());
        }
    }
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: String,
    token_type: String,
    expires_in: u64,
}

#[derive(Debug, Serialize, Clone, Default)]
struct FcmV1Message {
    validate_only: Option<bool>,
    message: Message,
}

#[derive(Debug, Serialize, Clone, Default)]
struct AndroidConfig {
    priority: Option<String>,
    notification: Option<AndroidNotification>,
}

#[derive(Debug, Serialize, Clone, Default)]
struct ApnsConfig {
    headers: Option<HashMap<String, String>>,
    payload: Option<ApnsPayload>,
}

#[derive(Debug, Serialize, Clone)]
struct WebPushConfig {
    headers: Option<HashMap<String, String>>,
}

impl Default for WebPushConfig {
    fn default() -> Self {
        Self {
            headers: None,
        }
    }
}

#[derive(Debug, Serialize, Clone, Default)]
struct AndroidNotification {
    title: Option<String>,
    body: Option<String>,
    channel_id: Option<String>,
    notification_priority: Option<String>,
    default_vibrate_timings: Option<bool>,
    default_sound: Option<bool>,
}

#[derive(Debug, Serialize, Clone, Default)]
struct ApnsPayload {
    aps: Aps,
}

#[derive(Debug, Serialize, Clone, Default)]
struct Aps {
    alert: Option<ApsAlert>,
    badge: Option<u8>,
    sound: Option<String>,
    content_available: Option<bool>,
    mutable_content: Option<bool>,
}

#[derive(Debug, Serialize, Clone, Default)]
struct ApsAlert {
    title: Option<String>,
    body: Option<String>,
}

#[derive(Debug, Serialize, Clone, Default)]
struct Notification {
    title: Option<String>,
    body: Option<String>,
}

#[derive(Debug, Serialize, Clone, Default)]
struct Message {
    token: Option<String>,
    notification: Option<Notification>,
    data: Option<std::collections::HashMap<String, String>>,
    android: Option<AndroidConfig>,
    apns: Option<ApnsConfig>,
    webpush: Option<WebPushConfig>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FcmSendResult {
    pub success_count: usize,
    pub failure_count: usize,
    pub total: usize,
    pub tokens: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug)]
pub struct FirebaseError {
    message: String,
}

impl std::fmt::Display for FirebaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Firebase error: {}", self.message)
    }
}

impl std::error::Error for FirebaseError {}
