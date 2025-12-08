/**
 * Sharing Types and Data Models
 * 
 * Supports two sharing modes:
 * 1. "users" - Requires authentication, respects user roles
 * 2. "public" - Uses a secure key, no authentication required
 * 
 * Public shares have a TTL (Time To Live) of 1 year and need renewal.
 */

/**
 * Sharing visibility mode
 */
export type ShareVisibility = 'users' | 'public';

/**
 * Share link configuration
 * Stored in Cosmos DB with TTL for automatic expiration
 */
export interface ShareLink {
  /** Unique identifier for the share (partition key) */
  id: string;
  
  /** Secure random key for public access (64 chars hex) */
  shareKey: string;
  
  /** Short code for URL (8 chars, alphanumeric) */
  shortCode: string;
  
  /** Visibility mode */
  visibility: ShareVisibility;
  
  /** Organization that created this share */
  organizationId: string;
  
  /** User who created the share */
  createdBy: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Expiration timestamp (TTL) */
  expiresAt: Date;
  
  /** Last renewed timestamp */
  renewedAt?: Date;
  
  /** Optional friendly name for the share */
  name?: string;
  
  /** Optional description */
  description?: string;
  
  /** Layer configuration for this share */
  layerConfig: ShareLayerConfig;
  
  /** View settings */
  viewSettings: ShareViewSettings;
  
  /** Access statistics */
  stats: ShareStats;
  
  /** Whether the share is active */
  isActive: boolean;
  
  /** Cosmos DB TTL in seconds (auto-calculated from expiresAt) */
  ttl?: number;
}

/**
 * Layer configuration for a share
 * Defines which layers are visible and their settings
 */
export interface ShareLayerConfig {
  /** Layer IDs to include in this share */
  layerIds: string[];
  
  /** Optional: Override layer visibility (key = layerId) */
  layerVisibility?: Record<string, boolean>;
  
  /** Year to display (defaults to current year) */
  year?: number;
}

/**
 * View settings for a share
 */
export interface ShareViewSettings {
  /** Theme: light, dark, or auto */
  theme: 'light' | 'dark' | 'auto';
  
  /** Show legend at bottom */
  showLegend: boolean;
  
  /** Show title header */
  showTitle: boolean;
  
  /** Custom title (overrides default) */
  customTitle?: string;
  
  /** Allow interaction (hover tooltips) */
  allowInteraction: boolean;
  
  /** Auto-rotate to current month */
  rotateToCurrentMonth: boolean;
}

/**
 * Access statistics for a share
 */
export interface ShareStats {
  /** Total view count */
  viewCount: number;
  
  /** Last accessed timestamp */
  lastAccessedAt?: Date;
  
  /** Unique visitors (approximate, based on IP hash) */
  uniqueVisitors?: number;
}

/**
 * Request to create a new share
 */
export interface CreateShareRequest {
  /** Visibility mode */
  visibility: ShareVisibility;
  
  /** Optional friendly name */
  name?: string;
  
  /** Optional description */
  description?: string;
  
  /** Layer configuration */
  layerConfig: ShareLayerConfig;
  
  /** View settings */
  viewSettings?: Partial<ShareViewSettings>;
}

/**
 * Response when creating a share
 */
export interface CreateShareResponse {
  /** The created share link */
  share: ShareLink;
  
  /** Full URL for sharing */
  shareUrl: string;
  
  /** Embed code for iframes */
  embedCode: string;
}

/**
 * Request to access a public share
 */
export interface AccessShareRequest {
  /** Short code from URL */
  shortCode: string;
  
  /** Share key for verification */
  key: string;
}

/**
 * Response when accessing a share (public)
 */
export interface AccessShareResponse {
  /** Whether access is granted */
  success: boolean;
  
  /** Error message if access denied */
  error?: string;
  
  /** Share configuration (if access granted) */
  config?: {
    layers: ShareLayerConfig;
    viewSettings: ShareViewSettings;
    organizationName: string;
    title: string;
  };
  
  /** Activities for the share (if access granted) */
  activities?: ShareActivity[];
}

/**
 * Simplified activity for public shares
 * Excludes sensitive data like createdBy, team details
 */
export interface ShareActivity {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: string;
  color: string;
  highlightColor: string;
  layerId: string;
  description?: string;
}

/**
 * Request to renew a share (extend TTL)
 */
export interface RenewShareRequest {
  /** Share ID */
  shareId: string;
  
  /** New expiration date (max 1 year from now) */
  newExpiresAt?: Date;
}

/**
 * List shares for an organization
 */
export interface ListSharesRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Filter by visibility */
  visibility?: ShareVisibility;
  
  /** Filter by active status */
  isActive?: boolean;
  
  /** Pagination */
  pageSize?: number;
  continuationToken?: string;
}

/**
 * Response for listing shares
 */
export interface ListSharesResponse {
  shares: ShareLink[];
  continuationToken?: string;
  totalCount: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a secure random key (64 hex characters = 256 bits)
 */
export function generateShareKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a short code for URLs (8 alphanumeric characters)
 */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // Exclude confusing chars
  let result = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Calculate TTL in seconds from expiration date
 */
export function calculateTtl(expiresAt: Date): number {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Create default view settings
 */
export function createDefaultViewSettings(): ShareViewSettings {
  return {
    theme: 'light',
    showLegend: true,
    showTitle: true,
    allowInteraction: true,
    rotateToCurrentMonth: true,
  };
}

/**
 * Create a new share link object
 */
export function createShareLink(
  request: CreateShareRequest,
  organizationId: string,
  userId: string
): ShareLink {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year TTL
  
  return {
    id: crypto.randomUUID(),
    shareKey: generateShareKey(),
    shortCode: generateShortCode(),
    visibility: request.visibility,
    organizationId,
    createdBy: userId,
    createdAt: now,
    expiresAt,
    name: request.name,
    description: request.description,
    layerConfig: request.layerConfig,
    viewSettings: {
      ...createDefaultViewSettings(),
      ...request.viewSettings,
    },
    stats: {
      viewCount: 0,
    },
    isActive: true,
    ttl: calculateTtl(expiresAt),
  };
}

/**
 * Build share URL from share link
 */
export function buildShareUrl(share: ShareLink, baseUrl: string): string {
  if (share.visibility === 'public') {
    return `${baseUrl}/s/${share.shortCode}?k=${share.shareKey}`;
  }
  // For 'users' visibility, just use short code (auth required)
  return `${baseUrl}/s/${share.shortCode}`;
}

/**
 * Build embed code for iframe
 */
export function buildEmbedCode(share: ShareLink, baseUrl: string): string {
  const url = share.visibility === 'public'
    ? `${baseUrl}/embed/${share.shortCode}?k=${share.shareKey}`
    : `${baseUrl}/embed/${share.shortCode}`;
  
  return `<iframe src="${url}" width="600" height="600" frameborder="0" title="${share.name || 'Annual Wheel'}"></iframe>`;
}

/**
 * Validate share key format
 */
export function isValidShareKey(key: string): boolean {
  return /^[a-f0-9]{64}$/i.test(key);
}

/**
 * Validate short code format
 */
export function isValidShortCode(code: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(code);
}

/**
 * Check if share is expired
 */
export function isShareExpired(share: ShareLink): boolean {
  return new Date() > new Date(share.expiresAt);
}

/**
 * Check if share needs renewal (within 30 days of expiry)
 */
export function shareNeedsRenewal(share: ShareLink): boolean {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(share.expiresAt);
  return expiresAt.getTime() - Date.now() < thirtyDaysMs;
}
