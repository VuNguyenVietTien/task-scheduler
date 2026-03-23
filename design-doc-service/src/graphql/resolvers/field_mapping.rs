use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::db::models::field_mapping::FieldMapping;

/// GraphQL type for FieldMapping - accessed through ComponentType.field_mappings()
#[derive(SimpleObject, Clone)]
pub struct FieldMappingType {
    pub id: Uuid,
    pub component_id: Uuid,
    pub db_table: String,
    pub db_column: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<FieldMapping> for FieldMappingType {
    fn from(m: FieldMapping) -> Self {
        Self {
            id: m.id,
            component_id: m.component_id,
            db_table: m.db_table,
            db_column: m.db_column,
            description: m.description,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}
