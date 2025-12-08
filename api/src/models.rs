//! # Annual Wheel (Årshjul) API
//!
//! Data models for the Annual Wheel Teams app.
//! Designed for Azure Table Storage with easy migration path to Cosmos DB.
//!
//! ## Table Design
//!
//! ### Table: `shares`
//! - PartitionKey: `organizationId`
//! - RowKey: `id` (UUID)
//! - Allows efficient queries by organization
//!
//! ### Table: `activities`
//! - PartitionKey: `organizationId`
//! - RowKey: `id` (UUID)
//! - Allows efficient queries by organization
//!
//! ### Table: `layers`
//! - PartitionKey: `organizationId`
//! - RowKey: `id` (UUID)
//!
//! ### Table: `activitytypes`
//! - PartitionKey: `organizationId`
//! - RowKey: `key` (type key like "meeting", "holiday")
//!
//! ## Cosmos DB Migration
//!
//! When migrating to Cosmos DB:
//! 1. PartitionKey stays the same (`organizationId`)
//! 2. RowKey becomes `id` field
//! 3. Add `ttl` field for automatic expiration (shares)
//! 4. Use `/organizationId` as partition key path

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ============================================
// Share Models
// ============================================

/// Sharing visibility mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShareVisibility {
    /// Requires authentication, respects user roles
    Users,
    /// Uses a secure key, no authentication required
    Public,
}

/// Theme for shared view
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShareTheme {
    Light,
    Dark,
    Auto,
}

impl Default for ShareTheme {
    fn default() -> Self {
        Self::Light
    }
}

/// Layer configuration for a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareLayerConfig {
    /// Layer IDs to include in this share
    pub layer_ids: Vec<String>,
    
    /// Optional: Override layer visibility (key = layerId)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_visibility: Option<std::collections::HashMap<String, bool>>,
    
    /// Year to display (defaults to current year)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<i32>,
}

/// View settings for a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareViewSettings {
    /// Theme: light, dark, or auto
    #[serde(default)]
    pub theme: ShareTheme,
    
    /// Show legend at bottom
    #[serde(default = "default_true")]
    pub show_legend: bool,
    
    /// Show title header
    #[serde(default = "default_true")]
    pub show_title: bool,
    
    /// Custom title (overrides default)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_title: Option<String>,
    
    /// Allow interaction (hover tooltips)
    #[serde(default = "default_true")]
    pub allow_interaction: bool,
    
    /// Auto-rotate to current month
    #[serde(default = "default_true")]
    pub rotate_to_current_month: bool,
}

fn default_true() -> bool {
    true
}

impl Default for ShareViewSettings {
    fn default() -> Self {
        Self {
            theme: ShareTheme::Light,
            show_legend: true,
            show_title: true,
            custom_title: None,
            allow_interaction: true,
            rotate_to_current_month: true,
        }
    }
}

/// Access statistics for a share
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareStats {
    /// Total view count
    #[serde(default)]
    pub view_count: u64,
    
    /// Last accessed timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_accessed_at: Option<DateTime<Utc>>,
    
    /// Unique visitors (approximate)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unique_visitors: Option<u64>,
}

/// Share link - stored in Table Storage
///
/// Table: `shares`
/// - PartitionKey: `organization_id`
/// - RowKey: `id`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareLink {
    /// Unique identifier (RowKey in Table Storage, id in Cosmos DB)
    pub id: String,
    
    /// Secure random key for public access (64 chars hex = 256 bits)
    pub share_key: String,
    
    /// Short code for URL (8 chars, alphanumeric)
    pub short_code: String,
    
    /// Visibility mode
    pub visibility: ShareVisibility,
    
    /// Organization that created this share (PartitionKey)
    pub organization_id: String,
    
    /// User who created the share
    pub created_by: String,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Expiration timestamp
    pub expires_at: DateTime<Utc>,
    
    /// Last renewed timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub renewed_at: Option<DateTime<Utc>>,
    
    /// Optional friendly name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    /// Layer configuration (stored as JSON string in Table Storage)
    pub layer_config: ShareLayerConfig,
    
    /// View settings
    pub view_settings: ShareViewSettings,
    
    /// Access statistics
    #[serde(default)]
    pub stats: ShareStats,
    
    /// Whether the share is active
    #[serde(default = "default_true")]
    pub is_active: bool,
    
    /// TTL in seconds (for Cosmos DB, calculated from expires_at)
    /// In Table Storage, we check expires_at manually
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<i64>,
}

