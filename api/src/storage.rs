//! # Storage Abstraction Layer
//!
//! Provides a unified interface for data storage that works with both:
//! - Azure Table Storage (default, simple, cheap)
//! - Azure Cosmos DB (future upgrade path)
//!
//! ## Design Principles
//!
//! 1. **Partition Key = organizationId**: Multi-tenant isolation
//! 2. **Row Key = id**: Unique identifier per entity
//! 3. **TTL Support**: For automatic expiration (Cosmos DB native, manual check for Table Storage)

use crate::models::*;
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;
use thiserror::Error;

/// Storage errors
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Entity not found: {0}")]
    NotFound(String),
    
    #[error("Entity already exists: {0}")]
    AlreadyExists(String),
    
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Storage error: {0}")]
    Storage(String),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
}

/// Query options for listing entities
#[derive(Debug, Clone, Default)]
pub struct QueryOptions {
    /// Maximum number of results
    pub page_size: Option<u32>,
    /// Continuation token for pagination
    pub continuation_token: Option<String>,
    /// Filter expression (OData for Table Storage, SQL for Cosmos DB)
    pub filter: Option<String>,
}

/// Query result with pagination
#[derive(Debug, Clone)]
pub struct QueryResult<T> {
    pub items: Vec<T>,
    pub continuation_token: Option<String>,
    pub total_count: Option<u64>,
}

/// Storage trait for shares
#[async_trait]
pub trait ShareStorage: Send + Sync {
    /// Create a new share
    async fn create(&self, share: ShareLink) -> Result<ShareLink, StorageError>;
    
    /// Get share by ID
    async fn get(&self, organization_id: &str, share_id: &str) -> Result<ShareLink, StorageError>;
    
    /// Get share by short code (for public access)
    async fn get_by_short_code(&self, short_code: &str) -> Result<ShareLink, StorageError>;
    
    /// Update share
    async fn update(&self, share: ShareLink) -> Result<ShareLink, StorageError>;
    
    /// Delete share
    async fn delete(&self, organization_id: &str, share_id: &str) -> Result<(), StorageError>;
    
    /// List shares for organization
    async fn list(
        &self,
        organization_id: &str,
        options: QueryOptions,
    ) -> Result<QueryResult<ShareLink>, StorageError>;
    
    /// Increment view count (atomic)
    async fn increment_views(&self, organization_id: &str, share_id: &str) -> Result<(), StorageError>;
}

/// Storage trait for activities
#[async_trait]
pub trait ActivityStorage: Send + Sync {
    /// Create activity
    async fn create(&self, activity: Activity) -> Result<Activity, StorageError>;
    
    /// Get activity by ID
    async fn get(&self, organization_id: &str, activity_id: &str) -> Result<Activity, StorageError>;
    
    /// Update activity
    async fn update(&self, activity: Activity) -> Result<Activity, StorageError>;
    
    /// Delete activity
    async fn delete(&self, organization_id: &str, activity_id: &str) -> Result<(), StorageError>;
    
    /// List activities for organization
    async fn list(
        &self,
        organization_id: &str,
        options: QueryOptions,
    ) -> Result<QueryResult<Activity>, StorageError>;
    
    /// List activities for specific layers
    async fn list_by_layers(
        &self,
        organization_id: &str,
        layer_ids: &[String],
        year: Option<i32>,
    ) -> Result<Vec<Activity>, StorageError>;
}

/// Storage trait for layers
#[async_trait]
pub trait LayerStorage: Send + Sync {
    /// Create layer
    async fn create(&self, layer: Layer) -> Result<Layer, StorageError>;
    
    /// Get layer by ID
    async fn get(&self, organization_id: &str, layer_id: &str) -> Result<Layer, StorageError>;
    
    /// Update layer
    async fn update(&self, layer: Layer) -> Result<Layer, StorageError>;
    
    /// Delete layer
    async fn delete(&self, organization_id: &str, layer_id: &str) -> Result<(), StorageError>;
    
    /// List layers for organization
    async fn list(&self, organization_id: &str) -> Result<Vec<Layer>, StorageError>;
}

