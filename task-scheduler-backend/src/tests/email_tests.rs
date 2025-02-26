use super::helpers::*;
use crate::{
    config::Config,
    email::{EmailContent, EmailSender, EmailType, templates},
};
use chrono::Utc;
use uuid::Uuid;

#[tokio::test]
async fn test_task_assigned_email_template() {
    let email_type = EmailType::TaskAssigned {
        task_id: Uuid::new_v4(),
        task_title: "Test Task".to_string(),
        project_name: "Test Project".to_string(),
        assigned_by: "John Doe".to_string(),
    };

    let content = templates::generate_email_content(email_type).unwrap();
    
    assert!(content.subject.contains("Test Task"));
    assert!(content.text_content.contains("Test Project"));
    assert!(content.html_content.contains("John Doe"));
    assert!(content.html_content.contains("New Task Assignment"));
}

#[tokio::test]
async fn test_task_updated_email_template() {
    let email_type = EmailType::TaskUpdated {
        task_id: Uuid::new_v4(),
        task_title: "Test Task".to_string(),
        update_type: "status changed".to_string(),
        updated_by: "John Doe".to_string(),
    };

    let content = templates::generate_email_content(email_type).unwrap();
    
    assert!(content.subject.contains("Test Task"));
    assert!(content.text_content.contains("status changed"));
    assert!(content.html_content.contains("John Doe"));
}

#[tokio::test]
async fn test_comment_added_email_template() {
    let email_type = EmailType::CommentAdded {
        task_id: Uuid::new_v4(),
        task_title: "Test Task".to_string(),
        comment_by: "John Doe".to_string(),
        comment_preview: "Test comment content".to_string(),
    };

    let content = templates::generate_email_content(email_type).unwrap();
    
    assert!(content.subject.contains("Test Task"));
    assert!(content.text_content.contains("Test comment content"));
    assert!(content.html_content.contains("John Doe"));
}

#[tokio::test]
async fn test_project_invitation_email_template() {
    let email_type = EmailType::ProjectInvitation {
        project_id: Uuid::new_v4(),
        project_name: "Test Project".to_string(),
        invited_by: "John Doe".to_string(),
        role: "Editor".to_string(),
    };

    let content = templates::generate_email_content(email_type).unwrap();
    
    assert!(content.subject.contains("Test Project"));
    assert!(content.text_content.contains("Editor"));
    assert!(content.html_content.contains("John Doe"));
}

#[tokio::test]
async fn test_deadline_reminder_email_template() {
    let email_type = EmailType::DeadlineReminder {
        task_id: Uuid::new_v4(),
        task_title: "Test Task".to_string(),
        deadline: Utc::now(),
    };

    let content = templates::generate_email_content(email_type).unwrap();
    
    assert!(content.subject.contains("Test Task"));
    assert!(content.text_content.contains("due on"));
    assert!(content.html_content.contains("Deadline Reminder"));
}

#[tokio::test]
async fn test_welcome_email_template() {
    let content = templates::generate_welcome_email("John Doe").unwrap();
    
    assert_eq!(content.subject, "Welcome to Task Scheduler!");
    assert!(content.text_content.contains("John Doe"));
    assert!(content.html_content.contains("Get Started"));
}

#[tokio::test]
async fn test_password_reset_email_template() {
    let reset_token = "test-reset-token";
    let content = templates::generate_password_reset_email(reset_token).unwrap();
    
    assert_eq!(content.subject, "Password Reset Request");
    assert!(content.text_content.contains(reset_token));
    assert!(content.html_content.contains("Reset Password"));
}

#[tokio::test]
async fn test_email_sender_creation() {
    let config = Config {
        smtp_host: "smtp.test.com".to_string(),
        smtp_port: 587,
        smtp_username: "test@test.com".to_string(),
        smtp_password: "password".to_string(),
        ..Default::default()
    };

    let sender = EmailSender::new(&config);
    assert!(sender.is_ok());
}

#[test]
fn test_email_content_creation() {
    let content = EmailContent {
        subject: "Test Subject".to_string(),
        text_content: "Test content".to_string(),
        html_content: "<p>Test content</p>".to_string(),
    };

    assert_eq!(content.subject, "Test Subject");
    assert_eq!(content.text_content, "Test content");
    assert_eq!(content.html_content, "<p>Test content</p>");
}

// Mock tests that simulate sending emails
#[cfg(test)]
mod mock_tests {
    use super::*;
    use mockall::mock;
    use mockall::predicate::*;

    mock! {
        EmailSender {
            fn send_email(&self, to: &str, content: EmailContent) -> Result<(), Box<dyn std::error::Error>>;
        }
    }

    #[tokio::test]
    async fn test_mock_email_sending() {
        let mut mock_sender = MockEmailSender::new();
        mock_sender
            .expect_send_email()
            .with(
                eq("test@example.com"),
                predicate::function(|content: &EmailContent| {
                    content.subject == "Test Subject"
                }),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let content = EmailContent {
            subject: "Test Subject".to_string(),
            text_content: "Test content".to_string(),
            html_content: "<p>Test content</p>".to_string(),
        };

        let result = mock_sender.send_email("test@example.com", content);
        assert!(result.is_ok());
    }
}
