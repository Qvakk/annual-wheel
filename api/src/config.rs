//! # Configuration Module
//!
//! Environment-based configuration for the Annual Wheel API.
//! Supports multiple storage backends and authentication settings.
//!
//! ## Environment Variables
//!
//! ### Storage Configuration
//!
//! **Storage Type Selection:**
//! - `STORAGE_TYPE` - Storage backend: `memory`, `table`, or `cosmosdb` (default: `memory`)
//!
//! **Azure Table Storage:**
//! - `AZURE_STORAGE_ACCOUNT` - Storage account name
//! - `AZURE_STORAGE_ACCESS_KEY` - Storage account access key
//!
//! **Azure Cosmos DB:**
//! - `COSMOS_CONNECTION_STRING` - Full Cosmos DB connection string
//! - `COSMOS_DATABASE` - Database name (default: `arshjul`)
//!
//! ### Authentication
//! - `AZURE_CLIENT_ID` - Azure AD app registration client ID
//! - `AZURE_TENANT_ID` - Azure AD tenant ID (default: `common`)
//!
//! ### Application Settings
//! - `BASE_URL` - Base URL for share links (default: `http://localhost:7071`)
//! - `RUST_LOG` - Log level (default: `info`)

use std::env;
use thiserror::Error;

/// Configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    MissingEnvVar(String),
    
    #[error("Invalid storage type: {0}. Valid options: memory, table, cosmosdb")]
    InvalidStorageType(String),
    
    #[error("Configuration error: {0}")]
    Invalid(String),
}

/// Storage backend type
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StorageType {
    /// In-memory storage (development only)
    Memory,
    /// Azure Table Storage
    TableStorage,
    /// Azure Cosmos DB
    CosmosDb,
}

impl StorageType {
    /// Parse from string
    pub fn from_str(s: &str) -> Result<Self, ConfigError> {
        match s.to_lowercase().as_str() {
            "memory" | "mem" | "inmemory" | "in-memory" => Ok(StorageType::Memory),
            "table" | "tables" | "tablestorage" | "table-storage" | "azuretable" => Ok(StorageType::TableStorage),
            "cosmos" | "cosmosdb" | "cosmos-db" => Ok(StorageType::CosmosDb),
            _ => Err(ConfigError::InvalidStorageType(s.to_string())),
        }
    }
}

impl Default for StorageType {
    fn default() -> Self {
        StorageType::Memory
    }
}

/// Azure Table Storage configuration
#[derive(Debug, Clone)]
pub struct TableStorageConfig {
    /// Storage account name
    pub account_name: String,
    /// Storage account access key (optional - use Managed Identity if not provided)
    pub access_key: Option<String>,
}

/// Azure Cosmos DB configuration
#[derive(Debug, Clone)]
pub struct CosmosDbConfig {
    /// Cosmos DB endpoint URL (e.g., "https://myaccount.documents.azure.com")
    pub endpoint: String,
    /// Database name
    pub database_name: String,
    /// Primary key (optional - use Managed Identity if not provided)
    pub primary_key: Option<String>,
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Azure AD client ID (audience)
    pub client_id: String,
    /// Azure AD tenant ID
    pub tenant_id: String,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            client_id: String::new(),
            tenant_id: "common".to_string(),
        }
    }
}

/// Application configuration
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// Storage type to use
    pub storage_type: StorageType,
    /// Table Storage configuration (when storage_type is TableStorage)
    pub table_storage: Option<TableStorageConfig>,
    /// Cosmos DB configuration (when storage_type is CosmosDb)
    pub cosmos_db: Option<CosmosDbConfig>,
    /// Authentication configuration
    pub auth: AuthConfig,
    /// Base URL for share links
    pub base_url: String,
}

impl AppConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        // Determine storage type
        let storage_type = env::var("STORAGE_TYPE")
            .map(|s| StorageType::from_str(&s))
            .unwrap_or(Ok(StorageType::Memory))?;
        
        // Load storage-specific configuration
        let (table_storage, cosmos_db) = match storage_type {
            StorageType::Memory => (None, None),
            
            StorageType::TableStorage => {
                let account_name = env::var("AZURE_STORAGE_ACCOUNT")
                    .map_err(|_| ConfigError::MissingEnvVar("AZURE_STORAGE_ACCOUNT".to_string()))?;
                // Access key is now optional - prefer Managed Identity
                let access_key = env::var("AZURE_STORAGE_ACCESS_KEY").ok();
                
                if access_key.is_none() {
                    tracing::info!("No AZURE_STORAGE_ACCESS_KEY found - will use Managed Identity for Table Storage");
                }
                
                (Some(TableStorageConfig { account_name, access_key }), None)
            }
            
            StorageType::CosmosDb => {
                let endpoint = env::var("COSMOS_ENDPOINT")
                    .map_err(|_| ConfigError::MissingEnvVar("COSMOS_ENDPOINT".to_string()))?;
                let database_name = env::var("COSMOS_DATABASE")
                    .unwrap_or_else(|_| "arshjul".to_string());
                // Primary key is optional - prefer Managed Identity
                let primary_key = env::var("COSMOS_PRIMARY_KEY").ok();
                
                if primary_key.is_none() {
                    tracing::info!("No COSMOS_PRIMARY_KEY found - will use Managed Identity for Cosmos DB");
                }
                
                (None, Some(CosmosDbConfig { endpoint, database_name, primary_key }))
            }
        };
        
        // Load auth configuration
        let auth = AuthConfig {
            client_id: env::var("AZURE_CLIENT_ID")
                .unwrap_or_else(|_| String::new()),
            tenant_id: env::var("AZURE_TENANT_ID")
                .unwrap_or_else(|_| "common".to_string()),
        };
        
        // Load app configuration
        let base_url = env::var("BASE_URL")
            .unwrap_or_else(|_| "http://localhost:7071".to_string());
        
        Ok(Self {
            storage_type,
            table_storage,
            cosmos_db,
            auth,
            base_url,
        })
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        match self.storage_type {
            StorageType::Memory => Ok(()),
            
            StorageType::TableStorage => {
                if self.table_storage.is_none() {
                    return Err(ConfigError::Invalid(
                        "Table Storage selected but configuration is missing".to_string()
                    ));
                }
                Ok(())
            }
            
            StorageType::CosmosDb => {
                if self.cosmos_db.is_none() {
                    return Err(ConfigError::Invalid(
                        "Cosmos DB selected but configuration is missing".to_string()
                    ));
                }
                Ok(())
            }
        }
    }
    
    /// Get storage type display name
    pub fn storage_display_name(&self) -> &'static str {
        match self.storage_type {
            StorageType::Memory => "In-Memory (development)",
            StorageType::TableStorage => "Azure Table Storage",
            StorageType::CosmosDb => "Azure Cosmos DB",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_storage_type_parsing() {
        assert_eq!(StorageType::from_str("memory").unwrap(), StorageType::Memory);
        assert_eq!(StorageType::from_str("table").unwrap(), StorageType::TableStorage);
        assert_eq!(StorageType::from_str("cosmosdb").unwrap(), StorageType::CosmosDb);
        assert_eq!(StorageType::from_str("cosmos-db").unwrap(), StorageType::CosmosDb);
        assert!(StorageType::from_str("invalid").is_err());
    }
}
