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
use chrono::{DateTime, Utc};
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
    use azure_data_tables::{prelude::*, operations::*};
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
    pub struct TableStorageClient {
        shares_table: TableClient,
        activities_table: TableClient,
        layers_table: TableClient,
        activity_types_table: TableClient,
        /// Secondary index table for short_code lookups
        short_codes_table: TableClient,
    }
    
    impl TableStorageClient {
        /// Create from connection string
        pub async fn new(connection_string: &str) -> Result<Self, StorageError> {
            let service_client = TableServiceClient::new(
                connection_string,
                TableClientOptions::default(),
            );
            
            // Create tables if they don't exist
            let shares_table = service_client.table_client("shares");
            let activities_table = service_client.table_client("activities");
            let layers_table = service_client.table_client("layers");
            let activity_types_table = service_client.table_client("activitytypes");
            let short_codes_table = service_client.table_client("shortcodes");
            
            // Ensure tables exist
            for table in [&shares_table, &activities_table, &layers_table, &activity_types_table, &short_codes_table] {
                let _ = table.create().await; // Ignore if already exists
            }
            
            Ok(Self {
                shares_table,
                activities_table,
                layers_table,
                activity_types_table,
                short_codes_table,
            })
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
