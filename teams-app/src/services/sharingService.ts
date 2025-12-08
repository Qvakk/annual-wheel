/**
 * Sharing API Service
 * 
 * Handles creation, access, and management of share links.
 * 
 * API Endpoints (when backend is implemented):
 * 
 * POST   /api/shares              - Create a new share
 * GET    /api/shares              - List shares for organization
 * GET    /api/shares/:id          - Get share details (authenticated)
 * PUT    /api/shares/:id          - Update share settings
 * DELETE /api/shares/:id          - Delete/deactivate share
 * POST   /api/shares/:id/renew    - Renew share TTL
 * 
 * Public access (no auth):
 * GET    /api/public/s/:shortCode?k=:key  - Access public share
 */

import type {
  ShareLink,
  CreateShareRequest,
  CreateShareResponse,
  AccessShareRequest,
  AccessShareResponse,
  RenewShareRequest,
  ListSharesRequest,
  ListSharesResponse,
  ShareActivity,
} from '../types/sharing';

import {
  createShareLink,
  buildShareUrl,
  buildEmbedCode,
  isValidShareKey,
  isValidShortCode,
  isShareExpired,
  generateShareKey,
} from '../types/sharing';

// Base URL for share links (would come from environment in production)
const BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : 'https://yourapp.azurestaticapps.net';

// Mock storage for development (replace with Cosmos DB in production)
const mockShares: Map<string, ShareLink> = new Map();
const mockSharesByShortCode: Map<string, string> = new Map(); // shortCode -> id

/**
 * Create a new share link
 */
export async function createShare(
  request: CreateShareRequest,
  organizationId: string,
  userId: string
): Promise<CreateShareResponse> {
  // Create the share link
  const share = createShareLink(request, organizationId, userId);
  
  // In production: Save to Cosmos DB
  // await cosmosContainer.items.create(share);
  
  // Mock: Store in memory
  mockShares.set(share.id, share);
  mockSharesByShortCode.set(share.shortCode, share.id);
  
  // TODO: Remove in production or use proper logging service
  if (import.meta.env.DEV) {
    console.log('Created share:', {
      id: share.id,
      shortCode: share.shortCode,
      visibility: share.visibility,
    });
  }
  
  return {
    share,
    shareUrl: buildShareUrl(share, BASE_URL),
    embedCode: buildEmbedCode(share, BASE_URL),
  };
}

/**
 * Access a public share using short code and key
 */
export async function accessPublicShare(
  request: AccessShareRequest
): Promise<AccessShareResponse> {
  const { shortCode, key } = request;
  
  // Validate input format
  if (!isValidShortCode(shortCode)) {
    return { success: false, error: 'Invalid share code' };
  }
  
  if (!isValidShareKey(key)) {
    return { success: false, error: 'Invalid share key' };
  }
  
  // In production: Query Cosmos DB by shortCode
  // const { resources } = await cosmosContainer.items
  //   .query({ query: 'SELECT * FROM c WHERE c.shortCode = @code', parameters: [{ name: '@code', value: shortCode }] })
  //   .fetchAll();
  
  // Mock: Look up in memory
  const shareId = mockSharesByShortCode.get(shortCode);
  if (!shareId) {
    return { success: false, error: 'Share not found' };
  }
  
  const share = mockShares.get(shareId);
  if (!share) {
    return { success: false, error: 'Share not found' };
  }
  
  // Verify key matches
  if (share.shareKey !== key) {
    return { success: false, error: 'Invalid share key' };
  }
  
  // Check if share is active
  if (!share.isActive) {
    return { success: false, error: 'Share has been deactivated' };
  }
  
  // Check if share is expired
  if (isShareExpired(share)) {
    return { success: false, error: 'Share has expired' };
  }
  
  // Update access stats
  share.stats.viewCount++;
  share.stats.lastAccessedAt = new Date();
  
  // In production: Update stats in Cosmos DB (async, don't await)
  // cosmosContainer.item(share.id, share.organizationId).replace(share);
  
  // Return share configuration and activities
  // In production: Fetch activities from database filtered by layerConfig
  const activities = await getActivitiesForShare(share);
  
  return {
    success: true,
    config: {
      layers: share.layerConfig,
      viewSettings: share.viewSettings,
      organizationName: 'Organization', // Would come from org lookup
      title: share.viewSettings.customTitle || share.name || 'Annual Wheel',
    },
    activities,
  };
}

/**
 * Access a share that requires authentication (visibility: 'users')
 */
export async function accessAuthenticatedShare(
  shortCode: string,
  _userId: string,
  organizationId: string
): Promise<AccessShareResponse> {
  if (!isValidShortCode(shortCode)) {
    return { success: false, error: 'Invalid share code' };
  }
  
  // Look up share
  const shareId = mockSharesByShortCode.get(shortCode);
  if (!shareId) {
    return { success: false, error: 'Share not found' };
  }
  
  const share = mockShares.get(shareId);
  if (!share) {
    return { success: false, error: 'Share not found' };
  }
  
  // For 'users' visibility, verify organization membership
  if (share.visibility === 'users' && share.organizationId !== organizationId) {
    return { success: false, error: 'Access denied - not in organization' };
  }
  
  // Check if share is active
  if (!share.isActive) {
    return { success: false, error: 'Share has been deactivated' };
  }
  
  // Check if share is expired
  if (isShareExpired(share)) {
    return { success: false, error: 'Share has expired' };
  }
  
  // Update access stats
  share.stats.viewCount++;
  share.stats.lastAccessedAt = new Date();
  
  const activities = await getActivitiesForShare(share);
  
  return {
    success: true,
    config: {
      layers: share.layerConfig,
      viewSettings: share.viewSettings,
      organizationName: 'Organization',
      title: share.viewSettings.customTitle || share.name || 'Annual Wheel',
    },
    activities,
  };
}

