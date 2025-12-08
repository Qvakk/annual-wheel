import type { Activity, ActivityType } from "../types/activity";
import type { ActivityTypeConfig } from "../types/admin";
import { defaultActivityTypes } from "../types/admin";
import type { ActivityScope, Holiday, UserContext, TeamInfo, TeamMember, Layer } from "../types/hierarchy";
import { generateHolidays, isTeamMember } from "../types/hierarchy";
import type { PublicHoliday } from "../services/holidayService";
import { fetchPublicHolidays } from "../services/holidayService";

/**
 * Mock data module for the Annual Wheel (Årshjul) planner
 * 
 * This file centralizes all mock data and ensures activities use
 * colors/types from the admin-configured activity types.
 * 
 * Now includes hierarchy support for organization/department/team/personal scopes.
 * 
 * When connecting to Cosmos DB later, replace these exports with API calls
 * while maintaining the same interface.
 */

// Re-export the default activity types for convenience
export { defaultActivityTypes };

/**
 * Helper to get activity type config by key
 */
export function getActivityTypeConfig(
  typeKey: ActivityType,
  types: ActivityTypeConfig[] = defaultActivityTypes
): ActivityTypeConfig | undefined {
  return types.find((t) => t.key === typeKey);
}

/**
 * Helper to get color for an activity type
 */
export function getActivityTypeColor(
  typeKey: ActivityType,
  types: ActivityTypeConfig[] = defaultActivityTypes
): string {
  const config = getActivityTypeConfig(typeKey, types);
  return config?.color ?? "#7A7574"; // Fallback to gray
}

/**
 * Helper to get highlight color for an activity type
 */
export function getActivityTypeHighlightColor(
  typeKey: ActivityType,
  types: ActivityTypeConfig[] = defaultActivityTypes
): string {
  const config = getActivityTypeConfig(typeKey, types);
  return config?.highlightColor ?? "#494645"; // Fallback to dark gray
}

/**
 * Mock organizations
 */
export const mockOrganizations = [
  { id: "org", name:  "Corporation" },
  { id: "org-contoso", name: "Contoso Ltd" },
  { id: "org-fabrikam", name: "Fabrikam Inc" },
];

/**
 * Mock users for testing team membership
 */
export const mockUsers: TeamMember[] = [
  { userId: "mock-user-1", displayName: "Ola Nordmann", email: "ola@acme.com", role: "admin", addedAt: new Date(2025, 0, 1) },
  { userId: "mock-user-2", displayName: "Kari Hansen", email: "kari@acme.com", role: "member", addedAt: new Date(2025, 0, 1) },
  { userId: "mock-user-3", displayName: "Per Johansen", email: "per@acme.com", role: "member", addedAt: new Date(2025, 0, 1) },
  { userId: "mock-user-4", displayName: "Anne Olsen", email: "anne@acme.com", role: "admin", addedAt: new Date(2025, 0, 1) },
];

/**
 * Mock user-created teams/groups with members
 */
export const mockTeams: TeamInfo[] = [
  {
    id: "team-dev",
    displayName: "Development Team",
    description: "Software development and engineering",
    createdBy: "mock-user-1",
    createdAt: new Date(2025, 0, 1),
    organizationId: "org-acme",
    members: [mockUsers[0], mockUsers[1], mockUsers[2]], // Ola (admin), Kari, Per
    color: "#2ECC71",
  },
  {
    id: "team-design",
    displayName: "Design Team",
    description: "UI/UX design and branding",
    createdBy: "mock-user-4",
    createdAt: new Date(2025, 1, 15),
    organizationId: "org-acme",
    members: [mockUsers[3], mockUsers[1]], // Anne (admin), Kari
    color: "#3498DB",
  },
  {
    id: "team-project-alpha",
    displayName: "Project Alpha",
    description: "Cross-functional project team",
    createdBy: "mock-user-1",
    createdAt: new Date(2025, 3, 1),
    organizationId: "org-acme",
    members: [mockUsers[0], mockUsers[1], mockUsers[2], mockUsers[3]], // All users
    color: "#9B59B6",
  },
];

/**
 * Mock admin-configured layers
 */