impl ShareLink {
    /// Calculate TTL in seconds from expiration date
    pub fn calculate_ttl(&self) -> i64 {
        let diff = self.expires_at.signed_duration_since(Utc::now());
        diff.num_seconds().max(0)
    }
    
    /// Check if share is expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }
    
    /// Check if share needs renewal (within 30 days of expiry)
    pub fn needs_renewal(&self) -> bool {
        let thirty_days = chrono::Duration::days(30);
        self.expires_at - Utc::now() < thirty_days
    }
}

// ============================================
// Activity Models
// ============================================

/// Activity type category
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityType {
    Meeting,
    Deadline,
    Event,
    Planning,
    Review,
    Training,
    Holiday,
    Other,
}

impl Default for ActivityType {
    fn default() -> Self {
        Self::Other
    }
}

/// Activity - a planned event in the annual wheel
///
/// Table: `activities`
/// - PartitionKey: `organization_id`
/// - RowKey: `id`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    /// Unique identifier
    pub id: String,
    
    /// Activity title
    pub title: String,
    
    /// Start date
    pub start_date: DateTime<Utc>,
    
    /// End date
    pub end_date: DateTime<Utc>,
    
    /// Activity type
    #[serde(rename = "type")]
    pub activity_type: ActivityType,
    
    /// Display color (hex)
    pub color: String,
    
    /// Highlight color for borders/hover (darker)
    pub highlight_color: String,
    
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    /// Scope - Layer ID this activity belongs to
    pub scope: String,
    
    /// Scope ID (for backward compat, same as scope)
    pub scope_id: String,
    
    /// Organization ID (PartitionKey)
    pub organization_id: String,
    
    /// User who created the activity
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    
    /// Creation timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
    
    /// Last modified timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

// ============================================
// Layer Models
// ============================================

/// Layer type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LayerType {
    Holidays,
    Organization,
    Custom,
}

impl Default for LayerType {
    fn default() -> Self {
        Self::Custom
    }
}

/// Layer - admin-configurable ring in the wheel
///
/// Table: `layers`
/// - PartitionKey: `organization_id`
/// - RowKey: `id`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layer {
    /// Unique identifier
    pub id: String,
    
    /// Layer name
    pub name: String,
    
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    /// Layer type
    #[serde(rename = "type")]
    pub layer_type: LayerType,
    
    /// Display color (hex)
    pub color: String,
    
    /// Position on the wheel (0 = innermost)
    pub ring_index: i32,
    
    /// Default visibility for users
    #[serde(default = "default_true")]
    pub is_visible: bool,
    
    /// Organization ID (PartitionKey)
    pub organization_id: String,
    
    /// User who created the layer
    pub created_by: String,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modified timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

// ============================================
// Activity Type Configuration
// ============================================

/// Activity type configuration - admin customizable
///
/// Table: `activitytypes`
/// - PartitionKey: `organization_id`
/// - RowKey: `key` (e.g., "meeting", "holiday")
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityTypeConfig {
    /// Type key (RowKey)
    pub key: String,
    
    /// Display label
    pub label: String,
    
    /// Icon identifier
    pub icon: String,
    
    /// Default color (hex)
    pub color: String,
    
    /// Highlight color (hex)
    pub highlight_color: String,
    
    /// Description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    /// Organization ID (PartitionKey)
    pub organization_id: String,
    
    /// Whether this is a system default (can't be deleted)
    #[serde(default)]
    pub is_system: bool,
    
    /// Sort order
    #[serde(default)]
    pub sort_order: i32,
}

// ============================================
// API Request/Response Models
// ============================================

/// Request to create a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShareRequest {
    pub visibility: ShareVisibility,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub layer_config: ShareLayerConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view_settings: Option<ShareViewSettings>,
}

/// Response when creating a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShareResponse {
    pub share: ShareLink,
    pub share_url: String,
    pub embed_code: String,
}

/// Request to access a public share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessShareRequest {
    pub short_code: String,
    pub key: String,
}

/// Share access config returned to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareAccessConfig {
    pub layers: ShareLayerConfig,
    pub view_settings: ShareViewSettings,
    pub organization_name: String,
    pub title: String,
}

/// Activity for share access (simplified)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareActivity {
    pub id: String,
    pub title: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub color: String,
    pub highlight_color: String,
    pub layer_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Response when accessing a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessShareResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<ShareAccessConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activities: Option<Vec<ShareActivity>>,
}

/// Request to renew a share
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenewShareRequest {
    pub share_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_expires_at: Option<DateTime<Utc>>,
}

