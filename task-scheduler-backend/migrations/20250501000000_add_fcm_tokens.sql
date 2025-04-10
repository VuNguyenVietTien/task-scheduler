-- Add FCM tokens column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_tokens JSONB DEFAULT '[]'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Comment for this migration
COMMENT ON COLUMN users.fcm_tokens IS 'Array of FCM tokens for push notification'; 