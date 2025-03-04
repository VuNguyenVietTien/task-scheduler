CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    -- Add index for faster querying by task
    INDEX comments_task_id_idx (task_id),
    -- Add index for faster querying by user
    INDEX comments_user_id_idx (user_id),
    -- Add index for faster querying by parent
    INDEX comments_parent_id_idx (parent_comment_id)
);