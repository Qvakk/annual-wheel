//! HTTP Handlers for Azure Functions
//!
//! Each handler corresponds to an HTTP-triggered Azure Function.

use crate::auth::{TokenValidator, UserContext};
use crate::crypto::{generate_share_key, generate_short_code, is_valid_share_key, is_valid_short_code, secure_compare};
use crate::models::*;
use crate::storage::{ShareStorage, ActivityStorage, LayerStorage, QueryOptions, StorageError};
use chrono::{Duration, Utc};
use serde::Serialize;
use std::sync::Arc;

/// Handler context with shared dependencies
pub struct HandlerContext {
    pub share_storage: Arc<dyn ShareStorage>,
    pub activity_storage: Arc<dyn ActivityStorage>,
    pub layer_storage: Arc<dyn LayerStorage>,
    pub token_validator: TokenValidator,
    pub base_url: String,
}

/// HTTP Response wrapper
#[derive(Debug, Clone, Serialize)]
pub struct HttpResponse<T: Serialize> {
    pub status: u16,
    pub body: T,
}

impl<T: Serialize> HttpResponse<T> {
    pub fn ok(body: T) -> Self {
        Self { status: 200, body }
    }
    
    pub fn created(body: T) -> Self {
        Self { status: 201, body }
    }
}

impl HttpResponse<ApiError> {
    pub fn bad_request(message: &str) -> Self {
        Self { status: 400, body: ApiError::bad_request(message) }
    }
    
    pub fn unauthorized(message: &str) -> Self {
        Self { status: 401, body: ApiError::unauthorized(message) }
    }
    
    pub fn not_found(message: &str) -> Self {
        Self { status: 404, body: ApiError::not_found(message) }
    }
    
    pub fn internal_error(message: &str) -> Self {
        Self { status: 500, body: ApiError::internal(message) }
    }
}

// ============================================
// Share Handlers
// ============================================

/// POST /api/shares - Create a new share
pub async fn create_share(
    ctx: &HandlerContext,
    user: &UserContext,
    request: CreateShareRequest,
) -> Result<HttpResponse<CreateShareResponse>, HttpResponse<ApiError>> {
    // Validate request
    if request.layer_config.layer_ids.is_empty() {
        return Err(HttpResponse::bad_request("At least one layer must be selected"));
    }
    
    // Validate layer_ids count (prevent abuse)
    if request.layer_config.layer_ids.len() > 100 {
        return Err(HttpResponse::bad_request("Too many layers selected (max 100)"));
    }
    
    // Validate name length if provided
    if let Some(ref name) = request.name {
        if name.len() > 200 {
            return Err(HttpResponse::bad_request("Name too long (max 200 characters)"));
        }
    }
    
    // Validate description length if provided
    if let Some(ref desc) = request.description {
        if desc.len() > 2000 {
            return Err(HttpResponse::bad_request("Description too long (max 2000 characters)"));
        }
    }
    
    // Create share
    let now = Utc::now();
    let expires_at = now + Duration::days(365); // 1 year TTL
    
    let share = ShareLink {
        id: uuid::Uuid::new_v4().to_string(),
        share_key: generate_share_key(),
        short_code: generate_short_code(),
        visibility: request.visibility,
        organization_id: user.organization_id.clone(),
        created_by: user.user_id.clone(),
        created_at: now,
        expires_at,
        renewed_at: None,
        name: request.name,
        description: request.description,
        layer_config: request.layer_config,
        view_settings: request.view_settings.unwrap_or_default(),
        stats: ShareStats::default(),
        is_active: true,
        ttl: Some((expires_at - now).num_seconds()),
    };
    
    // Save to storage
    let saved = ctx.share_storage.create(share).await
        .map_err(|e| HttpResponse::internal_error(&e.to_string()))?;
    
    // Build URLs
    let share_url = build_share_url(&saved, &ctx.base_url);
    let embed_code = build_embed_code(&saved, &ctx.base_url);
    
    Ok(HttpResponse::created(CreateShareResponse {
        share: saved,
        share_url,
        embed_code,
    }))
}

