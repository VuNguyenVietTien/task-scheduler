use std::{collections::HashMap, env};
use thiserror::Error;

// Constants
pub const JWT_SECRET: &str = "JWT_SECRET";
pub const JWT_EXPIRY: i64 = 86400; // 24 hours
pub const VERIFICATION_TOKEN_EXPIRY: i64 = 86400; // 24 hours
pub const RESET_TOKEN_EXPIRY: i64 = 3600; // 1 hour
pub const REDIS_SESSION_PREFIX: &str = "session:";
pub const SESSION_DURATION: i64 = 86400; // 24 hours
pub const DB_MAX_CONNECTIONS: u32 = 5;
pub const DB_CONNECT_TIMEOUT: u64 = 30; // seconds
pub const EMAIL_VERIFICATION_TEMPLATE: &str = "verification";
pub const PASSWORD_RESET_TEMPLATE: &str = "reset";
pub const API_VERSION: &str = "v1";
pub const DEFAULT_PAGE_SIZE: i64 = 10;
pub const MAX_PAGE_SIZE: i64 = 100;
pub const GRAPHQL_PATH: &str = "/graphql";
pub const GRAPHIQL_PATH: &str = "/graphiql";

// Error Messages
pub const ERR_INVALID_CREDENTIALS: &str = "Invalid email or password";
pub const ERR_USER_NOT_FOUND: &str = "User not found";
pub const ERR_EMAIL_EXISTS: &str = "Email already exists";
pub const ERR_INVALID_TOKEN: &str = "Invalid token";
pub const ERR_TOKEN_EXPIRED: &str = "Token has expired";
pub const ERR_EMAIL_NOT_VERIFIED: &str = "Email not verified";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppEnvironment {
    Development,
    Test,
    Production,
}

impl Default for AppEnvironment {
    fn default() -> Self {
        Self::Development
    }
}

impl AppEnvironment {
    fn parse(value: &str) -> Result<Self, ConfigError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "development" | "dev" => Ok(Self::Development),
            "test" | "testing" => Ok(Self::Test),
            "production" | "prod" => Ok(Self::Production),
            _ => Err(ConfigError::InvalidVar(format!(
                "APP_ENV (got '{}', want development|test|production)",
                value
            ))),
        }
    }

    pub fn is_production(self) -> bool {
        self == Self::Production
    }
}

