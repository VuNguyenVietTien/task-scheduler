use bcrypt::{hash, verify, DEFAULT_COST};

#[allow(dead_code)]
pub struct PasswordHasher;

#[allow(dead_code)]
impl PasswordHasher {
    /// Hash a plain text password using bcrypt
    pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
        hash(password, DEFAULT_COST)
    }

    /// Verify a password against its hash
    pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
        verify(password, hash)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing() {
        let password = "test_password";
        let hashed = PasswordHasher::hash_password(password).unwrap();
        
        // Ensure hash is different from original password
        assert_ne!(password, hashed);
        
        // Verify correct password
        let valid = PasswordHasher::verify_password(password, &hashed).unwrap();
        assert!(valid);
        
        // Verify incorrect password
        let invalid = PasswordHasher::verify_password("wrong_password", &hashed).unwrap();
        assert!(!invalid);
    }
}
