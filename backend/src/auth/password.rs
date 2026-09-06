use bcrypt::{hash as bcrypt_hash, verify, BcryptError, DEFAULT_COST};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PasswordError {
    #[error("Invalid password")]
    InvalidPassword,

    #[error("Bcrypt error: {0}")]
    BcryptError(#[from] BcryptError),
}

pub fn hash(password: String) -> Result<String, PasswordError> {
    bcrypt_hash(password.as_bytes(), DEFAULT_COST).map_err(|e| PasswordError::BcryptError(e))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, PasswordError> {
    match verify(password, hash) {
        Ok(valid) => {
            if !valid {
                Err(PasswordError::InvalidPassword)
            } else {
                Ok(true)
            }
        }
        Err(e) => Err(PasswordError::BcryptError(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hash_and_verify() {
        let password = "test123".to_string();
        let hash = hash(password.clone()).unwrap();

        assert!(verify_password(&password, &hash).unwrap());
        // Wrong password must NOT verify: verify_password returns Err on mismatch,
        // so unwrap_or(false) keeps the assertion meaningful.
        assert!(!verify_password("wrong", &hash).unwrap_or(false));
    }
}