/**
 * Get activities for a share based on layer configuration
 * In production: Query Cosmos DB with layer filters
 */
async function getActivitiesForShare(_share: ShareLink): Promise<ShareActivity[]> {
  // In production: Query activities from Cosmos DB
  // const { resources } = await cosmosContainer.items
  //   .query({
  //     query: 'SELECT * FROM c WHERE c.organizationId = @orgId AND ARRAY_CONTAINS(@layers, c.scope)',
  //     parameters: [
  //       { name: '@orgId', value: _share.organizationId },
  //       { name: '@layers', value: _share.layerConfig.layerIds },
  //     ]
  //   })
  //   .fetchAll();
  
  // Mock: Return empty array (would be populated from database)
  return [];
}

/**
 * List shares for an organization
 */
export async function listShares(
  request: ListSharesRequest
): Promise<ListSharesResponse> {
  const { organizationId, visibility, isActive, pageSize = 20 } = request;
  
  // In production: Query Cosmos DB with filters and pagination
  // const querySpec = {
  //   query: 'SELECT * FROM c WHERE c.organizationId = @orgId',
  //   parameters: [{ name: '@orgId', value: organizationId }]
  // };
  
  // Mock: Filter in memory
  let shares = Array.from(mockShares.values())
    .filter(s => s.organizationId === organizationId);
  
  if (visibility !== undefined) {
    shares = shares.filter(s => s.visibility === visibility);
  }
  
  if (isActive !== undefined) {
    shares = shares.filter(s => s.isActive === isActive);
  }
  
  // Sort by creation date descending
  shares.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Paginate
  const paginatedShares = shares.slice(0, pageSize);
  
  return {
    shares: paginatedShares,
    totalCount: shares.length,
    continuationToken: shares.length > pageSize ? 'mock-token' : undefined,
  };
}

/**
 * Get a share by ID
 */
export async function getShare(
  shareId: string,
  organizationId: string
): Promise<ShareLink | null> {
  // In production: Query Cosmos DB
  // const { resource } = await cosmosContainer.item(shareId, organizationId).read();
  
  const share = mockShares.get(shareId);
  if (!share || share.organizationId !== organizationId) {
    return null;
  }
  
  return share;
}

/**
 * Update share settings
 */
export async function updateShare(
  shareId: string,
  organizationId: string,
  updates: Partial<Pick<ShareLink, 'name' | 'description' | 'layerConfig' | 'viewSettings' | 'isActive'>>
): Promise<ShareLink | null> {
  const share = await getShare(shareId, organizationId);
  if (!share) {
    return null;
  }
  
  // Apply updates
  Object.assign(share, updates);
  
  // In production: Update in Cosmos DB
  // await cosmosContainer.item(shareId, organizationId).replace(share);
  
  mockShares.set(shareId, share);
  
  return share;
}

/**
 * Renew a share (extend TTL)
 */
export async function renewShare(
  request: RenewShareRequest,
  organizationId: string
): Promise<ShareLink | null> {
  const share = await getShare(request.shareId, organizationId);
  if (!share) {
    return null;
  }
  
  // Calculate new expiration (max 1 year from now)
  const maxExpiry = new Date();
  maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
  
  const newExpiry = request.newExpiresAt 
    ? new Date(Math.min(request.newExpiresAt.getTime(), maxExpiry.getTime()))
    : maxExpiry;
  
  share.expiresAt = newExpiry;
  share.renewedAt = new Date();
  // TTL in seconds from now until expiry
  share.ttl = Math.floor((newExpiry.getTime() - Date.now()) / 1000);
  
  // Optionally regenerate key for security
  // share.shareKey = generateShareKey();
  
  // In production: Update in Cosmos DB
  // await cosmosContainer.item(share.id, organizationId).replace(share);
  
  mockShares.set(share.id, share);
  
  return share;
}

/**
 * Delete/deactivate a share
 */
export async function deleteShare(
  shareId: string,
  organizationId: string,
  hardDelete: boolean = false
): Promise<boolean> {
  const share = await getShare(shareId, organizationId);
  if (!share) {
    return false;
  }
  
  if (hardDelete) {
    // In production: Delete from Cosmos DB
    // await cosmosContainer.item(shareId, organizationId).delete();
    mockShares.delete(shareId);
    mockSharesByShortCode.delete(share.shortCode);
  } else {
    // Soft delete: just deactivate
    share.isActive = false;
    mockShares.set(shareId, share);
  }
  
  return true;
}

/**
 * Regenerate share key (for security)
 */
export async function regenerateShareKey(
  shareId: string,
  organizationId: string
): Promise<{ share: ShareLink; shareUrl: string; embedCode: string } | null> {
  const share = await getShare(shareId, organizationId);
  if (!share) {
    return null;
  }
  
  // Generate new key
  share.shareKey = generateShareKey();
  
  // In production: Update in Cosmos DB
  // await cosmosContainer.item(share.id, organizationId).replace(share);
  
  mockShares.set(share.id, share);
  
  return {
    share,
    shareUrl: buildShareUrl(share, BASE_URL),
    embedCode: buildEmbedCode(share, BASE_URL),
  };
}