export const mockLayers: Layer[] = [
  {
    id: "layer-holidays-no",
    name: "Norwegian Holidays",
    description: "Norwegian public holidays (helligdager)",
    type: "holidays",
    color: "#E74C3C",
    ringIndex: 0,
    isVisible: true,
    createdBy: "mock-user-1",
    createdAt: new Date(2025, 0, 1),
    organizationId: "org-acme",
    holidayCountryCode: "NO",
  },
  {
    id: "layer-org",
    name: "Organization",
    description: "Company-wide events and activities",
    type: "organization",
    color: "#9B59B6",
    ringIndex: 1,
    isVisible: true,
    createdBy: "mock-user-1",
    createdAt: new Date(2025, 0, 1),
    organizationId: "org-acme",
  },
  {
    id: "layer-groups",
    name: "Groups",
    description: "Team and group activities",
    type: "custom",
    color: "#2ECC71",
    ringIndex: 2,
    isVisible: true,
    createdBy: "mock-user-1",
    createdAt: new Date(2025, 0, 1),
    organizationId: "org-acme",
  },
];

/**
 * Mock organization info
 */
export const mockHierarchy = {
  organizationId: "org-acme",
  organizationName: "Acme Corporation",
  teams: mockTeams,
  layers: mockLayers,
};

/**
 * Mock data spans from late 2025 into 2026 to be relevant around December 2025
 */

/**
 * Raw mock activity data with scope information
 */
interface MockActivityData {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: ActivityType;
  description?: string;
  scope: ActivityScope; // Now references layer ID
  scopeId: string; // For team activities, this is the team ID
}

const mockActivityData: MockActivityData[] = [
  // === ORGANIZATION-WIDE ACTIVITIES (layer-org) ===
  {
    id: "org-1",
    title: "Budget Period",
    startDate: new Date(2025, 8, 1), // Sept 1, 2025
    endDate: new Date(2025, 11, 15), // Dec 15, 2025
    type: "planning",
    description: "Annual budget planning and approval period",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-2",
    title: "Strategic Planning",
    startDate: new Date(2026, 0, 15), // Jan 15, 2026
    endDate: new Date(2026, 3, 30), // Apr 30, 2026
    type: "planning",
    description: "Strategic planning for next fiscal year",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-3",
    title: "Annual Meeting",
    startDate: new Date(2026, 2, 19), // Mar 19, 2026
    endDate: new Date(2026, 2, 20), // Mar 20, 2026
    type: "meeting",
    description: "Annual general meeting",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-4",
    title: "Christmas Lunch",
    startDate: new Date(2025, 11, 12), // Dec 12, 2025
    endDate: new Date(2025, 11, 12), // Dec 12, 2025
    type: "event",
    description: "Company Christmas lunch",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-5",
    title: "New Year Kickoff",
    startDate: new Date(2026, 0, 8), // Jan 8, 2026
    endDate: new Date(2026, 0, 8), // Jan 8, 2026
    type: "event",
    description: "Company New Year kickoff event",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-6",
    title: "HSE Week",
    startDate: new Date(2026, 4, 4), // May 4, 2026
    endDate: new Date(2026, 4, 8), // May 8, 2026
    type: "training",
    description: "Health, Safety & Environment week",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-7",
    title: "Summer Party",
    startDate: new Date(2026, 5, 19), // Jun 19, 2026
    endDate: new Date(2026, 5, 19),
    type: "event",
    description: "Annual summer celebration",
    scope: "layer-org",
    scopeId: "layer-org",
  },
  {
    id: "org-8",
    title: "Company Conference",
    startDate: new Date(2026, 8, 15), // Sep 15, 2026
    endDate: new Date(2026, 8, 17),
    type: "event",
    description: "Annual company-wide conference",
    scope: "layer-org",
    scopeId: "layer-org",
  },

  // === TEAM/GROUP ACTIVITIES (Development Team) ===
  {
    id: "team-dev-1",
    title: "Q1 Sprint Planning",
    startDate: new Date(2026, 0, 6), // Jan 6, 2026
    endDate: new Date(2026, 0, 7), // Jan 7, 2026
    type: "planning",
    description: "Q1 sprint planning sessions",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-2",
    title: "Code Review Week",
    startDate: new Date(2026, 1, 2), // Feb 2, 2026
    endDate: new Date(2026, 1, 6), // Feb 6, 2026
    type: "review",
    description: "Dedicated code review and refactoring",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-3",
    title: "Release v2.0",
    startDate: new Date(2026, 2, 1), // Mar 1, 2026
    endDate: new Date(2026, 2, 1), // Mar 1, 2026
    type: "deadline",
    description: "Major release deadline",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-4",
    title: "Team Hackathon",
    startDate: new Date(2026, 4, 15), // May 15, 2026
    endDate: new Date(2026, 4, 17), // May 17, 2026
    type: "event",
    description: "Team hackathon event",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-5",
    title: "Architecture Review",
    startDate: new Date(2025, 11, 18), // Dec 18, 2025
    endDate: new Date(2025, 11, 19),
    type: "review",
    description: "System architecture review meeting",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-6",
    title: "Q2 Sprint Planning",
    startDate: new Date(2026, 3, 6), // Apr 6, 2026
    endDate: new Date(2026, 3, 7),
    type: "planning",
    description: "Q2 sprint planning sessions",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-7",
    title: "Tech Debt Cleanup",
    startDate: new Date(2026, 7, 3), // Aug 3, 2026
    endDate: new Date(2026, 7, 14),
    type: "planning",
    description: "Technical debt reduction sprint",
    scope: "layer-groups",
    scopeId: "team-dev",
  },
  {
    id: "team-dev-8",
    title: "Release v3.0",
    startDate: new Date(2026, 8, 1), // Sep 1, 2026
    endDate: new Date(2026, 8, 1),
    type: "deadline",
    description: "Version 3.0 release deadline",
    scope: "layer-groups",
    scopeId: "team-dev",
  },

  // === TEAM/GROUP ACTIVITIES (Design Team) ===
  {
    id: "team-design-1",
    title: "Brand Guidelines Review",
    startDate: new Date(2025, 11, 10), // Dec 10, 2025
    endDate: new Date(2025, 11, 15),
    type: "review",
    description: "Review and update brand guidelines",
    scope: "layer-groups",
    scopeId: "team-design",
  },
  {
    id: "team-design-2",
    title: "Design System Update",
    startDate: new Date(2026, 0, 20), // Jan 20, 2026
    endDate: new Date(2026, 1, 10),
    type: "planning",
    description: "Update component library and design system",
    scope: "layer-groups",
    scopeId: "team-design",
  },
  {
    id: "team-design-3",
    title: "UX Research Sprint",
    startDate: new Date(2026, 2, 15), // Mar 15, 2026
    endDate: new Date(2026, 2, 28),
    type: "review",
    description: "User research and usability testing",
    scope: "layer-groups",
    scopeId: "team-design",
  },
  {
    id: "team-design-4",
    title: "Design Workshop",
    startDate: new Date(2026, 5, 5), // Jun 5, 2026
    endDate: new Date(2026, 5, 6),
    type: "training",
    description: "Design thinking workshop",
    scope: "layer-groups",
    scopeId: "team-design",
  },

  // === TEAM/GROUP ACTIVITIES (Project Alpha) ===
  {
    id: "team-alpha-1",
    title: "Project Kickoff",
    startDate: new Date(2025, 11, 8), // Dec 8, 2025
    endDate: new Date(2025, 11, 9),
    type: "meeting",
    description: "Project Alpha kickoff meeting",
    scope: "layer-groups",
    scopeId: "team-project-alpha",
  },
  {
    id: "team-alpha-2",
    title: "Phase 1 Deadline",
    startDate: new Date(2026, 1, 28), // Feb 28, 2026
    endDate: new Date(2026, 1, 28),
    type: "deadline",
    description: "Phase 1 delivery deadline",
    scope: "layer-groups",
    scopeId: "team-project-alpha",
  },
  {
    id: "team-alpha-3",
    title: "Stakeholder Demo",
    startDate: new Date(2026, 3, 15), // Apr 15, 2026
    endDate: new Date(2026, 3, 15),
    type: "meeting",
    description: "Demo to stakeholders",
    scope: "layer-groups",
    scopeId: "team-project-alpha",
  },
  {
    id: "team-alpha-4",
    title: "Project Launch",
    startDate: new Date(2026, 5, 30), // Jun 30, 2026
    endDate: new Date(2026, 5, 30),
    type: "event",
    description: "Project Alpha launch event",
    scope: "layer-groups",
    scopeId: "team-project-alpha",
  },
];