#[derive(Debug, Clone, Default)]
pub struct Config {
    pub app_env: AppEnvironment,
    pub database_url: String,
    pub redis_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub auth_secret: String,
    pub jwt_secret: String,
    pub jwt_expiry: i64,
    pub email_from: String,
    pub email_smtp_host: String,
    pub email_smtp_port: u16,
    pub email_smtp_user: String,
    pub email_smtp_pass: String,
    // --- Dual-auth / Supabase (optional; empty = feature off) ---
    pub supabase_url: String,
    pub supabase_service_role_key: String,
    pub supabase_jwt_secret: String,
    pub firebase_project_id: String,
    /// Mark auth cookies as Secure (COOKIE_SECURE, default false for local dev).
    pub cookie_secure: bool,
    /// SameSite policy for auth cookies (COOKIE_SAMESITE: lax|none|strict, default lax).
    pub cookie_same_site: CookieSameSite,
    /// HttpOnly flag for auth cookies (compatibility default false).
    pub cookie_http_only: bool,
    /// Explicit production compatibility mode: browser JavaScript must read the
    /// `auth-token` cookie (legacy web). In production this is the ONLY way to
    /// keep `COOKIE_HTTP_ONLY=false` and must be set deliberately.
    pub cookie_js_compat: bool,
    /// Canonical frontend URL used by verification-email flows.
    pub frontend_url: String,
    /// Exact credentialed CORS origin allowlist.
    pub frontend_origins: Vec<String>,
    /// Run embedded SQLx migrations before serving traffic.
    pub run_migrations: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CookieSameSite {
    Lax,
    None,
    Strict,
}

impl Default for CookieSameSite {
    fn default() -> Self {
        CookieSameSite::Lax
    }
}

impl CookieSameSite {
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "lax" => Some(CookieSameSite::Lax),
            "none" => Some(CookieSameSite::None),
            "strict" => Some(CookieSameSite::Strict),
            _ => None,
        }
    }
}

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingVar(String),

    #[error("Invalid environment variable: {0}")]
    InvalidVar(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    /// Deterministic config constructor for platform tests; unlike process-env
    /// tests this is safe when the Rust test runner executes cases in parallel.
    pub fn from_map(values: &HashMap<String, String>) -> Result<Self, ConfigError> {
        Self::from_lookup(|key| values.get(key).cloned())
    }

    fn from_lookup<F>(mut get: F) -> Result<Self, ConfigError>
    where
        F: FnMut(&str) -> Option<String>,
    {
        let app_env = AppEnvironment::parse(get("APP_ENV").as_deref().unwrap_or("development"))?;
        let production = app_env.is_production();

        let database_url = required(&mut get, "DATABASE_URL")?;
        let jwt_secret = required(&mut get, JWT_SECRET)?;
        let auth_secret = get("AUTH_SECRET").unwrap_or_else(|| {
            if production {
                String::new()
            } else {
                "development-only-auth-secret".to_string()
            }
        });

        // SERVER_* is canonical. HOST/PORT remain supported for the existing
        // Docker/Compose contract; canonical names win when both are present.
        let server_host = get("SERVER_HOST")
            .or_else(|| get("HOST"))
            .unwrap_or_else(|| "127.0.0.1".to_string()); // safe loopback default (F4);
                                                         // containers set HOST/SERVER_HOST
                                                         // explicitly for 0.0.0.0
        let server_port = get("SERVER_PORT")
            .or_else(|| get("PORT"))
            .unwrap_or_else(|| "8080".to_string())
            .parse::<u16>()
            .map_err(|_| ConfigError::InvalidVar("SERVER_PORT/PORT".into()))?;

        let frontend_url_env = get("FRONTEND_URL").unwrap_or_default();
        let origins_raw = get("FRONTEND_ORIGINS")
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                if frontend_url_env.trim().is_empty() {
                    None
                } else {
                    Some(frontend_url_env.clone())
                }
            })
            .unwrap_or_else(|| {
                if production {
                    String::new()
                } else {
                    "http://localhost:3000".to_string()
                }
            });
        let frontend_origins = parse_frontend_origins(&origins_raw, production)?;
        let frontend_url = if frontend_url_env.trim().is_empty() {
            frontend_origins.first().cloned().unwrap_or_default()
        } else {
            frontend_url_env.trim().to_string()
        };

        let cookie_same_site = {
            let raw = get("COOKIE_SAMESITE").unwrap_or_else(|| "lax".to_string());
            CookieSameSite::parse(&raw).ok_or_else(|| {
                ConfigError::InvalidVar(format!(
                    "COOKIE_SAMESITE (got '{}', want lax|none|strict)",
                    raw
                ))
            })?
        };

        let config = Self {
            app_env,
            database_url,
            redis_url: get("REDIS_URL").unwrap_or_default(),
            server_host,
            server_port,
            auth_secret,
            jwt_secret,
            jwt_expiry: parse_or_default(&mut get, "JWT_EXPIRY", JWT_EXPIRY)?,
            email_from: get("EMAIL_FROM").unwrap_or_default(),
            email_smtp_host: get("EMAIL_SMTP_HOST").unwrap_or_default(),
            email_smtp_port: parse_or_default(&mut get, "EMAIL_SMTP_PORT", 587_u16)?,
            email_smtp_user: get("EMAIL_SMTP_USER").unwrap_or_default(),
            email_smtp_pass: get("EMAIL_SMTP_PASS").unwrap_or_default(),
            supabase_url: get("SUPABASE_URL").unwrap_or_default(),
            supabase_service_role_key: get("SUPABASE_SERVICE_ROLE_KEY").unwrap_or_default(),
            supabase_jwt_secret: get("SUPABASE_JWT_SECRET").unwrap_or_default(),
            firebase_project_id: get("FIREBASE_PROJECT_ID").unwrap_or_default(),
            cookie_secure: parse_bool(&mut get, "COOKIE_SECURE", false)?,
            cookie_same_site,
            cookie_http_only: parse_bool(&mut get, "COOKIE_HTTP_ONLY", false)?,
            cookie_js_compat: parse_bool(&mut get, "COOKIE_JS_COMPAT", false)?,
            frontend_url,
            frontend_origins,
            run_migrations: parse_bool(&mut get, "RUN_MIGRATIONS", false)?,
        };

        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.database_url.trim().is_empty() {
            return Err(ConfigError::MissingVar("DATABASE_URL".into()));
        }
        if self.jwt_secret.trim().is_empty() {
            return Err(ConfigError::MissingVar(JWT_SECRET.into()));
        }
        if self.server_host.trim().is_empty() {
            return Err(ConfigError::InvalidVar(
                "SERVER_HOST/HOST cannot be empty".into(),
            ));
        }
        if self.server_port == 0 {
            return Err(ConfigError::InvalidVar(
                "SERVER_PORT/PORT must be greater than zero".into(),
            ));
        }
        if self.frontend_origins.is_empty() {
            return Err(ConfigError::MissingVar(
                "FRONTEND_ORIGINS or FRONTEND_URL".into(),
            ));
        }

        for origin in &self.frontend_origins {
            validate_origin(origin, self.app_env.is_production())?;
        }
        if !self.frontend_url.trim().is_empty() {
            validate_origin(&self.frontend_url, self.app_env.is_production())?;
        }

        if self.app_env.is_production() {
            validate_production_secret(JWT_SECRET, &self.jwt_secret)?;
            validate_production_secret("AUTH_SECRET", &self.auth_secret)?;
            if self.jwt_secret == self.auth_secret {
                return Err(ConfigError::InvalidVar(
                    "JWT_SECRET and AUTH_SECRET must be distinct in production".into(),
                ));
            }
        }

        // F3: production cookie policy fails closed.
        if self.app_env.is_production() {
            if !self.cookie_secure {
                return Err(ConfigError::InvalidVar(
                    "COOKIE_SECURE=true is required in production (auth cookies must be \
                     Secure; same-site None already forces it, lax/strict need it explicitly)"
                        .into(),
                ));
            }
            if !self.cookie_http_only && !self.cookie_js_compat {
                return Err(ConfigError::InvalidVar(
                    "COOKIE_HTTP_ONLY=true is required in production. Set \
                     COOKIE_JS_COMPAT=true explicitly ONLY for legacy browsers that must read \
                     the auth-token cookie from JavaScript (accepts XSS token-theft risk)"
                        .into(),
                ));
            }
            if self.cookie_js_compat {
                eprintln!(
                    "[Config] COOKIE_JS_COMPAT=true in production: auth-token stays readable by \
                     browser JavaScript — deliberate compatibility mode, XSS token-theft risk accepted"
                );
            }
        }

        // F4: safe loopback default; warn on broad production interfaces.
        if self.app_env.is_production() && !is_loopback_host(&self.server_host) {
            eprintln!(
                "[Config] production binding non-loopback interface '{}' — ensure a \
                 firewall/reverse proxy fronts this listener",
                self.server_host
            );
        }
        Ok(())
    }

    pub fn is_production(&self) -> bool {
        self.app_env.is_production()
    }

    pub fn supabase_auth_configured(&self) -> bool {
        !self.supabase_url.trim().is_empty() && !self.supabase_service_role_key.trim().is_empty()
    }

    pub fn supabase_jwt_configured(&self) -> bool {
        !self.supabase_jwt_secret.trim().is_empty()
    }

    pub fn cookie_policy(&self) -> CookiePolicy {
        let mut policy = CookiePolicy {
            secure: self.cookie_secure,
            http_only: self.cookie_http_only,
            same_site: self.cookie_same_site,
        };
        if policy.same_site == CookieSameSite::None && !policy.secure {
            eprintln!(
                "[Config] COOKIE_SAMESITE=None requires Secure cookies — forcing COOKIE_SECURE=true"
            );
            policy.secure = true;
        }
        policy
    }
}

