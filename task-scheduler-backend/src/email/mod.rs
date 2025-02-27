use lettre::message::{header, MessageBuilder, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Tokio1Executor};
use handlebars::Handlebars;
use serde_json::json;
use std::error::Error;

pub struct EmailService {
    smtp_transport: AsyncSmtpTransport<Tokio1Executor>,
    handlebars: Handlebars<'static>,
    from_email: String,
}

impl EmailService {
    pub fn new(
        smtp_host: String,
        smtp_port: u16,
        smtp_username: String,
        smtp_password: String,
        from_email: String,
    ) -> Result<Self, Box<dyn Error>> {
        let creds = Credentials::new(smtp_username, smtp_password);
        
        let smtp_transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
            .port(smtp_port)
            .credentials(creds)
            .build();

        let mut handlebars = Handlebars::new();
        // Register email templates
        handlebars.register_template_string("verification", include_str!("templates/verification.hbs"))?;
        handlebars.register_template_string("reset_password", include_str!("templates/reset_password.hbs"))?;

        Ok(Self {
            smtp_transport,
            handlebars,
            from_email,
        })
    }

    pub async fn send_verification_email(
        &self,
        to_email: &str,
        name: &str,
        verification_link: &str,
    ) -> Result<(), Box<dyn Error>> {
        let data = json!({
            "name": name,
            "verification_link": verification_link
        });

        let html_body = self.handlebars.render("verification", &data)?;
        let text_body = format!(
            "Welcome {}! Please verify your email by clicking this link: {}",
            name, verification_link
        );

        self.send_email(
            to_email,
            "Verify your email",
            &text_body,
            &html_body,
        ).await
    }

    pub async fn send_password_reset_email(
        &self,
        to_email: &str,
        name: &str,
        reset_link: &str,
    ) -> Result<(), Box<dyn Error>> {
        let data = json!({
            "name": name,
            "reset_link": reset_link
        });

        let html_body = self.handlebars.render("reset_password", &data)?;
        let text_body = format!(
            "Hi {}! Reset your password by clicking this link: {}",
            name, reset_link
        );

        self.send_email(
            to_email,
            "Reset your password",
            &text_body,
            &html_body,
        ).await
    }

    async fn send_email(
        &self,
        to_email: &str,
        subject: &str,
        text_body: &str,
        html_body: &str,
    ) -> Result<(), Box<dyn Error>> {
        let email = MessageBuilder::new()
            .from(self.from_email.parse()?)
            .to(to_email.parse()?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_PLAIN)
                            .body(text_body.to_string())
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_HTML)
                            .body(html_body.to_string())
                    )
            )?;

        self.smtp_transport.send(email).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::*;

    mock! {
        SmtpTransport {}
        #[async_trait]
        impl AsyncTransport for SmtpTransport {
            type Error = Box<dyn Error>;
            async fn send(&self, email: lettre::Message) -> Result<(), Self::Error>;
        }
    }

    #[tokio::test]
    async fn test_send_verification_email() {
        let email_service = EmailService::new(
            "smtp.test.com".to_string(),
            587,
            "test".to_string(),
            "password".to_string(),
            "noreply@test.com".to_string(),
        ).unwrap();

        let result = email_service
            .send_verification_email(
                "test@example.com",
                "Test User",
                "http://localhost:3000/verify?token=123",
            )
            .await;

        assert!(result.is_ok());
    }
}
