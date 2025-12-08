/**
 * Cosmos DB Data Model for Annual Wheel Sharing
 * 
 * Container: shares
 * Partition Key: /organizationId
 * 
 * This file documents the Cosmos DB structure for share links.
 * 
 * TTL (Time To Live) - AUTOMATIC EXPIRATION:
 * - Cosmos DB has built-in TTL support
 * - Set `ttl` property on document (in seconds)
 * - Document is AUTOMATICALLY DELETED when TTL expires
 * - No manual cleanup needed - Cosmos DB handles it
 * - Example: ttl = 31536000 = 1 year
 */

/**
 * Cosmos DB Container Configuration
 * 
 * Container ID: shares
 * Partition Key Path: /organizationId
 * Default TTL: -1 (disabled at container level, enabled per document)
 * Indexing Policy: Default + composite index on (organizationId, createdAt)
 */
export const sharesContainerConfig = {
  id: 'shares',
  partitionKey: {
    paths: ['/organizationId'],
    kind: 'Hash',
  },
  defaultTtl: -1, // TTL controlled per document
  indexingPolicy: {
    indexingMode: 'consistent',
    automatic: true,
    includedPaths: [
      { path: '/*' }
    ],
    excludedPaths: [
      { path: '/_etag/?' }
    ],
    compositeIndexes: [
      // For efficient listing by org + date
      [
        { path: '/organizationId', order: 'ascending' },
        { path: '/createdAt', order: 'descending' }
      ],
      // For filtering by visibility
      [
        { path: '/organizationId', order: 'ascending' },
        { path: '/visibility', order: 'ascending' },
        { path: '/createdAt', order: 'descending' }
      ]
    ]
  },
  uniqueKeyPolicy: {
    uniqueKeys: [
      { paths: ['/shortCode'] } // Ensure short codes are globally unique
    ]
  }
};

/**
 * Document Structure in Cosmos DB
 * 
 * {
 *   "id": "uuid",                          // Document ID
 *   "shareKey": "64-char-hex",             // Secure access key
 *   "shortCode": "8-char-alphanumeric",    // URL-friendly code
 *   "visibility": "users" | "public",
 *   "organizationId": "org-id",            // Partition key
 *   "createdBy": "user-id",
 *   "createdAt": "2025-01-15T10:30:00Z",
 *   "expiresAt": "2026-01-15T10:30:00Z",
 *   "renewedAt": "2025-06-15T10:30:00Z",   // Optional
 *   "name": "Q1 Planning",                 // Optional
 *   "description": "...",                   // Optional
 *   "layerConfig": {
 *     "layerIds": ["layer-holidays-no", "layer-org"],
 *     "layerVisibility": { "layer-holidays-no": true },
 *     "year": 2025
 *   },
 *   "viewSettings": {
 *     "theme": "light",
 *     "showLegend": true,
 *     "showTitle": true,
 *     "customTitle": "My Calendar",
 *     "allowInteraction": true,
 *     "rotateToCurrentMonth": true
 *   },
 *   "stats": {
 *     "viewCount": 42,
 *     "lastAccessedAt": "2025-01-20T14:00:00Z",
 *     "uniqueVisitors": 15
 *   },
 *   "isActive": true,
 *   "ttl": 31536000                        // Cosmos DB auto-deletes document after this many seconds
 * }
 * 
 * NOTE: The `ttl` field makes Cosmos DB automatically delete the document.
 * No need for cleanup jobs or manual expiration checks!
 * When user accesses an expired link, it simply won't exist in the database.
 */

/**
 * SQL Queries for Common Operations
 */
export const queries = {
  // Get share by short code (for public access)
  getByShortCode: `
    SELECT * FROM c 
    WHERE c.shortCode = @shortCode
  `,
  
  // List shares for organization
  listByOrg: `
    SELECT * FROM c 
    WHERE c.organizationId = @orgId 
    ORDER BY c.createdAt DESC
  `,
  
  // List active shares for organization
  listActiveByOrg: `
    SELECT * FROM c 
    WHERE c.organizationId = @orgId 
      AND c.isActive = true
    ORDER BY c.createdAt DESC
  `,
  
  // List public shares for organization
  listPublicByOrg: `
    SELECT * FROM c 
    WHERE c.organizationId = @orgId 
      AND c.visibility = 'public'
    ORDER BY c.createdAt DESC
  `,
  
  // List shares expiring soon (for renewal reminders)
  listExpiringSoon: `
    SELECT * FROM c 
    WHERE c.organizationId = @orgId 
      AND c.isActive = true
      AND c.expiresAt < @threshold
    ORDER BY c.expiresAt ASC
  `,
  
  // Get share statistics
  getStats: `
    SELECT 
      COUNT(1) as totalShares,
      SUM(c.isActive ? 1 : 0) as activeShares,
      SUM(c.visibility = 'public' ? 1 : 0) as publicShares,
      SUM(c.stats.viewCount) as totalViews
    FROM c 
    WHERE c.organizationId = @orgId
  `,
};