/// Storage trait for activity type configs
/// Storage trait for activity type configs
#[async_trait]
pub trait ActivityTypeStorage: Send + Sync {
    /// Create or update activity type
    async fn upsert(&self, config: ActivityTypeConfig) -> Result<ActivityTypeConfig, StorageError>;
    
    /// Get activity type by key
    async fn get(&self, organization_id: &str, key: &str) -> Result<ActivityTypeConfig, StorageError>;
    
    /// Delete activity type
    async fn delete(&self, organization_id: &str, key: &str) -> Result<(), StorageError>;
    
    /// List activity types for organization
    async fn list(&self, organization_id: &str) -> Result<Vec<ActivityTypeConfig>, StorageError>;
}

/// Storage trait for user settings
#[async_trait]
pub trait UserSettingsStorage: Send + Sync {
    /// Get user settings (returns default if not found)
    async fn get(&self, organization_id: &str, user_id: &str) -> Result<UserSettings, StorageError>;
    
    /// Create or update user settings
    async fn upsert(&self, settings: UserSettings) -> Result<UserSettings, StorageError>;
    
    /// Delete user settings
    async fn delete(&self, organization_id: &str, user_id: &str) -> Result<(), StorageError>;
}

/// Combined storage interface
pub struct Storage {
    pub shares: Arc<dyn ShareStorage>,
    pub activities: Arc<dyn ActivityStorage>,
    pub layers: Arc<dyn LayerStorage>,
    pub activity_types: Arc<dyn ActivityTypeStorage>,
    pub user_settings: Arc<dyn UserSettingsStorage>,
}

// ============================================
// Table Storage Implementation
// ============================================

pub mod table_storage {
    use super::*;
    use azure_data_tables::prelude::*;
    use azure_storage::prelude::*;
    use serde::{Deserialize, Serialize};
    
    /// Table Storage entity wrapper
    /// Stores complex types as JSON strings
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TableEntity {
        #[serde(rename = "PartitionKey")]
        pub partition_key: String,
        
        #[serde(rename = "RowKey")]
        pub row_key: String,
        
        /// JSON-serialized data
        pub data: String,
        
        /// Entity type for type safety
        pub entity_type: String,
        
        /// Secondary index: short_code for shares
        #[serde(skip_serializing_if = "Option::is_none")]
        pub short_code: Option<String>,
        
        /// Expiration timestamp (for manual TTL check)
        #[serde(skip_serializing_if = "Option::is_none")]
        pub expires_at: Option<String>,
        
        /// Is active flag for quick filtering
        #[serde(skip_serializing_if = "Option::is_none")]
        pub is_active: Option<bool>,
    }
    
    impl TableEntity {
        pub fn from_share(share: &ShareLink) -> Result<Self, StorageError> {
            let data = serde_json::to_string(share)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;
            
            Ok(Self {
                partition_key: share.organization_id.clone(),
                row_key: share.id.clone(),
                data,
                entity_type: "share".to_string(),
                short_code: Some(share.short_code.clone()),
                expires_at: Some(share.expires_at.to_rfc3339()),
                is_active: Some(share.is_active),
            })
        }
        
        pub fn to_share(&self) -> Result<ShareLink, StorageError> {
            serde_json::from_str(&self.data)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }
        
        pub fn from_activity(activity: &Activity) -> Result<Self, StorageError> {
            let data = serde_json::to_string(activity)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;
            
            Ok(Self {
                partition_key: activity.organization_id.clone(),
                row_key: activity.id.clone(),
                data,
                entity_type: "activity".to_string(),
                short_code: None,
                expires_at: None,
                is_active: None,
            })
        }
        
        pub fn to_activity(&self) -> Result<Activity, StorageError> {
            serde_json::from_str(&self.data)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }
        
        pub fn from_layer(layer: &Layer) -> Result<Self, StorageError> {
            let data = serde_json::to_string(layer)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;
            
            Ok(Self {
                partition_key: layer.organization_id.clone(),
                row_key: layer.id.clone(),
                data,
                entity_type: "layer".to_string(),
                short_code: None,
                expires_at: None,
                is_active: Some(layer.is_visible),
            })
        }
        
