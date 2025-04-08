-- Update notifications table to add required fields
ALTER TABLE notifications
ADD COLUMN sender_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
ADD COLUMN action VARCHAR(50) NOT NULL DEFAULT 'notification',
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for sender_id
CREATE INDEX idx_notifications_sender ON notifications(sender_id);

-- Create index for is_read
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Create index for created_at
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC); 