use std::collections::HashMap;
use async_graphql::{Object, SimpleObject};
use futures_util::future::BoxFuture;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, SimpleObject)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub workspace_id: Option<String>,
    pub icon_url: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_public: bool,
}

pub struct DataLoader<K, V> {
    cache: Arc<RwLock<HashMap<K, V>>>,
}

impl<K, V> DataLoader<K, V>
where
    K: Eq + std::hash::Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn load_one(&self, key: K, loader: impl Fn(K) -> BoxFuture<'static, Option<V>>) -> Option<V> {
        if let Some(value) = self.cache.read().await.get(&key) {
            return Some(value.clone());
        }

        if let Some(value) = loader(key.clone()).await {
            self.cache.write().await.insert(key, value.clone());
            Some(value)
        } else {
            None
        }
    }

    pub async fn load_many(
        &self,
        keys: Vec<K>,
        loader: impl Fn(Vec<K>) -> BoxFuture<'static, HashMap<K, V>>,
    ) -> HashMap<K, V> {
        let mut to_load = Vec::new();
        let mut result = HashMap::new();
        {
            let cache = self.cache.read().await;
            for key in keys {
                if let Some(value) = cache.get(&key) {
                    result.insert(key, value.clone());
                } else {
                    to_load.push(key);
                }
            }
        }

        if !to_load.is_empty() {
            let loaded = loader(to_load).await;
            let mut cache = self.cache.write().await;
            for (k, v) in loaded.iter() {
                cache.insert(k.clone(), v.clone());
                result.insert(k.clone(), v.clone());
            }
        }

        result
    }
}

#[derive(Clone)]
pub struct UserLoader {
    pool: PgPool,
    loader: Arc<DataLoader<Uuid, UserInfo>>,
}

impl UserLoader {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            loader: Arc::new(DataLoader::new()),
        }
    }

    pub async fn load(&self, user_id: Uuid) -> Option<UserInfo> {
        let pool = self.pool.clone();
        self.loader
            .load_one(user_id, move |id| {
                let pool = pool.clone();
                Box::pin(async move {
                    sqlx::query(
                        "SELECT user_id, email, name, avatar_url FROM users WHERE user_id = $1"
                    )
                    .bind(id)
                    .map(|row| UserInfo {
                        id: row.get::<Uuid, _>("user_id").to_string(),
                        email: row.get("email"),
                        name: row.get("name"),
                        avatar_url: row.get("avatar_url"),
                    })
                    .fetch_optional(&pool)
                    .await
                    .ok()
                    .flatten()
                })
            })
            .await
    }
}

#[derive(Clone)]
pub struct ProjectLoader {
    pool: PgPool,
    loader: Arc<DataLoader<Uuid, ProjectInfo>>,
}

impl ProjectLoader {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            loader: Arc::new(DataLoader::new()),
        }
    }

    pub async fn load(&self, project_id: Uuid) -> Option<ProjectInfo> {
        let pool = self.pool.clone();
        self.loader
            .load_one(project_id, move |id| {
                let pool = pool.clone();
                Box::pin(async move {
                    sqlx::query(
                        "SELECT project_id, name, description, owner_id, workspace_id,
                                icon_url, metadata, is_public
                         FROM projects WHERE project_id = $1"
                    )
                    .bind(id)
                    .map(|row| ProjectInfo {
                        id: row.get::<Uuid, _>("project_id").to_string(),
                        name: row.get("name"),
                        description: row.get("description"),
                        owner_id: row.get::<Uuid, _>("owner_id").to_string(),
                        workspace_id: row.get::<Option<Uuid>, _>("workspace_id")
                            .map(|id| id.to_string()),
                        icon_url: row.get("icon_url"),
                        metadata: row.get("metadata"),
                        is_public: row.get("is_public"),
                    })
                    .fetch_optional(&pool)
                    .await
                    .ok()
                    .flatten()
                })
            })
            .await
    }
}