/// GET /api/shares - List shares for organization
pub async fn list_shares(
    ctx: &HandlerContext,
    user: &UserContext,
    request: ListSharesRequest,
) -> Result<HttpResponse<ListSharesResponse>, HttpResponse<ApiError>> {
    let options = QueryOptions {
        page_size: request.page_size,
        continuation_token: request.continuation_token,
        filter: None,
    };
    
    let result = ctx.share_storage.list(&user.organization_id, options).await
        .map_err(|e| HttpResponse::internal_error(&e.to_string()))?;
    
    // Filter by visibility and active status if specified
    let filtered: Vec<ShareLink> = result.items.into_iter()
        .filter(|s| {
            let vis_ok = request.visibility.map_or(true, |v| s.visibility == v);
            let active_ok = request.is_active.map_or(true, |a| s.is_active == a);
            vis_ok && active_ok
        })
        .collect();
    
    Ok(HttpResponse::ok(ListSharesResponse {
        shares: filtered,
        continuation_token: result.continuation_token,
        total_count: result.total_count.unwrap_or(0),
    }))
}

/// GET /api/shares/{id} - Get share by ID
pub async fn get_share(
    ctx: &HandlerContext,
    user: &UserContext,
    share_id: &str,
) -> Result<HttpResponse<ShareLink>, HttpResponse<ApiError>> {
    let share = ctx.share_storage.get(&user.organization_id, share_id).await
        .map_err(|e| match e {
            StorageError::NotFound(_) => HttpResponse::not_found("Share not found"),
            _ => HttpResponse::internal_error(&e.to_string()),
        })?;
    
    Ok(HttpResponse::ok(share))
}

/// DELETE /api/shares/{id} - Delete (deactivate) share
pub async fn delete_share(
    ctx: &HandlerContext,
    user: &UserContext,
    share_id: &str,
) -> Result<HttpResponse<()>, HttpResponse<ApiError>> {
    // Get share first to verify ownership
    let _share = ctx.share_storage.get(&user.organization_id, share_id).await
        .map_err(|e| match e {
            StorageError::NotFound(_) => HttpResponse::not_found("Share not found"),
            _ => HttpResponse::internal_error(&e.to_string()),
        })?;
    
    // Delete
    ctx.share_storage.delete(&user.organization_id, share_id).await
        .map_err(|e| HttpResponse::internal_error(&e.to_string()))?;
    
    Ok(HttpResponse::ok(()))
}

/// POST /api/shares/{id}/renew - Renew share TTL
pub async fn renew_share(
    ctx: &HandlerContext,
    user: &UserContext,
    share_id: &str,
) -> Result<HttpResponse<ShareLink>, HttpResponse<ApiError>> {
    let mut share = ctx.share_storage.get(&user.organization_id, share_id).await
        .map_err(|e| match e {
            StorageError::NotFound(_) => HttpResponse::not_found("Share not found"),
            _ => HttpResponse::internal_error(&e.to_string()),
        })?;
    
    // Extend expiration by 1 year from now
    let now = Utc::now();
    share.expires_at = now + Duration::days(365);
    share.renewed_at = Some(now);
    share.ttl = Some((share.expires_at - now).num_seconds());
    
    let updated = ctx.share_storage.update(share).await
        .map_err(|e| HttpResponse::internal_error(&e.to_string()))?;
    
    Ok(HttpResponse::ok(updated))
}

/// POST /api/shares/{id}/regenerate-key - Regenerate share key
pub async fn regenerate_share_key(
    ctx: &HandlerContext,
    user: &UserContext,
    share_id: &str,
) -> Result<HttpResponse<CreateShareResponse>, HttpResponse<ApiError>> {
    let mut share = ctx.share_storage.get(&user.organization_id, share_id).await
        .map_err(|e| match e {
            StorageError::NotFound(_) => HttpResponse::not_found("Share not found"),
            _ => HttpResponse::internal_error(&e.to_string()),
        })?;
    
    // Generate new key
    share.share_key = generate_share_key();
    
    let updated = ctx.share_storage.update(share).await
        .map_err(|e| HttpResponse::internal_error(&e.to_string()))?;
    
    let share_url = build_share_url(&updated, &ctx.base_url);
    let embed_code = build_embed_code(&updated, &ctx.base_url);
    
    Ok(HttpResponse::ok(CreateShareResponse {
        share: updated,
        share_url,
        embed_code,
    }))
}

// ============================================
// Public Share Access
// ============================================

