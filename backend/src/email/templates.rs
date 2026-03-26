use crate::error::AppResult;
use super::{EmailContent, EmailType};

pub fn generate_email_content(email_type: EmailType) -> AppResult<EmailContent> {
    match email_type {
        EmailType::TaskAssigned {
            task_id,
            task_title,
            project_name,
            assigned_by,
        } => {
            let subject = format!("New Task Assignment: {}", task_title);
            let text_content = format!(
                "You have been assigned to task '{}' in project '{}' by {}.\n\nView task: /tasks/{}",
                task_title, project_name, assigned_by, task_id
            );
            let html_content = format!(
                r#"
                <div style="font-family: Arial, sans-serif;">
                    <h2>New Task Assignment</h2>
                    <p>You have been assigned to task <strong>{}</strong> in project <strong>{}</strong> by {}.</p>
                    <p>
                        <a href="/tasks/{}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            View Task
                        </a>
                    </p>
                </div>
                "#,
                task_title, project_name, assigned_by, task_id
            );

            Ok(EmailContent {
                subject,
                text_content,
                html_content,
            })
        }

        EmailType::TaskUpdated {
            task_id,
            task_title,
            update_type,
            updated_by,
        } => {
            let subject = format!("Task Updated: {}", task_title);
            let text_content = format!(
                "Task '{}' has been updated by {}. Update type: {}\n\nView task: /tasks/{}",
                task_title, updated_by, update_type, task_id
            );
            let html_content = format!(
                r#"
                <div style="font-family: Arial, sans-serif;">
                    <h2>Task Update</h2>
                    <p>Task <strong>{}</strong> has been updated by {}.</p>
                    <p>Update type: <strong>{}</strong></p>
                    <p>
                        <a href="/tasks/{}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            View Task
                        </a>
                    </p>
                </div>
                "#,
                task_title, updated_by, update_type, task_id
            );

            Ok(EmailContent {
                subject,
                text_content,
                html_content,
            })
        }

        EmailType::CommentAdded {
            task_id,
            task_title,
            comment_by,
            comment_preview,
        } => {
            let subject = format!("New Comment on Task: {}", task_title);
            let text_content = format!(
                "{} commented on task '{}':\n\n{}\n\nView task: /tasks/{}",
                comment_by, task_title, comment_preview, task_id
            );
            let html_content = format!(
                r#"
                <div style="font-family: Arial, sans-serif;">
                    <h2>New Comment</h2>
                    <p><strong>{}</strong> commented on task <strong>{}</strong>:</p>
                    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0066cc;">
                        {}
                    </div>
                    <p>
                        <a href="/tasks/{}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            View Task
                        </a>
                    </p>
                </div>
                "#,
                comment_by, task_title, comment_preview, task_id
            );

            Ok(EmailContent {
                subject,
                text_content,
                html_content,
            })
        }

        EmailType::ProjectInvitation {
            project_id,
            project_name,
            invited_by,
            role,
        } => {
            let subject = format!("Invitation to Project: {}", project_name);
            let text_content = format!(
                "You have been invited by {} to join project '{}' as {}.\n\nAccept invitation: /projects/{}",
                invited_by, project_name, role, project_id
            );
            let html_content = format!(
                r#"
                <div style="font-family: Arial, sans-serif;">
                    <h2>Project Invitation</h2>
                    <p>You have been invited by <strong>{}</strong> to join project <strong>{}</strong> as {}.</p>
                    <p>
                        <a href="/projects/{}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Accept Invitation
                        </a>
                    </p>
                </div>
                "#,
                invited_by, project_name, role, project_id
            );

            Ok(EmailContent {
                subject,
                text_content,
                html_content,
            })
        }

        EmailType::DeadlineReminder {
            task_id,
            task_title,
            deadline,
        } => {
            let formatted_deadline = deadline.format("%B %d, %Y at %H:%M");
            let subject = format!("Deadline Reminder: {}", task_title);
            let text_content = format!(
                "Reminder: Task '{}' is due on {}.\n\nView task: /tasks/{}",
                task_title, formatted_deadline, task_id
            );
            let html_content = format!(
                r#"
                <div style="font-family: Arial, sans-serif;">
                    <h2>Deadline Reminder</h2>
                    <p>Task <strong>{}</strong> is due on <strong>{}</strong>.</p>
                    <p>
                        <a href="/tasks/{}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            View Task
                        </a>
                    </p>
                </div>
                "#,
                task_title, formatted_deadline, task_id
            );

            Ok(EmailContent {
                subject,
                text_content,
                html_content,
            })
        }
    }
}

pub fn generate_welcome_email(user_name: &str) -> AppResult<EmailContent> {
    let subject = "Welcome to Task Scheduler!".to_string();
    let text_content = format!(
        "Welcome to Task Scheduler, {}!\n\nGet started by creating your first project or joining an existing one.",
        user_name
    );
    let html_content = format!(
        r#"
        <div style="font-family: Arial, sans-serif;">
            <h1>Welcome to Task Scheduler!</h1>
            <p>Hello {},</p>
            <p>Thank you for joining Task Scheduler. We're excited to help you manage your projects and tasks more efficiently.</p>
            <h2>Get Started:</h2>
            <ul>
                <li>Create your first project</li>
                <li>Invite team members</li>
                <li>Set up your first task</li>
            </ul>
            <p>
                <a href="/dashboard" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Go to Dashboard
                </a>
            </p>
        </div>
        "#,
        user_name
    );

    Ok(EmailContent {
        subject,
        text_content,
        html_content,
    })
}

pub fn generate_password_reset_email(reset_token: &str) -> AppResult<EmailContent> {
    let subject = "Password Reset Request".to_string();
    let text_content = format!(
        "You have requested to reset your password.\n\nClick the following link to reset your password: /reset-password?token={}",
        reset_token
    );
    let html_content = format!(
        r#"
        <div style="font-family: Arial, sans-serif;">
            <h2>Password Reset Request</h2>
            <p>You have requested to reset your password. Click the button below to proceed:</p>
            <p>
                <a href="/reset-password?token={}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Reset Password
                </a>
            </p>
            <p style="color: #666; font-size: 0.9em;">
                If you didn't request this password reset, please ignore this email.
            </p>
        </div>
        "#,
        reset_token
    );

    Ok(EmailContent {
        subject,
        text_content,
        html_content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_task_assigned_email() {
        let email_type = EmailType::TaskAssigned {
            task_id: Uuid::new_v4(),
            task_title: "Test Task".to_string(),
            project_name: "Test Project".to_string(),
            assigned_by: "John Doe".to_string(),
        };

        let content = generate_email_content(email_type).unwrap();
        assert!(content.subject.contains("Test Task"));
        assert!(content.text_content.contains("Test Project"));
        assert!(content.html_content.contains("John Doe"));
    }

    #[test]
    fn test_welcome_email() {
        let content = generate_welcome_email("John Doe").unwrap();
        assert_eq!(content.subject, "Welcome to Task Scheduler!");
        assert!(content.text_content.contains("John Doe"));
        assert!(content.html_content.contains("Get Started"));
    }
}
