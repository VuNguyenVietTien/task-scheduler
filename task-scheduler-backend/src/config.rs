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
    pub frontend_url: String,
    pub allowed_origins: Vec<String>,
    pub app_env: String,
    pub max_file_size: usize,
    pub firebase_service_account_path: String,
}

impl Config {
    pub fn from_env() -> Self {
        // Load environment-specific .env file
        if let Ok(app_env) = env::var("APP_ENV") {
            let env_file = format!(".env.{}", app_env);
            if let Err(err) = dotenv::from_filename(&env_file) {
                eprintln!("Warning: Could not load {}: {}", env_file, err);
            }
        }
        // Fallback to default .env
        if let Err(err) = dotenv::dotenv() {
            eprintln!("Warning: Could not load .env: {}", err);
        }

        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let _app_env = env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3002".to_string())
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
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            allowed_origins,
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "10485760".to_string()) // 10MB default
                .parse()
                .expect("MAX_FILE_SIZE must be a number"),
            firebase_service_account_path: env::var("FIREBASE_SERVICE_ACCOUNT_PATH")
                .unwrap_or_else(|_| format!("config/firebase-service-account.json")),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3002,
            database_url: "postgres://postgres:postgres@localhost:5432/task_scheduler".to_string(),
            jwt_secret: "default-secret-key".to_string(),
            supabase_url: "".to_string(),
            supabase_key: "".to_string(),
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_username: "".to_string(),
            smtp_password: "".to_string(),
            frontend_url: "http://localhost:3000".to_string(),
            allowed_origins: vec!["http://localhost:3000".to_string()],
            app_env: "development".to_string(),
            max_file_size: 10485760, // 10MB
            firebase_service_account_path: "config/firebase-service-account.json".to_string(),
        }
    }
}
