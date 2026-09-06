use async_trait::async_trait;
use handlebars::Handlebars;
use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};
use serde::Serialize;
use std::error::Error;

#[async_trait]
pub trait EmailServiceTrait: Send + Sync {
    async fn send_verification_email(
        &self,
        to: String,
        token: String,
        frontend_url: String,
    ) -> Result<(), Box<dyn Error>>;

    async fn send_password_reset(
        &self,
        to: String,
        token: String,
        frontend_url: String,
    ) -> Result<(), Box<dyn Error>>;
}

#[derive(Clone)]
pub struct EmailService {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: String,
    handlebars: Handlebars<'static>,
}

impl EmailService {
    pub fn new(
        smtp_host: String,
        smtp_user: String,
        smtp_pass: String,
        from: String,
    ) -> Result<Self, Box<dyn Error>> {
        let creds = Credentials::new(smtp_user, smtp_pass);

        let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
            .credentials(creds)
            .build();

        let mut handlebars = Handlebars::new();
        handlebars
            .register_template_string("verification", include_str!("templates/verification.hbs"))?;
        handlebars.register_template_string(
            "password_reset",
            include_str!("templates/password_reset.hbs"),
        )?;

        Ok(EmailService {
            transport,
            from,
            handlebars,
        })
    }

    async fn send_email(
        &self,
        to: String,
        subject: String,
        body: String,
    ) -> Result<(), Box<dyn Error>> {
        let email = Message::builder()
            .from(self.from.parse()?)
            .to(to.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body)?;

        self.transport.send(email).await?;

        Ok(())
    }
}

#[derive(Serialize)]
struct VerificationTemplateData {
    verification_link: String,
}

#[derive(Serialize)]
struct PasswordResetTemplateData {
    reset_link: String,
}

#[async_trait]
impl EmailServiceTrait for EmailService {
    async fn send_verification_email(
        &self,
        to: String,
        token: String,
        frontend_url: String,
    ) -> Result<(), Box<dyn Error>> {
        let verification_link = format!("{}/verify-email?token={}", frontend_url, token);
        let data = VerificationTemplateData { verification_link };

        let body = self.handlebars.render("verification", &data)?;
        self.send_email(to, "Verify your email".to_string(), body)
            .await
    }

    async fn send_password_reset(
        &self,
        to: String,
        token: String,
        frontend_url: String,
    ) -> Result<(), Box<dyn Error>> {
        let reset_link = format!("{}/reset-password?token={}", frontend_url, token);
        let data = PasswordResetTemplateData { reset_link };

        let body = self.handlebars.render("password_reset", &data)?;
        self.send_email(to, "Reset your password".to_string(), body)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_send_verification_email() {
        let email_service = EmailService::new(
            "localhost".to_string(),
            "test".to_string(),
            "test".to_string(),
            "noreply@example.com".to_string(),
        )
        .unwrap();

        let result = email_service
            .send_verification_email(
                "test@example.com".to_string(),
                "test-token".to_string(),
                "http://localhost:3000".to_string(),
            )
            .await;

        assert!(result.is_err()); // Will fail since we're not connecting to real SMTP server
    }
}