#[derive(Debug, Clone, Copy)]
pub struct CookiePolicy {
    pub secure: bool,
    pub http_only: bool,
    pub same_site: CookieSameSite,
}

impl Default for CookiePolicy {
    fn default() -> Self {
        CookiePolicy {
            secure: false,
            http_only: false,
            same_site: CookieSameSite::Lax,
        }
    }
}

fn required<F>(get: &mut F, key: &str) -> Result<String, ConfigError>
where
    F: FnMut(&str) -> Option<String>,
{
    get(key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ConfigError::MissingVar(key.to_string()))
}

fn parse_or_default<F, T>(get: &mut F, key: &str, default: T) -> Result<T, ConfigError>
where
    F: FnMut(&str) -> Option<String>,
    T: std::str::FromStr + ToString,
{
    get(key)
        .unwrap_or_else(|| default.to_string())
        .parse::<T>()
        .map_err(|_| ConfigError::InvalidVar(key.to_string()))
}

fn parse_bool<F>(get: &mut F, key: &str, default: bool) -> Result<bool, ConfigError>
where
    F: FnMut(&str) -> Option<String>,
{
    parse_or_default(get, key, default)
}

pub fn parse_frontend_origins(raw: &str, production: bool) -> Result<Vec<String>, ConfigError> {
    let mut origins = Vec::new();
    for value in raw.split(',') {
        let origin = value.trim();
        if origin.is_empty() {
            continue;
        }
        validate_origin(origin, production)?;
        if !origins.iter().any(|existing| existing == origin) {
            origins.push(origin.to_string());
        }
    }
    if origins.is_empty() {
        return Err(ConfigError::MissingVar(
            "FRONTEND_ORIGINS or FRONTEND_URL".into(),
        ));
    }
    Ok(origins)
}