        pub fn to_layer(&self) -> Result<Layer, StorageError> {
            serde_json::from_str(&self.data)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }
        
        pub fn from_activity_type(config: &ActivityTypeConfig) -> Result<Self, StorageError> {
            let data = serde_json::to_string(config)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;
            
            Ok(Self {
                partition_key: config.organization_id.clone(),
                row_key: config.key.clone(),
                data,
                entity_type: "activity_type".to_string(),
                short_code: None,
                expires_at: None,
                is_active: None,
            })
        }
        
        pub fn to_activity_type(&self) -> Result<ActivityTypeConfig, StorageError> {
            serde_json::from_str(&self.data)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }
    }
    
    /// Azure Table Storage client wrapper
    #[allow(dead_code)]
    pub struct TableStorageClient {
        shares_table: TableClient,
        activities_table: TableClient,
        layers_table: TableClient,
        activity_types_table: TableClient,
        /// Secondary index table for short_code lookups
        short_codes_table: TableClient,
    }
    
    impl TableStorageClient {
        /// Table names used by the application
        const TABLE_NAMES: [&'static str; 5] = ["shares", "activities", "layers", "activitytypes", "shortcodes"];
        
        /// Create using Managed Identity authentication (recommended for Azure)
        /// Creates all required tables if they don't exist
        /// 
        /// # Arguments
        /// * `account_name` - Storage account name (same account as Function App)
        /// 
        /// # Authentication
        /// Uses DefaultAzureCredential which supports:
        /// - Managed Identity (in Azure - App Service, Functions, AKS, VMs)
        /// - Azure CLI credentials (for local development with `az login`)
        /// - Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
        pub async fn new_with_managed_identity(account_name: impl Into<String>) -> Result<Self, StorageError> {
            let account_name = account_name.into();
            
            tracing::info!("Connecting to Azure Table Storage account: {} using Managed Identity", account_name);
            
            // Create DefaultAzureCredential for Managed Identity / Azure CLI authentication
            let credential = azure_identity::create_credential()
                .map_err(|e| StorageError::Storage(format!("Failed to create Azure credential: {}", e)))?;
            
            // Create storage credentials from token credential
            let storage_credentials = StorageCredentials::token_credential(credential);
            let service_client = TableServiceClient::new(&account_name, storage_credentials);
            
            Self::initialize_tables(service_client, &account_name).await
        }
        
        /// Create from account name and access key (legacy method, not recommended)
        /// Creates all required tables if they don't exist
        #[allow(dead_code)]
        pub async fn new_with_access_key(account_name: impl Into<String>, access_key: impl Into<String>) -> Result<Self, StorageError> {
            let account_name = account_name.into();
            let access_key = access_key.into();
            
            tracing::warn!("Using access key authentication for Table Storage - consider switching to Managed Identity");
            
            let storage_credentials = StorageCredentials::access_key(account_name.clone(), access_key);
            let service_client = TableServiceClient::new(&account_name, storage_credentials);
            
            Self::initialize_tables(service_client, &account_name).await
        }
        
        /// Legacy constructor for backward compatibility
        /// Delegates to new_with_access_key
        pub async fn new(account_name: impl Into<String>, access_key: impl Into<String>) -> Result<Self, StorageError> {
            Self::new_with_access_key(account_name, access_key).await
        }
        
        /// Initialize tables from a service client
        async fn initialize_tables(service_client: TableServiceClient, account_name: &str) -> Result<Self, StorageError> {
            tracing::info!("Initializing Azure Table Storage for account: {}", account_name);
            
            // Create table clients
            let shares_table = service_client.table_client("shares");
            let activities_table = service_client.table_client("activities");
            let layers_table = service_client.table_client("layers");
            let activity_types_table = service_client.table_client("activitytypes");
            let short_codes_table = service_client.table_client("shortcodes");
            
            // Ensure tables exist - create if they don't
            let tables = [
                (&shares_table, "shares"),
                (&activities_table, "activities"),
                (&layers_table, "layers"),
                (&activity_types_table, "activitytypes"),
                (&short_codes_table, "shortcodes"),
            ];
            
            for (table, name) in tables {
                match table.create().await {
                    Ok(_) => {
                        tracing::info!("Created table: {}", name);
                    }
                    Err(e) => {
                        // Check if error is "table already exists" (HTTP 409 Conflict)
                        let error_str = e.to_string();
                        if error_str.contains("TableAlreadyExists") || error_str.contains("409") {
                            tracing::debug!("Table already exists: {}", name);
                        } else {
                            tracing::warn!("Failed to create table {}: {}", name, e);
                            // Continue anyway - table might exist
                        }
                    }
                }
            }
            
            tracing::info!("Azure Table Storage initialized successfully");
            
            Ok(Self {
                shares_table,
                activities_table,
                layers_table,
                activity_types_table,
                short_codes_table,
            })
        }
        
        /// Get table names for documentation/setup
        pub fn table_names() -> &'static [&'static str] {
            &Self::TABLE_NAMES
        }
    }
    