/**
 * API Endpoint Specifications
 * 
 * Base URL: /api/shares
 * 
 * All endpoints except public access require authentication.
 */
export const apiEndpoints = {
  // ==========================================
  // Authenticated Endpoints (require login)
  // ==========================================
  
  /**
   * POST /api/shares
   * Create a new share link
   * 
   * Request Body: CreateShareRequest
   * Response: CreateShareResponse (201 Created)
   * 
   * Authorization: User must be in organization
   */
  createShare: {
    method: 'POST',
    path: '/api/shares',
    auth: 'required',
    body: 'CreateShareRequest',
    response: 'CreateShareResponse',
  },
  
  /**
   * GET /api/shares
   * List shares for the user's organization
   * 
   * Query Params:
   *   - visibility: 'users' | 'public' (optional)
   *   - isActive: boolean (optional)
   *   - pageSize: number (default: 20, max: 100)
   *   - continuationToken: string (for pagination)
   * 
   * Response: ListSharesResponse
   */
  listShares: {
    method: 'GET',
    path: '/api/shares',
    auth: 'required',
    response: 'ListSharesResponse',
  },
  
  /**
   * GET /api/shares/:id
   * Get share details
   * 
   * Response: ShareLink
   */
  getShare: {
    method: 'GET',
    path: '/api/shares/:id',
    auth: 'required',
    response: 'ShareLink',
  },
  
  /**
   * PUT /api/shares/:id
   * Update share settings
   * 
   * Request Body: Partial<ShareLink>
   * Response: ShareLink
   */
  updateShare: {
    method: 'PUT',
    path: '/api/shares/:id',
    auth: 'required',
    body: 'Partial<ShareLink>',
    response: 'ShareLink',
  },
  
  /**
   * DELETE /api/shares/:id
   * Delete share (soft delete by default)
   * 
   * Query Params:
   *   - hard: boolean (optional, for permanent deletion)
   * 
   * Response: { success: boolean }
   */
  deleteShare: {
    method: 'DELETE',
    path: '/api/shares/:id',
    auth: 'required',
    response: '{ success: boolean }',
  },
  
  /**
   * POST /api/shares/:id/renew
   * Renew share TTL
   * 
   * Request Body: { newExpiresAt?: Date }
   * Response: ShareLink
   */
  renewShare: {
    method: 'POST',
    path: '/api/shares/:id/renew',
    auth: 'required',
    body: '{ newExpiresAt?: Date }',
    response: 'ShareLink',
  },
  
  /**
   * POST /api/shares/:id/regenerate-key
   * Regenerate share key (invalidates old key)
   * 
   * Response: { share: ShareLink, shareUrl: string, embedCode: string }
   */
  regenerateKey: {
    method: 'POST',
    path: '/api/shares/:id/regenerate-key',
    auth: 'required',
    response: '{ share: ShareLink, shareUrl: string, embedCode: string }',
  },
  
  // ==========================================
  // Public Endpoints (no authentication)
  // ==========================================
  
  /**
   * GET /api/public/s/:shortCode
   * Access a public share
   * 
   * Query Params:
   *   - k: string (share key, required for public shares)
   * 
   * Response: AccessShareResponse
   * 
   * Rate Limited: Yes (prevent brute force)
   */
  accessPublicShare: {
    method: 'GET',
    path: '/api/public/s/:shortCode',
    auth: 'none',
    query: '{ k: string }',
    response: 'AccessShareResponse',
    rateLimit: '100 requests per minute per IP',
  },
  
  // ==========================================
  // Authenticated Share Access
  // ==========================================
  
  /**
   * GET /api/s/:shortCode
   * Access a share with authentication
   * (For 'users' visibility shares)
   * 
   * Response: AccessShareResponse
   */
  accessAuthShare: {
    method: 'GET',
    path: '/api/s/:shortCode',
    auth: 'required',
    response: 'AccessShareResponse',
  },
};

/**
 * URL Patterns for Share Access
 * 
 * Web Routes:
 *   /s/:shortCode           - View share (auth required for 'users' visibility)
 *   /s/:shortCode?k=:key    - View public share
 *   /embed/:shortCode       - Embed share (auth required)
 *   /embed/:shortCode?k=:key - Embed public share
 */
export const urlPatterns = {
  // For authenticated users
  viewShare: '/s/:shortCode',
  embedShare: '/embed/:shortCode',
  
  // For public shares
  viewPublicShare: '/s/:shortCode?k=:key',
  embedPublicShare: '/embed/:shortCode?k=:key',
  
  // Examples:
  // https://yourapp.com/s/AbC123xY?k=a1b2c3d4e5f6...
  // https://yourapp.com/embed/AbC123xY?k=a1b2c3d4e5f6...
};
