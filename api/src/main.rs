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
//! ### Storage Configuration
//! - `STORAGE_TYPE` - Storage backend: `memory`, `table`, or `cosmosdb` (default: `memory`)
//!
//! **For Azure Table Storage:**
//! - `AZURE_STORAGE_ACCOUNT` - Storage account name
//! - `AZURE_STORAGE_ACCESS_KEY` - Storage account access key
//!
//! **For Azure Cosmos DB:**
//! - `COSMOS_CONNECTION_STRING` - Full Cosmos DB connection string
//! - `COSMOS_DATABASE` - Database name (default: `arshjul`)
//!
//! ### Authentication
//! - `AZURE_CLIENT_ID` - Azure AD app registration client ID
//! - `AZURE_TENANT_ID` - Azure AD tenant ID (optional)
//!
//! ### Application
//! - `BASE_URL` - Base URL for share links (defaults to function app URL)

use arshjul_api::{
    auth::{TokenValidator, TokenValidatorConfig},
    config::{AppConfig, StorageType},
    storage::memory_storage::MemoryShareStorage,
    storage::table_storage::TableStorageClient,
    storage::cosmos_storage::CosmosStorageClient,
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
    
    // Load configuration from environment
    let config = AppConfig::from_env()?;
    config.validate()?;
    
    // Initialize storage based on configuration
    // This will create tables/containers if they don't exist
    let _share_storage: Arc<dyn arshjul_api::storage::ShareStorage> = match config.storage_type {
        StorageType::Memory => {
            tracing::info!("Using in-memory storage (development mode)");
            Arc::new(MemoryShareStorage::new())
        }
        StorageType::TableStorage => {
            let table_config = config.table_storage.as_ref().unwrap();
            tracing::info!("Initializing Azure Table Storage: {}", table_config.account_name);
            tracing::info!("Tables to create if missing: {:?}", TableStorageClient::table_names());
            
            // Initialize Table Storage client
            // Use Managed Identity if no access key provided, otherwise use access key
            let _table_client = if let Some(ref access_key) = table_config.access_key {
                tracing::info!("Using access key authentication");
                TableStorageClient::new_with_access_key(
                    &table_config.account_name,
                    access_key,
                ).await?
            } else {
                tracing::info!("Using Managed Identity authentication");
                TableStorageClient::new_with_managed_identity(
                    &table_config.account_name,
                ).await?
            };
            
            // TODO: Implement ShareStorage trait for TableStorageClient
            // For now, fall back to memory storage for the share operations
            tracing::warn!("Table Storage trait implementation pending, using in-memory for operations");
            Arc::new(MemoryShareStorage::new())
        }
        StorageType::CosmosDb => {
            let cosmos_config = config.cosmos_db.as_ref().unwrap();
            tracing::info!("Initializing Azure Cosmos DB: endpoint={}, database={}", 
                cosmos_config.endpoint, cosmos_config.database_name);
            tracing::info!("Containers to create if missing: {:?}", CosmosStorageClient::container_names());
            
            // Initialize Cosmos DB client
            // Use primary key if provided, otherwise error (Managed Identity requires SDK version alignment)
            let _cosmos_client = if let Some(ref primary_key) = cosmos_config.primary_key {
                tracing::info!("Using primary key authentication");
                CosmosStorageClient::new_with_key(
                    &cosmos_config.endpoint,
                    &cosmos_config.database_name,
                    primary_key,
                ).await?
            } else {
                // For Managed Identity with Cosmos DB, recommend using Table Storage instead
                // or configuring Easy Auth at the Azure Functions level
                tracing::warn!("Cosmos DB Managed Identity not available - use COSMOS_PRIMARY_KEY or switch to Table Storage");
                return Err(anyhow::anyhow!(
                    "Cosmos DB requires COSMOS_PRIMARY_KEY. For Managed Identity, use Table Storage (STORAGE_TYPE=table)."
                ));
            };
            
            // TODO: Implement ShareStorage trait for CosmosStorageClient
            // For now, fall back to memory storage for the share operations
            tracing::warn!("Cosmos DB trait implementation pending, using in-memory for operations");
            Arc::new(MemoryShareStorage::new())
        }
    };
    
    // TODO: Initialize activity and layer storage
    // For now, we only have share storage implemented
    
    // Initialize token validator
    let _token_validator = TokenValidator::new(TokenValidatorConfig {
        audience: config.auth.client_id.clone(),
        ..Default::default()
    });
    
    tracing::info!("Annual Wheel API starting...");
    tracing::info!("Base URL: {}", config.base_url);
    
    // In a real Azure Functions deployment, the runtime handles HTTP routing
    // For local development, you could add a simple HTTP server here
    
    println!("🌟 Annual Wheel API");
    println!("==================");
    println!("Storage: {}", config.storage_display_name());
    println!("Base URL: {}", config.base_url);
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