    // Note: Full implementation would include the async_trait implementations
    // for ShareStorage, ActivityStorage, LayerStorage, ActivityTypeStorage
    // This is a skeleton showing the structure
}

// ============================================
// Cosmos DB Implementation
// ============================================

pub mod cosmos_storage {
    use super::*;
    use azure_data_cosmos::{CosmosClient, models::ContainerProperties};
    use std::borrow::Cow;
    
    // Re-export the Secret type from the azure_core that azure_data_cosmos uses (0.30)
    // We can't use our azure_core 0.21 for this
    
    /// Container names used by the application
    const CONTAINER_SHARES: &str = "shares";
    const CONTAINER_ACTIVITIES: &str = "activities";
    const CONTAINER_LAYERS: &str = "layers";
    const CONTAINER_ACTIVITY_TYPES: &str = "activitytypes";
    
    /// Azure Cosmos DB client wrapper
    #[allow(dead_code)]
    pub struct CosmosStorageClient {
        client: CosmosClient,
        database_name: String,
    }
    
    /// Check if an error string indicates a 409 Conflict (resource already exists)
    fn is_conflict_error_str(error_msg: &str) -> bool {
        error_msg.contains("409") || error_msg.contains("Conflict") || error_msg.contains("conflict")
    }
    
    impl CosmosStorageClient {
        /// Container names used by the application
        const CONTAINER_NAMES: [&'static str; 4] = [
            CONTAINER_SHARES,
            CONTAINER_ACTIVITIES,
            CONTAINER_LAYERS,
            CONTAINER_ACTIVITY_TYPES,
        ];
        
        /// Create using primary key authentication (requires key_auth feature)
        /// Creates the database and all required containers if they don't exist
        /// 
        /// # Arguments
        /// * `endpoint` - Full endpoint URL (e.g., "https://myaccount.documents.azure.com")
        /// * `database_name` - Name of the database to use/create
        /// * `primary_key` - Cosmos DB primary key
        #[cfg(feature = "key_auth")]
        pub async fn new_with_key(endpoint: &str, database_name: &str, primary_key: &str) -> Result<Self, StorageError> {
            use azure_data_cosmos::CosmosClient;
            
            tracing::info!("Connecting to Azure Cosmos DB endpoint: {} using primary key", endpoint);
            
            // Create client using with_key - convert to owned String for Secret
            // The azure_data_cosmos 0.29 SDK expects a value that implements Into<Secret>
            let key_string = primary_key.to_string();
            let client = CosmosClient::with_key(endpoint, key_string.into(), None)
                .map_err(|e| StorageError::Storage(format!("Failed to create Cosmos client: {}", e)))?;
            
            Self::initialize(client, database_name).await
        }
        