/// List shares request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSharesRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<ShareVisibility>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continuation_token: Option<String>,
}

/// List shares response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSharesResponse {
    pub shares: Vec<ShareLink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continuation_token: Option<String>,
    pub total_count: u64,
}

// ============================================
// User Settings Models
// ============================================

/// User theme preference
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserTheme {
    Light,
    Dark,
    System,
}

impl Default for UserTheme {
    fn default() -> Self {
        Self::System
    }
}

/// User-specific settings
/// 
/// Table: `usersettings`
/// - PartitionKey: `organizationId`
/// - RowKey: `userId`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    /// User ID (from Teams/Azure AD)
    pub user_id: String,
    
    /// Organization ID
    pub organization_id: String,
    
    /// User's preferred layer order (array of layer IDs, inner to outer)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_order: Option<Vec<String>>,
    
    /// Layer visibility overrides (layerId -> visible)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_visibility: Option<std::collections::HashMap<String, bool>>,
    
    /// User theme preference
    #[serde(default)]
    pub theme: UserTheme,
    
    /// Last updated timestamp
    pub updated_at: DateTime<Utc>,
}

impl UserSettings {
    /// Create new user settings with defaults
    pub fn new(user_id: String, organization_id: String) -> Self {
        Self {
            user_id,
            organization_id,
            layer_order: None,
            layer_visibility: None,
            theme: UserTheme::default(),
            updated_at: Utc::now(),
        }
    }
}

/// Request to update user settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserSettingsRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_order: Option<Vec<String>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_visibility: Option<std::collections::HashMap<String, bool>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<UserTheme>,
}

// ============================================
// Error Types
// ============================================

/// API error response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ApiError {
    pub fn not_found(message: &str) -> Self {
        Self {
            code: "NOT_FOUND".to_string(),
            message: message.to_string(),
            details: None,
        }
    }
    
    pub fn unauthorized(message: &str) -> Self {
        Self {
            code: "UNAUTHORIZED".to_string(),
            message: message.to_string(),
            details: None,
        }
    }
    
    pub fn bad_request(message: &str) -> Self {
        Self {
            code: "BAD_REQUEST".to_string(),
            message: message.to_string(),
            details: None,
        }
    }
    
    pub fn internal(message: &str) -> Self {
        Self {
            code: "INTERNAL_ERROR".to_string(),
            message: message.to_string(),
            details: None,
        }
    }
    
    pub fn expired(message: &str) -> Self {
        Self {
            code: "EXPIRED".to_string(),
            message: message.to_string(),
            details: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_share_link_serialization() {
        let share = ShareLink {
            id: "test-id".to_string(),
            share_key: "a".repeat(64),
            short_code: "AbCd1234".to_string(),
            visibility: ShareVisibility::Public,
            organization_id: "org-123".to_string(),
            created_by: "user-123".to_string(),
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::days(365),
            renewed_at: None,
            name: Some("Test Share".to_string()),
            description: None,
            layer_config: ShareLayerConfig {
                layer_ids: vec!["layer-1".to_string()],
                layer_visibility: None,
                year: Some(2025),
            },
            view_settings: ShareViewSettings::default(),
            stats: ShareStats::default(),
            is_active: true,
            ttl: None,
        };
        
        let json = serde_json::to_string_pretty(&share).unwrap();
        println!("{}", json);
        
        let deserialized: ShareLink = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, share.id);
        assert_eq!(deserialized.visibility, ShareVisibility::Public);
    }
    
    #[test]
    fn test_share_expiry() {
        let mut share = ShareLink {
            id: "test".to_string(),
            share_key: "a".repeat(64),
            short_code: "AbCd1234".to_string(),
            visibility: ShareVisibility::Public,
            organization_id: "org".to_string(),
            created_by: "user".to_string(),
            created_at: Utc::now(),
            expires_at: Utc::now() - chrono::Duration::days(1), // Expired
            renewed_at: None,
            name: None,
            description: None,
            layer_config: ShareLayerConfig {
                layer_ids: vec![],
                layer_visibility: None,
                year: None,
            },
            view_settings: ShareViewSettings::default(),
            stats: ShareStats::default(),
            is_active: true,
            ttl: None,
        };
        
        assert!(share.is_expired());
        
        share.expires_at = Utc::now() + chrono::Duration::days(365);
        assert!(!share.is_expired());
        assert!(!share.needs_renewal());
        
        share.expires_at = Utc::now() + chrono::Duration::days(10);
        assert!(share.needs_renewal());
    }
}
