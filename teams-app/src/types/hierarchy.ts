/**
 * Organizational hierarchy types for multi-tenant activity management
 * Integrates with Microsoft Graph API via Teams SSO
 */

/**
 * Layer types - admin can create layers of different types
 */
export type LayerType = 'holidays' | 'organization' | 'custom';

/**
 * Admin-configurable layer
 * Layers are created by admins and visible to all users in the organization
 */
export interface Layer {
  id: string;
  name: string;
  description?: string;
  type: LayerType;
  color: string;
  ringIndex: number; // Position on the wheel (0 = innermost)
  isVisible: boolean; // Default visibility for users
  createdBy: string; // userId of admin who created it
  createdAt: Date;
  organizationId: string;
  // Holiday layer specific
  holidayCountryCode?: string; // ISO 3166-1 alpha-2 country code (e.g., 'NO', 'SE')
}

/**
 * Activity scope - now references layer ID
 */
export type ActivityScope = string; // Layer ID

/**
 * Scope display configuration (for backward compatibility)
 */
export interface ScopeConfig {
  id: string;
  label: string;
  color: string;
  ringIndex: number;
}

/**
 * Convert layers to scope configs for the wheel
 */
export function layersToScopeConfigs(layers: Layer[]): ScopeConfig[] {
  return layers
    .filter(l => l.isVisible)
    .sort((a, b) => a.ringIndex - b.ringIndex)
    .map(layer => ({
      id: layer.id,
      label: layer.name,
      color: layer.color,
      ringIndex: layer.ringIndex,
    }));
}

/**
 * Default layers for new organizations
 */
export const defaultLayers: Omit<Layer, 'createdBy' | 'createdAt' | 'organizationId'>[] = [
  { 
    id: 'layer-holidays-no', 
    name: 'Norwegian Holidays', 
    description: 'Norwegian public holidays (helligdager)',
    type: 'holidays', 
    color: '#E74C3C', 
    ringIndex: 0,
    isVisible: true,
    holidayCountryCode: 'NO',
  },
  { 
    id: 'layer-org', 
    name: 'Organization', 
    description: 'Organization-wide events and activities',
    type: 'organization', 
    color: '#9B59B6', 
    ringIndex: 1,
    isVisible: true,
  },
  { 
    id: 'layer-groups', 
    name: 'Groups', 
    description: 'Team and group activities',
    type: 'custom', 
    color: '#2ECC71', 
    ringIndex: 2,
    isVisible: true,
  },
];

/**
 * Get scope config by id (for backward compatibility)
 */
export function getScopeConfig(scopeId: string, layers: Layer[]): ScopeConfig | null {
  const layer = layers.find(l => l.id === scopeId);
  if (!layer) return null;
  return {
    id: layer.id,
    label: layer.name,
    color: layer.color,
    ringIndex: layer.ringIndex,
  };
}

/**
 * Holiday definition
 */
export interface Holiday {
  id: string;
  name: string;
  nameNb?: string; // Norwegian name
  date: Date;
  endDate?: Date; // For multi-day holidays
  isNational: boolean; // National vs company-specific
  organizationId?: string; // If company-specific
  recurring: boolean; // Repeats yearly
}

/**
 * Organization from Microsoft Graph
 */
export interface Organization {
  id: string;
  displayName: string;
  tenantId: string;
}

/**
 * Team/Group member with role
 */
export interface TeamMember {
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  addedAt: Date;
}

/**
 * User-created team/group
 * Teams are created by users and visible only to members
 */
export interface TeamInfo {
  id: string;
  displayName: string;
  description?: string;
  createdBy: string; // userId of creator (always admin)
  createdAt: Date;
  organizationId: string;
  members: TeamMember[];
  color?: string; // Optional custom color for the group
}

/**
 * Check if user is admin of a team
 */
export function isTeamAdmin(team: TeamInfo, userId: string): boolean {
  const member = team.members.find(m => m.userId === userId);
  return member?.role === 'admin' || team.createdBy === userId;
}

/**
 * Check if user is member of a team (includes admins)
 */
export function isTeamMember(team: TeamInfo, userId: string): boolean {
  return team.members.some(m => m.userId === userId);
}

/**
 * User context containing all hierarchy info for the logged-in user
 * This is populated from Teams SSO + Graph API calls
 */
export interface UserContext {
  // User info (from token)
  userId: string;
  displayName: string;
  email: string;
  photoUrl?: string; // Profile photo URL (blob URL from Graph API)
  