fn validate_origin(origin: &str, production: bool) -> Result<(), ConfigError> {
    if origin.contains('*') || origin.chars().any(char::is_whitespace) {
        return Err(ConfigError::InvalidVar(format!(
            "frontend origin must be exact and cannot contain wildcard/whitespace: {}",
            origin
        )));
    }
    let (scheme, authority) = origin.split_once("://").ok_or_else(|| {
        ConfigError::InvalidVar(format!(
            "frontend origin must include http(s) scheme: {}",
            origin
        ))
    })?;
    if !matches!(scheme, "http" | "https")
        || authority.is_empty()
        || authority.contains('/')
        || authority.contains('?')
        || authority.contains('#')
        || authority.contains('@')
    {
        return Err(ConfigError::InvalidVar(format!(
            "frontend origin must be scheme + host + optional port only: {}",
            origin
        )));
    }
    if production && scheme != "https" {
        return Err(ConfigError::InvalidVar(format!(
            "production frontend origin must use https: {}",
            origin
        )));
    }
    Ok(())
}

fn is_loopback_host(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "127.0.0.0/8" | "::1" | "localhost") || host.starts_with("127.")
}

fn validate_production_secret(name: &str, value: &str) -> Result<(), ConfigError> {
    let lower = value.to_ascii_lowercase();
    let placeholder = [
        "change-me",
        "changeme",
        "your-secret",
        "example-secret",
        "test-secret",
    ]
    .iter()
    .any(|marker| lower.contains(marker));
    if value.len() < 32 || placeholder {
        return Err(ConfigError::InvalidVar(format!(
            "{} must be at least 32 characters and non-placeholder in production",
            name
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_values() -> HashMap<String, String> {
        HashMap::from([
            ("DATABASE_URL".into(), "postgres://localhost/test".into()),
            (JWT_SECRET.into(), "test-jwt-secret".into()),
        ])
    }

    #[test]
    fn development_defaults_and_optional_integrations() {
        let config = Config::from_map(&base_values()).unwrap();
        assert_eq!(config.server_host, "127.0.0.1");
        assert_eq!(config.server_port, 8080);
        assert_eq!(config.frontend_origins, vec!["http://localhost:3000"]);
        assert!(config.redis_url.is_empty());
        assert!(!config.supabase_auth_configured());
        assert!(!config.supabase_jwt_configured());
        assert!(!config.run_migrations);
    }

    #[test]
    fn host_port_aliases_and_canonical_precedence() {
        let mut values = base_values();
        values.insert("HOST".into(), "0.0.0.0".into());
        values.insert("PORT".into(), "9090".into());
        let config = Config::from_map(&values).unwrap();
        assert_eq!(config.server_host, "0.0.0.0");
        assert_eq!(config.server_port, 9090);

        values.insert("SERVER_HOST".into(), "127.0.0.2".into());
        values.insert("SERVER_PORT".into(), "9191".into());
        let config = Config::from_map(&values).unwrap();
        assert_eq!(config.server_host, "127.0.0.2");
        assert_eq!(config.server_port, 9191);
    }

    #[test]
    fn cookie_policy_samesite_none_forces_secure() {
        let config = Config {
            cookie_same_site: CookieSameSite::None,
            cookie_http_only: true,
            ..Default::default()
        };
        let policy = config.cookie_policy();
        assert!(policy.secure);
        assert!(policy.http_only);
    }

    #[test]
    fn origin_parser_rejects_wildcards_and_prod_http() {
        assert!(parse_frontend_origins("https://app.example.com", true).is_ok());
        assert!(parse_frontend_origins("https://*.example.com", true).is_err());
        assert!(parse_frontend_origins("http://app.example.com", true).is_err());
    }
}
