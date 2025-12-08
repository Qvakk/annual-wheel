//! # Annual Wheel (Årshjul) API
//!
//! Azure Functions API in Rust for the Annual Wheel Teams app.
//!
//! ## Architecture
//!
//! - **Storage**: Azure Table Storage (with Cosmos DB migration path)
//! - **Auth**: Azure AD / Teams SSO token validation
//! - **API**: RESTful HTTP endpoints
//!
//! ## Endpoints
//!
//! ### Shares
//! - `POST /api/shares` - Create share (authenticated)
//! - `GET /api/shares` - List shares for org (authenticated)
//! - `GET /api/shares/{id}` - Get share details (authenticated)
//! - `DELETE /api/shares/{id}` - Delete share (authenticated)
//! - `POST /api/shares/{id}/renew` - Renew share TTL (authenticated)
//! - `POST /api/shares/{id}/regenerate-key` - Regenerate share key (authenticated)
//!
//! ### Public Share Access
//! - `GET /api/public/s/{shortCode}` - Access public share (with key in query)
//!
//! ### Activities
//! - `POST /api/activities` - Create activity (authenticated)
//! - `GET /api/activities` - List activities (authenticated)
//! - `PUT /api/activities/{id}` - Update activity (authenticated)
//! - `DELETE /api/activities/{id}` - Delete activity (authenticated)
//!
//! ### Layers
//! - `POST /api/layers` - Create layer (admin only)
//! - `GET /api/layers` - List layers (authenticated)
//! - `PUT /api/layers/{id}` - Update layer (admin only)
//! - `DELETE /api/layers/{id}` - Delete layer (admin only)
//!
//! ### Activity Types
//! - `GET /api/activity-types` - List activity types (authenticated)
//! - `PUT /api/activity-types/{key}` - Update activity type (admin only)

pub mod models;
pub mod storage;
pub mod handlers;
pub mod auth;
pub mod crypto;
pub mod config;

pub use models::*;
pub use storage::*;
pub use config::*;
