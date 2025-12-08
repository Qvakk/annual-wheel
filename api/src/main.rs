//! # Azure Functions Entry Point
//!
//! Main entry point for the Annual Wheel API deployed as Azure Functions.
//!
//! ## Deployment Options
//!
//! 1. **Azure Functions (Consumption)** - Pay per execution, auto-scale
//! 2. **Azure Functions (Premium)** - Pre-warmed instances, VNet support
//! 3. **Azure Container Apps** - Containerized deployment
//!
//! ## Environment Variables
//!
//! Required:
//! - `AZURE_STORAGE_CONNECTION_STRING` - Table Storage connection
//! - `AZURE_CLIENT_ID` - Azure AD app registration client ID
//!
//! Optional:
//! - `BASE_URL` - Base URL for share links (defaults to function app URL)
//! - `COSMOS_CONNECTION_STRING` - For Cosmos DB (future upgrade)

use arshjul_api::{
    auth::{TokenValidator, TokenValidatorConfig},
    handlers::{self, HandlerContext},
    storage::memory_storage::MemoryShareStorage,
};
use std::sync::Arc;

// For now, we use a simple HTTP server for local development
// In production, this would be Azure Functions bindings

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Get configuration from environment
    let base_url = std::env::var("BASE_URL")
        .unwrap_or_else(|_| "http://localhost:7071".to_string());
    
    let client_id = std::env::var("AZURE_CLIENT_ID")
        .unwrap_or_else(|_| "your-client-id".to_string());
    
    // Initialize storage (using in-memory for development)
    // In production, use Azure Table Storage or Cosmos DB
    let share_storage = Arc::new(MemoryShareStorage::new());
    
    // TODO: Initialize activity and layer storage
    // For now, we only have share storage implemented
    
    // Initialize token validator
    let token_validator = TokenValidator::new(TokenValidatorConfig {
        audience: client_id,
        ..Default::default()
    });
    
    tracing::info!("Annual Wheel API starting...");
    tracing::info!("Base URL: {}", base_url);
    
    // In a real Azure Functions deployment, the runtime handles HTTP routing
    // For local development, you could add a simple HTTP server here
    
    println!("🌟 Annual Wheel API");
    println!("==================");
    println!("Storage: In-Memory (development)");
    println!("Base URL: {}", base_url);
    println!();
    println!("API Endpoints:");
    println!("  POST   /api/shares              - Create share");
    println!("  GET    /api/shares              - List shares");
    println!("  GET    /api/shares/{{id}}         - Get share");
    println!("  DELETE /api/shares/{{id}}         - Delete share");
    println!("  POST   /api/shares/{{id}}/renew   - Renew share");
    println!("  GET    /api/public/s/{{code}}     - Access public share");
    println!();
    println!("For Azure Functions deployment, configure function.json bindings.");
    
    Ok(())
}