        /// Create using Managed Identity authentication
        /// Creates the database and all required containers if they don't exist
        /// 
        /// # Arguments
        /// * `endpoint` - Full endpoint URL (e.g., "https://myaccount.documents.azure.com")
        /// * `database_name` - Name of the database to use/create
        /// 
        /// # Authentication
        /// Uses DefaultAzureCredential which supports:
        /// - Managed Identity (in Azure - App Service, Functions, AKS, VMs)
        /// - Azure CLI credentials (for local development with `az login`)
        pub async fn new_with_managed_identity(endpoint: &str, _database_name: &str) -> Result<Self, StorageError> {
            tracing::info!("Connecting to Azure Cosmos DB endpoint: {} using Managed Identity", endpoint);
            
            // The azure_data_cosmos crate bundles its own azure_identity
            // We need to use the types it expects
            // For now, we'll create a DeveloperToolsCredential via azure_data_cosmos's re-export
            // Unfortunately, azure_data_cosmos 0.29 doesn't re-export credential types
            // So we need to add azure_identity 0.30 as a direct dependency for Cosmos only
            
            // Since we can't easily mix credential versions, we'll require key auth for now
            // and use Managed Identity only for Table Storage
            Err(StorageError::Storage(
                "Managed Identity for Cosmos DB requires azure_identity 0.30 which conflicts with Table Storage SDK. \
                Please provide COSMOS_PRIMARY_KEY or use Table Storage with Managed Identity instead.".to_string()
            ))
        }
        
        /// Legacy constructor - delegates to new_with_key if key provided, otherwise errors
        /// 
        /// Note: For Managed Identity with Cosmos DB, use a newer version of this SDK
        /// or configure authentication at the Azure level (APIM, Functions Easy Auth)
        pub async fn new(_endpoint: &str, _database_name: &str) -> Result<Self, StorageError> {
            // Without a key, we can't authenticate to Cosmos DB in the current setup
            Err(StorageError::Storage(
                "Cosmos DB requires authentication. Provide COSMOS_PRIMARY_KEY or use Table Storage with Managed Identity.".to_string()
            ))
        }
        
        /// Initialize database and containers
        async fn initialize(client: CosmosClient, database_name: &str) -> Result<Self, StorageError> {
            
            let database_name_owned = database_name.to_string();
            
            // Try to create database (ignore if exists - 409 Conflict)
            match client.create_database(database_name, None).await {
                Ok(_) => {
                    tracing::info!("Created Cosmos DB database: {}", database_name);
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    if is_conflict_error_str(&error_msg) {
                        tracing::debug!("Database already exists: {}", database_name);
                    } else {
                        // Log warning but continue - database might exist with different error
                        tracing::warn!("Database creation returned error (may already exist): {} - {}", database_name, error_msg);
                    }
                }
            }
            
            // Get database client for container operations
            let db_client = client.database_client(database_name);
            
            // Create containers if they don't exist
            // All containers use /organizationId as partition key for multi-tenant isolation
            for container_name in Self::CONTAINER_NAMES {
                let properties = ContainerProperties {
                    id: Cow::Owned(container_name.to_string()),
                    partition_key: "/organizationId".into(),
                    ..Default::default()
                };
                
                match db_client.create_container(properties, None).await {
                    Ok(_) => {
                        tracing::info!("Created Cosmos DB container: {}", container_name);
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        if is_conflict_error_str(&error_msg) {
                            tracing::debug!("Container already exists: {}", container_name);
                        } else {
                            tracing::warn!("Container creation returned error (may already exist): {} - {}", container_name, error_msg);
                        }
                    }
                }
            }
            
            tracing::info!("Azure Cosmos DB initialized successfully");
            
            Ok(Self {
                client,
                database_name: database_name_owned,
            })
        }
        
        /// Get container names for documentation/setup
        pub fn container_names() -> &'static [&'static str] {
            &Self::CONTAINER_NAMES
        }
        
        /// Get database client
        #[allow(dead_code)]
        pub fn database(&self) -> azure_data_cosmos::clients::DatabaseClient {
            self.client.database_client(&self.database_name)
        }
        