/**
 * Generate mock activities with colors from activity type configs
 * 
 * @param types - Activity type configurations to use for colors
 * @returns Array of Activity objects with colors from type configs
 */
export function generateMockActivities(
  types: ActivityTypeConfig[] = defaultActivityTypes
): Activity[] {
  return mockActivityData.map((data) => ({
    ...data,
    color: getActivityTypeColor(data.type, types),
    highlightColor: getActivityTypeHighlightColor(data.type, types),
  }));
}

/**
 * Filter activities by user context (returns activities the user should see)
 */
export function filterActivitiesByUserContext(
  activities: Activity[],
  userContext: UserContext,
  layers: Layer[]
): Activity[] {
  return activities.filter((activity) => {
    const layer = layers.find(l => l.id === activity.scope);
    if (!layer) return false;
    
    switch (layer.type) {
      case "holidays":
        // Everyone sees holidays
        return true;
      case "organization":
        // User sees org activities if in same org
        return layer.organizationId === userContext.organizationId;
      case "custom":
        // For group layers, check team membership
        if (activity.scopeId) {
          const team = userContext.teams.find((t) => t.id === activity.scopeId);
          return team ? isTeamMember(team, userContext.userId) : false;
        }
        return true;
      default:
        return false;
    }
  });
}

/**
 * Convert holidays to Activity objects for display in wheel
 */
