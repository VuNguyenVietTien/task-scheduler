pub mod templates;
pub mod sender;

use lettre::message::{header, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{SmtpTransport, Transport};
use crate::error::AppResult;
use crate::config::Config;

#[derive(Debug)]
pub struct EmailContent {
    pub subject: String,
    pub text_content: String,
    pub html_content: String,
}

pub struct EmailSender {
    transport: SmtpTransport,
    from_address: String,
}

impl EmailSender {
    pub fn new(config: &Config) -> AppResult<Self> {
        let creds = Credentials::new(
            config.smtp_username.clone(),
            config.smtp_password.clone(),
        );

        let transport = SmtpTransport::relay(&config.smtp_host)?
            .port(config.smtp_port)
            .credentials(creds)
            .build();

        Ok(Self {
            transport,
            from_address: config.smtp_username.clone(),
        })
    }

    pub async fn send_email(
        &self,
        to_address: &str,
        content: EmailContent,
    ) -> AppResult<()> {
        let email = lettre::Message::builder()
            .from(self.from_address.parse()?)
            .to(to_address.parse()?)
            .subject(content.subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::plain(content.text_content)
                    )
                    .singlepart(
                        SinglePart::html(content.html_content)
                    )
            )?;

        self.transport.send(&email)?;
        
        Ok(())
    }
}

// Email type definitions
#[derive(Debug)]
pub enum EmailType {
    TaskAssigned {
        task_id: uuid::Uuid,
        task_title: String,
        project_name: String,
        assigned_by: String,
    },
    TaskUpdated {
        task_id: uuid::Uuid,
        task_title: String,
        update_type: String,
        updated_by: String,
    },
    CommentAdded {
        task_id: uuid::Uuid,
        task_title: String,
        comment_by: String,
        comment_preview: String,
    },
    ProjectInvitation {
        project_id: uuid::Uuid,
        project_name: String,
        invited_by: String,
        role: String,
    },
    DeadlineReminder {
        task_id: uuid::Uuid,
        task_title: String,
        deadline: chrono::DateTime<chrono::Utc>,
    },
}

// Helper functions for common email operations
pub async fn send_task_notification(
    email_sender: &EmailSender,
    to_address: &str,
    notification_type: EmailType,
) -> AppResult<()> {
    let content = templates::generate_email_content(notification_type)?;
    email_sender.send_email(to_address, content).await
}

pub async fn send_welcome_email(
    email_sender: &EmailSender,
    to_address: &str,
    user_name: &str,
) -> AppResult<()> {
    let content = templates::generate_welcome_email(user_name)?;
    email_sender.send_email(to_address, content).await
}

pub async fn send_password_reset(
    email_sender: &EmailSender,
    to_address: &str,
    reset_token: &str,
) -> AppResult<()> {
    let content = templates::generate_password_reset_email(reset_token)?;
    email_sender.send_email(to_address, content).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    #[tokio::test]
    async fn test_email_sending() {
        let config = Config {
            smtp_host: "smtp.mailtrap.io".to_string(),
            smtp_port: 2525,
            smtp_username: "test".to_string(),
            smtp_password: "test".to_string(),
            ..Default::default()
        };

        let sender = EmailSender::new(&config).unwrap();
        let content = EmailContent {
            subject: "Test Email".to_string(),
            text_content: "Test content".to_string(),
            html_content: "<p>Test content</p>".to_string(),
        };

        let result = sender.send_email("test@example.com", content).await;
        assert!(result.is_ok());
    }
}
