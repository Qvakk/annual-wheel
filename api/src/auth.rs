//! Authentication and Authorization
//!
//! Handles Azure AD / Teams SSO token validation.
//!
//! ## Security Notes
//!
//! 1. **Always validate tokens server-side** - Never trust client claims
//! 2. **Verify signature** - Use Azure AD public keys
//! 3. **Check audience** - Ensure token is for our app
//! 4. **Check issuer** - Ensure token is from Azure AD
//! 5. **Check expiration** - Reject expired tokens

use jsonwebtoken::{decode, decode_header, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use thiserror::Error;

/// Authentication errors
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Missing authorization header")]
    MissingHeader,
    
    #[error("Invalid authorization header format")]
    InvalidFormat,
    
    #[error("Token validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("Token expired")]
    Expired,
    
    #[error("Invalid audience")]
    InvalidAudience,
    
    #[error("Invalid issuer")]
    InvalidIssuer,
    
    #[error("Insufficient permissions: {0}")]
    InsufficientPermissions(String),
}

/// JWT claims from Azure AD token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenClaims {
    /// Subject (user ID)
    pub sub: String,
    
    /// Object ID (Azure AD user object ID)
    pub oid: String,
    
    /// Tenant ID (organization)
    pub tid: String,
    
    /// Audience (our app ID)
    pub aud: String,
    
    /// Issuer
    pub iss: String,
    
    /// Expiration time
    pub exp: i64,
    
    /// Issued at
    pub iat: i64,
    
    /// Not before
    #[serde(default)]
    pub nbf: i64,
    
    /// User principal name (email)
    #[serde(default)]
    pub upn: Option<String>,
    
    /// Preferred username
    #[serde(default)]
    pub preferred_username: Option<String>,
    
    /// Display name
    #[serde(default)]
    pub name: Option<String>,
    
    /// App roles assigned to user
    #[serde(default)]
    pub roles: Vec<String>,
    
    /// Scope (for delegated permissions)
    #[serde(default)]
    pub scp: Option<String>,
}

/// Authenticated user context
#[derive(Debug, Clone)]
pub struct UserContext {
    /// User ID (oid claim)
    pub user_id: String,
    
    /// Organization/Tenant ID (tid claim)
    pub organization_id: String,
    
    /// Display name
    pub display_name: Option<String>,
    
    /// Email
    pub email: Option<String>,
    
    /// Is admin (has admin.write role)
    pub is_admin: bool,
    
    /// All roles
    pub roles: Vec<String>,
}

impl From<TokenClaims> for UserContext {
    fn from(claims: TokenClaims) -> Self {
        Self {
            user_id: claims.oid,
            organization_id: claims.tid,
            display_name: claims.name,
            email: claims.preferred_username.or(claims.upn),
            is_admin: claims.roles.contains(&"admin.write".to_string()),
            roles: claims.roles,
        }
    }
}

/// Token validator configuration
#[derive(Debug, Clone)]
pub struct TokenValidatorConfig {
    /// Expected audience (our app client ID)
    pub audience: String,
    
    /// Expected issuer pattern (Azure AD)
    pub issuer_pattern: String,
    
    /// Admin role name
    pub admin_role: String,
    
    /// Skip signature validation (DEVELOPMENT ONLY - set to false in production!)
    pub skip_signature_validation: bool,
}

impl Default for TokenValidatorConfig {
    fn default() -> Self {
        // Check if we're in development mode
        let is_dev = std::env::var("RUST_ENV")
            .map(|v| v == "development")
            .unwrap_or(false);
        
        Self {
            // These should come from environment variables
            audience: std::env::var("AZURE_CLIENT_ID").unwrap_or_default(),
            issuer_pattern: "https://login.microsoftonline.com/".to_string(),
            admin_role: "admin.write".to_string(),
            // Only skip signature validation in development mode
            skip_signature_validation: is_dev,
        }
    }
}

/// Token validator
pub struct TokenValidator {
    config: TokenValidatorConfig,
}

impl TokenValidator {
    pub fn new(config: TokenValidatorConfig) -> Self {
        Self { config }
    }
    
    /// Validate a bearer token from Authorization header
    pub async fn validate(&self, auth_header: &str) -> Result<UserContext, AuthError> {
        // Extract token from "Bearer <token>"
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidFormat)?;
        
        self.validate_token(token).await
    }
    
    /// Validate a JWT token
    pub async fn validate_token(&self, token: &str) -> Result<UserContext, AuthError> {
        // Decode header to get key ID (unused for now, but kept for future JWKS implementation)
        let _header = decode_header(token)
            .map_err(|e| AuthError::ValidationFailed(e.to_string()))?;
        
        // In production: Fetch Azure AD public keys from JWKS endpoint
        // TODO: Implement proper JWKS key fetching from:
        // https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
        
        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        
        // Set expected audience
        let mut audiences = HashSet::new();
        audiences.insert(self.config.audience.clone());
        validation.aud = Some(audiences);
        
        // ⚠️ SECURITY WARNING: Signature validation should ALWAYS be enabled in production!
        // Only skip in development mode when RUST_ENV=development
        if self.config.skip_signature_validation {
            tracing::warn!("⚠️  JWT signature validation is DISABLED - DEVELOPMENT MODE ONLY!");
            validation.insecure_disable_signature_validation();
        } else {
            // TODO: In production, fetch JWKS keys and validate signature properly
            // For now, we still disable but log a critical warning
            tracing::error!("🚨 CRITICAL: JWT signature validation not implemented! Set RUST_ENV=development to acknowledge this risk.");
            return Err(AuthError::ValidationFailed(
                "Token signature validation not configured. Contact administrator.".to_string()
            ));
        }
        
        let token_data = decode::<TokenClaims>(
            token,
            &DecodingKey::from_secret(&[]), // Dummy key when sig validation disabled
            &validation,
        ).map_err(|e| AuthError::ValidationFailed(e.to_string()))?;
        
        let claims = token_data.claims;
        
        // Validate issuer
        if !claims.iss.starts_with(&self.config.issuer_pattern) {
            return Err(AuthError::InvalidIssuer);
        }
        
        Ok(UserContext::from(claims))
    }
    
    /// Check if user has admin role
    pub fn require_admin(&self, user: &UserContext) -> Result<(), AuthError> {
        if !user.is_admin {
            return Err(AuthError::InsufficientPermissions(
                "Admin role required".to_string()
            ));
        }
        Ok(())
    }
}

/// Extract user context from HTTP request headers
pub async fn extract_user_context(
    headers: &[(String, String)],
    validator: &TokenValidator,
) -> Result<UserContext, AuthError> {
    let auth_header = headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "authorization")
        .map(|(_, v)| v.as_str())
        .ok_or(AuthError::MissingHeader)?;
    
    validator.validate(auth_header).await
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_user_context_from_claims() {
        let claims = TokenClaims {
            sub: "user-sub".to_string(),
            oid: "user-oid".to_string(),
            tid: "tenant-id".to_string(),
            aud: "app-id".to_string(),
            iss: "https://login.microsoftonline.com/tenant-id/v2.0".to_string(),
            exp: 9999999999,
            iat: 1000000000,
            nbf: 1000000000,
            upn: Some("user@example.com".to_string()),
            preferred_username: None,
            name: Some("Test User".to_string()),
            roles: vec!["admin.write".to_string()],
            scp: None,
        };
        
        let context = UserContext::from(claims);
        assert_eq!(context.user_id, "user-oid");
        assert_eq!(context.organization_id, "tenant-id");
        assert!(context.is_admin);
    }
}
