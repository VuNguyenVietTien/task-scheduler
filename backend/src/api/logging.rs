use actix_web::{web, HttpResponse, Responder};
use log::{error, info};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;
use colored::Colorize;

#[derive(Debug, Deserialize)]
pub struct LogEntry {
    #[serde(rename = "type")]
    entry_type: String,
    timestamp: String,
    details: serde_json::Value,
}

pub fn logging_routes() -> actix_web::Scope {
    web::scope("/logging")
        .route("", web::post().to(log_entry))
}

async fn log_entry(entry: web::Json<LogEntry>) -> impl Responder {
    let request_id = Uuid::new_v4();
    
    // Color-coded logging based on entry type
    let type_colored = match entry.entry_type.as_str() {
        "Request" => entry.entry_type.blue(),
        "Response" => entry.entry_type.green(),
        "Error" => entry.entry_type.red(),
        _ => entry.entry_type.normal(),
    };

    // Format details with proper indentation
    let details_formatted = serde_json::to_string_pretty(&entry.details)
        .unwrap_or_else(|_| "Error formatting details".to_string())
        .split('\n')
        .map(|line| format!("    {}", line))
        .collect::<Vec<_>>()
        .join("\n");
    
    // Format log message with colors and structure
    let log_message = format!(
        "\n{}\n{}\n{}\n{}\n{}\n",
        "=== API Log Entry ===".yellow(),
        format!("ID: {}", request_id.to_string().cyan()),
        format!("Time: {}", entry.timestamp.white()),
        format!("Type: {}", type_colored),
        format!("Details:\n{}", details_formatted.white())
    );

    // Write to terminal
    println!("{}", log_message);

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "request_id": request_id.to_string()
    }))
}
