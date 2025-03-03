use std::env;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry: i64,
    pub cors_origin: String,
    pub upload_dir: String,
    pub max_upload_size: i64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            database_url: "postgres://postgres:postgres@localhost:5432/task_scheduler".to_string(),
            jwt_secret: "your-secret-key".to_string(),
            jwt_expiry: 24 * 60 * 60, // 24 hours
            cors_origin: "http://localhost:3000".to_string(),
            upload_dir: "uploads".to_string(),
            max_upload_size: 10 * 1024 * 1024, // 10MB
        }
    }
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("PORT must be a number"),
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            jwt_expiry: env::var("JWT_EXPIRY")
                .unwrap_or_else(|_| "86400".to_string()) // 24 hours
                .parse()
                .expect("JWT_EXPIRY must be a number"),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            upload_dir: env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string()),
            max_upload_size: env::var("MAX_UPLOAD_SIZE")
                .unwrap_or_else(|_| "10485760".to_string()) // 10MB
                .parse()
                .expect("MAX_UPLOAD_SIZE must be a number"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 8080);
        assert_eq!(config.jwt_expiry, 86400);
    }

    #[test]
    fn test_config_from_env() {
        env::set_var("HOST", "0.0.0.0");
        env::set_var("PORT", "3000");
        env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");
        env::set_var("JWT_SECRET", "test-secret");
        env::set_var("JWT_EXPIRY", "3600");
        env::set_var("CORS_ORIGIN", "http://localhost:8000");
        env::set_var("UPLOAD_DIR", "test-uploads");
        env::set_var("MAX_UPLOAD_SIZE", "5242880");

        let config = Config::from_env();
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 3000);
        assert_eq!(config.database_url, "postgres://test:test@localhost/test");
        assert_eq!(config.jwt_secret, "test-secret");
        assert_eq!(config.jwt_expiry, 3600);
        assert_eq!(config.cors_origin, "http://localhost:8000");
        assert_eq!(config.upload_dir, "test-uploads");
        assert_eq!(config.max_upload_size, 5242880);
    }
}