export function holidaysToActivities(
  holidays: Holiday[],
  types: ActivityTypeConfig[] = defaultActivityTypes,
  layerId: string = "layer-holidays-no"
): Activity[] {
  const holidayColor = getActivityTypeColor("holiday", types);
  const holidayHighlight = getActivityTypeHighlightColor("holiday", types);
  
  return holidays.map((h) => ({
    id: h.id,
    title: h.name, // Use English name
    startDate: h.date,
    endDate: h.endDate || h.date,
    type: "holiday" as ActivityType,
    color: holidayColor,
    highlightColor: holidayHighlight,
    description: h.isNational ? "National holiday" : "Company holiday",
    scope: layerId as ActivityScope,
    scopeId: h.organizationId || "national",
  }));
}

/**
 * Convert PublicHoliday from API to Activity
 */
export function publicHolidaysToActivities(
  holidays: PublicHoliday[],
  types: ActivityTypeConfig[] = defaultActivityTypes,
  layerId: string,
  layerColor?: string
): Activity[] {
  const holidayColor = layerColor || getActivityTypeColor("holiday", types);
  const holidayHighlight = getActivityTypeHighlightColor("holiday", types);
  
  return holidays.map((h) => ({
    id: `${layerId}-${h.id}`,
    title: h.localName || h.name, // Prefer local name
    startDate: h.date,
    endDate: h.date,
    type: "holiday" as ActivityType,
    color: holidayColor,
    highlightColor: holidayHighlight,
    description: `${h.name}${h.isNational ? ' (Public holiday)' : ''}`,
    scope: layerId as ActivityScope,
    scopeId: h.countryCode,
  }));
}

/**
 * Fetch holidays from API for all holiday layers
 */
export async function fetchHolidaysForLayers(
  layers: Layer[],
  types: ActivityTypeConfig[] = defaultActivityTypes
): Promise<Activity[]> {
  const holidayLayers = layers.filter(l => l.type === 'holidays' && l.holidayCountryCode);
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  
  const allHolidayActivities: Activity[] = [];
  
  for (const layer of holidayLayers) {
    try {
      for (const year of years) {
        const holidays = await fetchPublicHolidays(layer.holidayCountryCode!, year);
        const activities = publicHolidaysToActivities(holidays, types, layer.id, layer.color);
        allHolidayActivities.push(...activities);
      }
    } catch (error) {
      console.error(`Failed to fetch holidays for ${layer.holidayCountryCode}:`, error);
      // Fall back to static holidays for Norwegian holidays
      if (layer.holidayCountryCode === 'NO') {
        console.log('Falling back to static Norwegian holidays');
        for (const year of years) {
          const staticHolidays = holidaysToActivities(generateHolidays(year), types, layer.id);
          allHolidayActivities.push(...staticHolidays);
        }
      }
    }
  }
  
  return allHolidayActivities;
}

/**
 * Get all activities for a user including holidays (async version)
 */
export async function getActivitiesForUserAsync(
  userContext: UserContext,
  types: ActivityTypeConfig[] = defaultActivityTypes,
  layers: Layer[] = mockLayers
): Promise<Activity[]> {
  const activities = generateMockActivities(types);
  const userActivities = filterActivitiesByUserContext(activities, userContext, layers);
  
  // Fetch holidays from API for all holiday layers
  const holidayActivities = await fetchHolidaysForLayers(layers, types);
  
  return [...holidayActivities, ...userActivities];
}

/**
 * Get all activities for a user including holidays (sync version - uses static data)
 * @deprecated Use getActivitiesForUserAsync for dynamic holiday fetching
 */
export function getActivitiesForUser(
  userContext: UserContext,
  types: ActivityTypeConfig[] = defaultActivityTypes,
  layers: Layer[] = mockLayers
): Activity[] {
  const activities = generateMockActivities(types);
  const userActivities = filterActivitiesByUserContext(activities, userContext, layers);
  
  // Use static holidays as fallback (sync)
  const holidays = holidaysToActivities(generateHolidays(2025), types);
  const holidays2026 = holidaysToActivities(generateHolidays(2026), types);
  
  return [...holidays, ...holidays2026, ...userActivities];
}

/**
 * Pre-generated mock activities using default type colors
 * Use this for simple cases, or use generateMockActivities() when
 * you need activities with custom type configurations
 */
export const mockActivities: Activity[] = generateMockActivities();

/**
 * Norwegian month names
 */
export const monthNames = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Short Norwegian month names
 */
export const monthNamesShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
