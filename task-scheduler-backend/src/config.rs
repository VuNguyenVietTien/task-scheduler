use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub supabase_url: String,
    pub supabase_key: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_password: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("PORT must be a number"),
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            supabase_url: env::var("SUPABASE_URL")
                .expect("SUPABASE_URL must be set"),
            supabase_key: env::var("SUPABASE_KEY")
                .expect("SUPABASE_KEY must be set"),
            smtp_host: env::var("SMTP_HOST")
                .expect("SMTP_HOST must be set"),
            smtp_port: env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .expect("SMTP_PORT must be a number"),
            smtp_username: env::var("SMTP_USERNAME")
                .expect("SMTP_USERNAME must be set"),
            smtp_password: env::var("SMTP_PASSWORD")
                .expect("SMTP_PASSWORD must be set"),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            database_url: "postgres://postgres:postgres@localhost:5432/task_scheduler".to_string(),
            jwt_secret: "default-secret-key".to_string(),
            supabase_url: "".to_string(),
            supabase_key: "".to_string(),
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_username: "".to_string(),
            smtp_password: "".to_string(),
        }
    }
}
