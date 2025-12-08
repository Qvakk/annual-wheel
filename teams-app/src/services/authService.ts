/**
 * Authentication service for Teams SSO
 * Includes Microsoft Graph integration for user context
 */
import * as microsoftTeams from "@microsoft/teams-js";
import type { UserRoles } from "../types/admin";
import type { UserContext, TeamInfo } from "../types/hierarchy";
import { mockTeams, mockUsers } from "../data/mockData";

const ADMIN_ROLE = "admin.write";

// Graph API base URL
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

/**
 * Get the current user's access token via Teams SSO
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await microsoftTeams.authentication.getAuthToken();
    return token;
  } catch (error) {
    console.error("Failed to get access token:", error);
    return null;
  }
}

/**
 * Parse JWT token to extract claims
 * 
 * ⚠️ SECURITY NOTE: This only decodes the JWT, it does NOT verify the signature.
 * Client-side JWT parsing is for display/UX purposes only.
 * All authorization decisions must be made server-side with proper signature verification.
 */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to parse JWT:", error);
    return null;
  }
}

/**
 * Get user roles from the access token
 */
export async function getUserRoles(): Promise<UserRoles> {
  const token = await getAccessToken();
  
  if (!token) {
    return { isAdmin: false, roles: [] };
  }

  const claims = parseJwt(token);
  
  if (!claims) {
    return { isAdmin: false, roles: [] };
  }

  // Roles can be a string or array
  let roles: string[] = [];
  if (Array.isArray(claims.roles)) {
    roles = claims.roles as string[];
  } else if (typeof claims.roles === "string") {
    roles = [claims.roles];
  }

  return {
    isAdmin: roles.includes(ADMIN_ROLE),
    roles,
  };
}

/**
 * Check if user has admin role
 */
export async function isUserAdmin(): Promise<boolean> {
  const { isAdmin } = await getUserRoles();
  return isAdmin;
}

/**
 * Get user info from token
 */
export async function getUserInfo(): Promise<{
  name: string;
  email: string;
  oid: string;
} | null> {
  const token = await getAccessToken();
  
  if (!token) {
    return null;
  }

  const claims = parseJwt(token);
  
  if (!claims) {
    return null;
  }

  return {
    name: (claims.name as string) || "",
    email: (claims.preferred_username as string) || (claims.upn as string) || "",
    oid: (claims.oid as string) || "",
  };
}

/**
 * Call Microsoft Graph API with the access token
 */
async function callGraphApi<T>(endpoint: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Graph API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Graph API call failed:", error);
    return null;
  }
}

/**
 * Get user's joined Teams from Microsoft Graph
 * Note: In production, teams/groups would be fetched from your backend
 * This returns MS Teams but you'd also need to fetch custom groups
 */
export async function getUserTeams(_token: string, userId: string): Promise<TeamInfo[]> {
  // For now, return mock teams where user is a member
  // In production, this would fetch from your backend API
  return mockTeams.filter(team => 
    team.members.some(m => m.userId === userId)
  );
}

/**
 * Get user's profile including department from Microsoft Graph
 */
export async function getUserProfile(token: string): Promise<{
  id: string;
  displayName: string;
  mail: string;
  department?: string;
  jobTitle?: string;
} | null> {
  return callGraphApi("/me?$select=id,displayName,mail,department,jobTitle", token);
}

/**
 * Get organization info from Microsoft Graph
 */
export async function getOrganization(token: string): Promise<{
  id: string;
  displayName: string;
} | null> {
  const response = await callGraphApi<{ value: Array<{ id: string; displayName: string }> }>(
    "/organization?$select=id,displayName",
    token
  );

  if (!response?.value?.[0]) {
    return null;
  }

  return response.value[0];
}

/**
 * Get user's profile photo from Microsoft Graph
 * Returns a blob URL that can be used in img src
 */
export async function getUserPhoto(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${GRAPH_BASE_URL}/me/photo/$value`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Failed to get user photo:", error);
    return null;
  }
}

/**
 * Get complete user context including hierarchy information
 * This combines token claims with Graph API data
 */
export async function getUserContext(): Promise<UserContext | null> {
  const token = await getAccessToken();
  
  if (!token) {
    return null;
  }

  const claims = parseJwt(token);
  if (!claims) {
    return null;
  }

  const userId = (claims.oid as string) || "";

  // Get data from Graph API in parallel
  const [profile, organization, photoUrl] = await Promise.all([
    getUserProfile(token),
    getOrganization(token),
    getUserPhoto(token),
  ]);
  
  // Get user's teams/groups (would be from your backend in production)
  const teams = await getUserTeams(token, userId || profile?.id || "");

  // Build user context from token claims and Graph data
  const userContext: UserContext = {
    // User info
    userId: userId || profile?.id || "",
    displayName: (claims.name as string) || profile?.displayName || "",
    email: (claims.preferred_username as string) || (claims.upn as string) || profile?.mail || "",
    photoUrl: photoUrl || undefined,
    
    // Organization
    organizationId: (claims.tid as string) || organization?.id || "",
    organizationName: organization?.displayName || "Unknown Organization",
    
    // Teams/Groups the user is member of
    teams: teams,
    activeTeamId: teams[0]?.id, // Default to first team
    
    // Metadata
    loadedAt: new Date(),
  };

  return userContext;
}

/**
 * Create mock user context for development/testing
 */
export function createMockUserContext(): UserContext {
  const mockUser = mockUsers[0]; // Ola Nordmann
  const userTeams = mockTeams.filter(team => 
    team.members.some(m => m.userId === mockUser.userId)
  );
  
  return {
    userId: mockUser.userId,
    displayName: mockUser.displayName,
    email: mockUser.email,
    organizationId: "org-acme",
    organizationName: "Acme Corporation",
    teams: userTeams,
    activeTeamId: userTeams[0]?.id,
    loadedAt: new Date(),
  };
}
