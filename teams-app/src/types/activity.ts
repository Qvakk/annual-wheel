/**
 * Activity type categories
 */
export type ActivityType =
  | "meeting"
  | "deadline"
  | "event"
  | "planning"
  | "review"
  | "training"
  | "holiday"
  | "other";

import type { ActivityScope } from "./hierarchy";

/**
 * A planned activity in the annual wheel
 */
export interface Activity {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: ActivityType;
  color: string;
  highlightColor: string; // Darker color for highlights/borders
  description?: string;
  
  // Scope/hierarchy fields
  scope: ActivityScope; // Who can see this activity
  scopeId: string; // ID of the org/dept/team/user this belongs to
  createdBy?: string; // User ID who created the activity
  createdAt?: Date;
  
  // Repetition fields
  repeatGroupId?: string; // Links all occurrences of a repeated activity
}

/**
 * Form data for creating/editing an activity
 */
export interface ActivityFormData {
  title: string;
  startDate: string; // ISO date string for form input
  endDate: string;
  type: ActivityType;
  color: string;
  description?: string;
  scope: ActivityScope;
  scopeId: string;
}

/**
 * Activity type display info
 */
export const activityTypeLabels: Record<ActivityType, string> = {
  meeting: "Meeting",
  deadline: "Deadline",
  event: "Event",
  planning: "Planning",
  review: "Review",
  training: "Training",
  holiday: "Holiday",
  other: "Other",
};

/**
 * Default colors for activity types
 */
export const activityTypeColors: Record<ActivityType, string> = {
  meeting: "#0078D4",
  deadline: "#D13438",
  event: "#107C10",
  planning: "#8764B8",
  review: "#FF8C00",
  training: "#008272",
  holiday: "#E3008C",
  other: "#7A7574",
};

/**
 * Predefined color palette for activities
 */
export const colorPalette = [
  "#0078D4", // Blue
  "#D13438", // Red
  "#107C10", // Green
  "#8764B8", // Purple
  "#FF8C00", // Orange
  "#008272", // Teal
  "#E3008C", // Magenta
  "#7A7574", // Gray
  "#4F6BED", // Indigo
  "#C239B3", // Plum
  "#00B294", // Cyan
  "#FFB900", // Yellow
];

/**
 * Calculate duration in days between two dates
 */
export function getActivityDuration(activity: Activity): number {
  const diffTime = activity.endDate.getTime() - activity.startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get week number for a date (ISO week)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get day of year (1-365/366)
 */
export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get total days in a year
 */
export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}
