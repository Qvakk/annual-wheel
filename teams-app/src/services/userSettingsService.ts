/**
 * User Settings API Service
 * 
 * Handles user preferences like layer order, visibility, and theme.
 * Data is stored in Azure Table Storage via the Rust API.
 * 
 * API Endpoints:
 * 
 * GET    /api/user/settings       - Get current user's settings
 * PUT    /api/user/settings       - Update user settings
 * DELETE /api/user/settings       - Reset settings to defaults
 * 
 * Table Storage Design:
 * - Table: `usersettings`
 * - PartitionKey: `organizationId`
 * - RowKey: `userId`
 */

import type { UserSettings } from '../types/hierarchy';

// API base URL (from environment or default)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Local storage key prefix for offline/fallback
const LOCAL_STORAGE_PREFIX = 'arshjul-user-settings-';

/**
 * Get user settings from API or local storage fallback
 */
export async function getUserSettings(
  userId: string,
  _organizationId: string // Organization ID is sent via auth context
): Promise<UserSettings | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Auth header would be added by auth interceptor
      },
      credentials: 'include',
    });

    if (response.ok) {
      const settings = await response.json();
      // Cache locally for offline access
      saveToLocalStorage(userId, settings);
      return settings;
    }

    if (response.status === 404) {
      // No settings found, return null (use defaults)
      return null;
    }

    throw new Error(`Failed to fetch settings: ${response.status}`);
  } catch (error) {
    console.warn('Failed to fetch user settings from API, using local storage:', error);
    // Fall back to local storage
    return getFromLocalStorage(userId);
  }
}

/**
 * Save user settings to API and local storage
 */
export async function saveUserSettings(
  settings: UserSettings
): Promise<UserSettings> {
  // Always save locally first (for offline support)
  saveToLocalStorage(settings.userId, settings);

  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        layerOrder: settings.layerOrder,
        layerVisibility: settings.layerVisibility,
        theme: settings.theme,
      }),
    });

    if (response.ok) {
      return await response.json();
    }

    throw new Error(`Failed to save settings: ${response.status}`);
  } catch (error) {
    console.warn('Failed to save user settings to API:', error);
    // Local save already done, return the local version
    return settings;
  }
}

/**
 * Delete user settings (reset to defaults)
 */
export async function deleteUserSettings(userId: string): Promise<void> {
  // Clear local storage
  removeFromLocalStorage(userId);

  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete settings: ${response.status}`);
    }
  } catch (error) {
    console.warn('Failed to delete user settings from API:', error);
  }
}

/**
 * Update specific settings (partial update)
 */
export async function updateUserSettings(
  userId: string,
  organizationId: string,
  updates: Partial<Pick<UserSettings, 'layerOrder' | 'layerVisibility' | 'theme'>>
): Promise<UserSettings> {
  // Get existing settings
  let settings = await getUserSettings(userId, organizationId);
  
  // Create new settings if none exist
  if (!settings) {
    settings = {
      userId,
      organizationId,
      updatedAt: new Date(),
    };
  }

  // Apply updates
  const updatedSettings: UserSettings = {
    ...settings,
    ...updates,
    updatedAt: new Date(),
  };

  return saveUserSettings(updatedSettings);
}

// ============================================
// Local Storage Helpers
// ============================================

function getLocalStorageKey(userId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${userId}`;
}

function saveToLocalStorage(userId: string, settings: UserSettings): void {
  try {
    localStorage.setItem(
      getLocalStorageKey(userId),
      JSON.stringify(settings)
    );
  } catch (error) {
    console.error('Failed to save settings to local storage:', error);
  }
}

function getFromLocalStorage(userId: string): UserSettings | null {
  try {
    const stored = localStorage.getItem(getLocalStorageKey(userId));
    if (stored) {
      const settings = JSON.parse(stored);
      // Convert date string back to Date
      if (settings.updatedAt) {
        settings.updatedAt = new Date(settings.updatedAt);
      }
      return settings;
    }
  } catch (error) {
    console.error('Failed to read settings from local storage:', error);
  }
  return null;
}

function removeFromLocalStorage(userId: string): void {
  try {
    localStorage.removeItem(getLocalStorageKey(userId));
  } catch (error) {
    console.error('Failed to remove settings from local storage:', error);
  }
}

// ============================================
// Layer Order Helpers
// ============================================

/**
 * Save just the layer order preference
 */
export async function saveLayerOrder(
  userId: string,
  organizationId: string,
  layerOrder: string[]
): Promise<void> {
  await updateUserSettings(userId, organizationId, { layerOrder });
}

/**
 * Save just the layer visibility preference
 */
export async function saveLayerVisibility(
  userId: string,
  organizationId: string,
  layerVisibility: Record<string, boolean>
): Promise<void> {
  await updateUserSettings(userId, organizationId, { layerVisibility });
}