/// GET /api/public/s/{shortCode}?k={key} - Access public share
pub async fn access_public_share(
    ctx: &HandlerContext,
    short_code: &str,
    key: &str,
) -> Result<HttpResponse<AccessShareResponse>, HttpResponse<ApiError>> {
    // Validate input format
    if !is_valid_short_code(short_code) {
        return Ok(HttpResponse::ok(AccessShareResponse {
            success: false,
            error: Some("Invalid share code".to_string()),
            config: None,
            activities: None,
        }));
    }
    
    if !is_valid_share_key(key) {
        return Ok(HttpResponse::ok(AccessShareResponse {
            success: false,
            error: Some("Invalid share key".to_string()),
            config: None,
            activities: None,
        }));
    }
    
    // Look up share by short code
    let share = match ctx.share_storage.get_by_short_code(short_code).await {
        Ok(s) => s,
        Err(StorageError::NotFound(_)) => {
            return Ok(HttpResponse::ok(AccessShareResponse {
                success: false,
                error: Some("Share not found".to_string()),
                config: None,
                activities: None,
            }));
        }
        Err(e) => return Err(HttpResponse::internal_error(&e.to_string())),
    };
    
    // Verify key using constant-time comparison
    if !secure_compare(&share.share_key, key) {
        return Ok(HttpResponse::ok(AccessShareResponse {
            success: false,
            error: Some("Invalid share key".to_string()),
            config: None,
            activities: None,
        }));
    }
    
    // Check if active
    if !share.is_active {
        return Ok(HttpResponse::ok(AccessShareResponse {
            success: false,
            error: Some("Share has been deactivated".to_string()),
            config: None,
            activities: None,
        }));
    }
    
    // Check expiration
    if share.is_expired() {
        return Ok(HttpResponse::ok(AccessShareResponse {
            success: false,
            error: Some("Share has expired".to_string()),
            config: None,
            activities: None,
        }));
    }
    
    // Increment view count (fire and forget)
    let _ = ctx.share_storage.increment_views(&share.organization_id, &share.id).await;
    
    // Fetch activities for the shared layers
    let year = share.layer_config.year.unwrap_or_else(|| Utc::now().year() as i32);
    let activities = ctx.activity_storage.list_by_layers(
        &share.organization_id,
        &share.layer_config.layer_ids,
        Some(year),
    ).await.unwrap_or_default();
    
    // Convert to share activities
    let share_activities: Vec<ShareActivity> = activities.into_iter()
        .map(|a| ShareActivity {
            id: a.id,
            title: a.title,
            start_date: a.start_date,
            end_date: a.end_date,
            color: a.color,
            highlight_color: a.highlight_color,
            layer_id: a.scope,
            description: a.description,
        })
        .collect();
    
    Ok(HttpResponse::ok(AccessShareResponse {
        success: true,
        error: None,
        config: Some(ShareAccessConfig {
            layers: share.layer_config.clone(),
            view_settings: share.view_settings.clone(),
            organization_name: "Organization".to_string(), // TODO: Fetch from org lookup
            title: share.view_settings.custom_title.clone()
                .or(share.name.clone())
                .unwrap_or_else(|| "Annual Wheel".to_string()),
        }),
        activities: Some(share_activities),
    }))
}

// ============================================
// Helper Functions
// ============================================

/// Build share URL
fn build_share_url(share: &ShareLink, base_url: &str) -> String {
    match share.visibility {
        ShareVisibility::Public => {
            format!("{}/s/{}?k={}", base_url, share.short_code, share.share_key)
        }
        ShareVisibility::Users => {
            format!("{}/s/{}", base_url, share.short_code)
        }
    }
}

/// Build embed code
fn build_embed_code(share: &ShareLink, base_url: &str) -> String {
    let url = match share.visibility {
        ShareVisibility::Public => {
            format!("{}/embed/{}?k={}", base_url, share.short_code, share.share_key)
        }
        ShareVisibility::Users => {
            format!("{}/embed/{}", base_url, share.short_code)
        }
    };
    
    let title = share.name.as_deref().unwrap_or("Annual Wheel");
    format!(
        r#"<iframe src="{}" width="600" height="600" frameborder="0" title="{}"></iframe>"#,
        url, title
    )
}

use chrono::Datelike;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_build_share_url() {
        let share = ShareLink {
            id: "test-id".to_string(),
            share_key: "a".repeat(64),
            short_code: "AbCd1234".to_string(),
            visibility: ShareVisibility::Public,
            organization_id: "org".to_string(),
            created_by: "user".to_string(),
            created_at: Utc::now(),
            expires_at: Utc::now() + Duration::days(365),
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
        
        let url = build_share_url(&share, "https://example.com");
        assert!(url.starts_with("https://example.com/s/AbCd1234?k="));
    }
}
