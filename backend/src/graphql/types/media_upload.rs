use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
pub enum StorageType {
    #[graphql(name = "local")]
    Local,
    #[graphql(name = "google_drive")]
    GoogleDrive,
}

impl Default for StorageType {
    fn default() -> Self {
        StorageType::Local
    }
}

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
pub struct MediaUploadResponse {
    /// Unique identifier for the uploaded file
    pub id: ID,

    /// Original filename
    pub filename: String,

    /// MIME type of the file
    pub mimetype: String,

    /// Size of the file in bytes
    pub size: i32,

    /// Public URL to access the file
    pub url: String,

    /// Upload timestamp
    pub created_at: DateTime<Utc>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct MediaUploadInput {
    pub file: Upload,
    pub storage_type: Option<StorageType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaUploadEntity {
    pub id: uuid::Uuid,
    pub filename: String,
    pub mimetype: String,
    pub size: i32,
    pub url: String,
    pub storage_path: String,
    pub storage_type: StorageType,
    pub user_id: uuid::Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl From<MediaUploadEntity> for MediaUploadResponse {
    fn from(entity: MediaUploadEntity) -> Self {
        Self {
            id: entity.id.to_string().into(),
            filename: entity.filename,
            mimetype: entity.mimetype,
            size: entity.size,
            url: entity.url,
            created_at: entity.created_at,
        }
    }
}
