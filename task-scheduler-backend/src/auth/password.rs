use bcrypt::{hash, verify, DEFAULT_COST};

pub struct PasswordHasher;

impl PasswordHasher {
    /// Hash a plain text password using bcrypt
    pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
        hash(password, DEFAULT_COST)
    }

    /// Verify a password against its hash
    pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
        verify(password, hash)
    }

    /// Generate a random salt for password hashing
    pub fn generate_salt() -> String {
        // Using DEFAULT_COST ensures consistent salt generation
        bcrypt::gen_salt(DEFAULT_COST)
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

    #[test]
    fn test_salt_generation() {
        let salt1 = PasswordHasher::generate_salt();
        let salt2 = PasswordHasher::generate_salt();
        
        // Ensure different salts are generated each time
        assert_ne!(salt1, salt2);
        
        // Ensure salt is proper bcrypt format
        assert!(salt1.starts_with("$2b$"));
        assert!(salt2.starts_with("$2b$"));
    }
}