  // Organization (from Graph /organization or token tid)
  organizationId: string;
  organizationName: string;
  
  // Teams/Groups the user is member of (user-created groups)
  teams: TeamInfo[];
  
  // Selected/active team for filtering (user can switch)
  activeTeamId?: string;
  
  // Loaded timestamp
  loadedAt: Date;
}

/**
 * Filter state for which layers to show
 * Keys are layer IDs, values are visibility
 */
export type ScopeFilters = Record<string, boolean>;

/**
 * Create default filter state from layers - all visible
 */
export function createDefaultScopeFilters(layers: Layer[]): ScopeFilters {
  const filters: ScopeFilters = {};
  layers.forEach(layer => {
    filters[layer.id] = layer.isVisible;
  });
  return filters;
}

/**
 * User-specific settings stored in Cosmos DB or locally
 */
export interface UserSettings {
  userId: string;
  organizationId: string;
  // Layer order override (array of layer IDs in user's preferred order)
  layerOrder?: string[];
  // Layer visibility overrides
  layerVisibility?: Record<string, boolean>;
  // Other user preferences
  theme?: 'light' | 'dark' | 'system';
  updatedAt: Date;
}

/**
 * Apply user's layer order preference to layers
 */
export function applyUserLayerOrder(layers: Layer[], userOrder?: string[]): Layer[] {
  if (!userOrder || userOrder.length === 0) {
    return layers;
  }
  
  // Create a map of layer ID to new ring index based on user order
  const orderMap = new Map(userOrder.map((id, index) => [id, index]));
  
  return layers.map(layer => {
    const userIndex = orderMap.get(layer.id);
    return {
      ...layer,
      ringIndex: userIndex !== undefined ? userIndex : layer.ringIndex,
    };
  }).sort((a, b) => a.ringIndex - b.ringIndex);
}

/**
 * Default filter state for default layers
 */
export const defaultScopeFilters: ScopeFilters = {
  'layer-holidays-no': true,
  'layer-org': true,
  'layer-groups': true,
};

/**
 * Norwegian national holidays (recurring)
 */
export const norwegianHolidays: Omit<Holiday, 'id'>[] = [
  { name: "New Year's Day", nameNb: "Første nyttårsdag", date: new Date(2025, 0, 1), isNational: true, recurring: true },
  { name: "Palm Sunday", nameNb: "Palmesøndag", date: new Date(2025, 3, 13), isNational: true, recurring: false }, // Varies
  { name: "Maundy Thursday", nameNb: "Skjærtorsdag", date: new Date(2025, 3, 17), isNational: true, recurring: false },
  { name: "Good Friday", nameNb: "Langfredag", date: new Date(2025, 3, 18), isNational: true, recurring: false },
  { name: "Easter Sunday", nameNb: "Første påskedag", date: new Date(2025, 3, 20), isNational: true, recurring: false },
  { name: "Easter Monday", nameNb: "Andre påskedag", date: new Date(2025, 3, 21), isNational: true, recurring: false },
  { name: "Labour Day", nameNb: "Arbeidernes dag", date: new Date(2025, 4, 1), isNational: true, recurring: true },
  { name: "Constitution Day", nameNb: "Grunnlovsdag", date: new Date(2025, 4, 17), isNational: true, recurring: true },
  { name: "Ascension Day", nameNb: "Kristi himmelfartsdag", date: new Date(2025, 4, 29), isNational: true, recurring: false },
  { name: "Whit Sunday", nameNb: "Første pinsedag", date: new Date(2025, 5, 8), isNational: true, recurring: false },
  { name: "Whit Monday", nameNb: "Andre pinsedag", date: new Date(2025, 5, 9), isNational: true, recurring: false },
  { name: "Christmas Day", nameNb: "Første juledag", date: new Date(2025, 11, 25), isNational: true, recurring: true },
  { name: "Boxing Day", nameNb: "Andre juledag", date: new Date(2025, 11, 26), isNational: true, recurring: true },
];

/**
 * Generate holidays with IDs (includes year in ID to avoid duplicates)
 */
export function generateHolidays(year: number = 2025): Holiday[] {
  return norwegianHolidays.map((h, index) => ({
    ...h,
    id: `holiday-${year}-${index + 1}`,
    date: new Date(year, h.date.getMonth(), h.date.getDate()),
    endDate: h.endDate ? new Date(year, h.endDate.getMonth(), h.endDate.getDate()) : undefined,
  }));
}