        /// Get container client
        #[allow(dead_code)]
        pub fn container(&self, name: &str) -> azure_data_cosmos::clients::ContainerClient {
            self.database().container_client(name)
        }
    }
    
    // Note: Full implementation would include the async_trait implementations
    // for ShareStorage, ActivityStorage, LayerStorage, ActivityTypeStorage
    // This is a skeleton showing the structure
}

// ============================================
// In-Memory Implementation (for testing)
// ============================================

pub mod memory_storage {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::RwLock;
    
    /// In-memory share storage for testing
    pub struct MemoryShareStorage {
        shares: RwLock<HashMap<String, ShareLink>>,
        by_short_code: RwLock<HashMap<String, String>>, // short_code -> id
    }
    
    impl MemoryShareStorage {
        pub fn new() -> Self {
            Self {
                shares: RwLock::new(HashMap::new()),
                by_short_code: RwLock::new(HashMap::new()),
            }
        }
    }
    
    impl Default for MemoryShareStorage {
        fn default() -> Self {
            Self::new()
        }
    }
    
    #[async_trait]
    impl ShareStorage for MemoryShareStorage {
        async fn create(&self, share: ShareLink) -> Result<ShareLink, StorageError> {
            let key = format!("{}:{}", share.organization_id, share.id);
            
            let mut shares = self.shares.write().await;
            if shares.contains_key(&key) {
                return Err(StorageError::AlreadyExists(share.id.clone()));
            }
            
            let mut by_short_code = self.by_short_code.write().await;
            by_short_code.insert(share.short_code.clone(), key.clone());
            
            shares.insert(key, share.clone());
            Ok(share)
        }
        
        async fn get(&self, organization_id: &str, share_id: &str) -> Result<ShareLink, StorageError> {
            let key = format!("{}:{}", organization_id, share_id);
            let shares = self.shares.read().await;
            shares.get(&key)
                .cloned()
                .ok_or_else(|| StorageError::NotFound(share_id.to_string()))
        }
        
        async fn get_by_short_code(&self, short_code: &str) -> Result<ShareLink, StorageError> {
            let by_short_code = self.by_short_code.read().await;
            let key = by_short_code.get(short_code)
                .ok_or_else(|| StorageError::NotFound(short_code.to_string()))?;
            
            let shares = self.shares.read().await;
            shares.get(key)
                .cloned()
                .ok_or_else(|| StorageError::NotFound(short_code.to_string()))
        }
        
        async fn update(&self, share: ShareLink) -> Result<ShareLink, StorageError> {
            let key = format!("{}:{}", share.organization_id, share.id);
            let mut shares = self.shares.write().await;
            
            if !shares.contains_key(&key) {
                return Err(StorageError::NotFound(share.id.clone()));
            }
            
            shares.insert(key, share.clone());
            Ok(share)
        }
        
        async fn delete(&self, organization_id: &str, share_id: &str) -> Result<(), StorageError> {
            let key = format!("{}:{}", organization_id, share_id);
            let mut shares = self.shares.write().await;
            
            if let Some(share) = shares.remove(&key) {
                let mut by_short_code = self.by_short_code.write().await;
                by_short_code.remove(&share.short_code);
            }
            
            Ok(())
        }
        
        async fn list(
            &self,
            organization_id: &str,
            _options: QueryOptions,
        ) -> Result<QueryResult<ShareLink>, StorageError> {
            let shares = self.shares.read().await;
            let prefix = format!("{}:", organization_id);
            
            let items: Vec<ShareLink> = shares.iter()
                .filter(|(k, _)| k.starts_with(&prefix))
                .map(|(_, v)| v.clone())
                .collect();
            
            let total = items.len() as u64;
            
            Ok(QueryResult {
                items,
                continuation_token: None,
                total_count: Some(total),
            })
        }
        
        async fn increment_views(&self, organization_id: &str, share_id: &str) -> Result<(), StorageError> {
            let key = format!("{}:{}", organization_id, share_id);
            let mut shares = self.shares.write().await;
            
            if let Some(share) = shares.get_mut(&key) {
                share.stats.view_count += 1;
                share.stats.last_accessed_at = Some(Utc::now());
            }
            
            Ok(())
        }
    }
}
