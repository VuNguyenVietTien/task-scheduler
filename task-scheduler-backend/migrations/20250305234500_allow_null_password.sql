-- Make password_hash nullable for social login users
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- Add index on firebase_uid for better query performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);