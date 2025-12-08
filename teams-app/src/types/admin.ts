/**
 * Admin types for managing activity types and settings
 */

/**
 * Available icon identifiers for activity types
 */
export type ActivityIcon =
  | "calendar"
  | "people"
  | "clock"
  | "flag"
  | "star"
  | "heart"
  | "lightning"
  | "target"
  | "briefcase"
  | "book"
  | "graduation"
  | "beach"
  | "plane"
  | "gift"
  | "megaphone"
  | "chart"
  | "checkmark"
  | "warning"
  | "info"
  | "question"
  | "bulb"
  | "tools"
  | "rocket"
  | "trophy";

/**
 * Icon SVG paths (Fluent UI style)
 */
export const activityIconPaths: Record<ActivityIcon, string> = {
  calendar: "M17.75 3A3.25 3.25 0 0 1 21 6.25v11.5A3.25 3.25 0 0 1 17.75 21H6.25A3.25 3.25 0 0 1 3 17.75V6.25A3.25 3.25 0 0 1 6.25 3h11.5Zm1.75 5.5h-15v9.25c0 .966.784 1.75 1.75 1.75h11.5a1.75 1.75 0 0 0 1.75-1.75V8.5Zm-11.75 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-4.25-4a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm1.5-6H6.25A1.75 1.75 0 0 0 4.5 6.25V7h15v-.75a1.75 1.75 0 0 0-1.75-1.75Z",
  people: "M14.75 15c.966 0 1.75.784 1.75 1.75l-.001.962c.117 2.19-1.511 4.038-4.171 4.27-.453.04-.92.018-1.378.018-2.618 0-4.592-.852-5.318-2.54a3.643 3.643 0 0 1-.132-.418l-.062-.252-.036-.186-.033-.223-.022-.186-.013-.162-.007-.128L5.25 17.75c0-.966.784-1.75 1.75-1.75h7.75ZM11 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm7 6a4 4 0 0 1 2.355 7.235l-.164.111.14.013a2.5 2.5 0 0 1 2.163 2.205l.006.186v1.5a.75.75 0 0 1-1.493.102L21 19.25v-1.5a1 1 0 0 0-.883-.993L20 16.75h-1.75a.75.75 0 0 1-.102-1.493L18.25 15.25h.027l.065-.001a2.5 2.5 0 0 0-.018-4.998l-.074-.001h-.012a.75.75 0 0 1 0-1.5H18Zm-7-4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  clock: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 6a.75.75 0 0 1 .75.75v4.773l3.22 1.61a.75.75 0 0 1-.671 1.341l-3.553-1.776a.75.75 0 0 1-.496-.706v-5.242A.75.75 0 0 1 12 6Z",
  flag: "M4.75 2a.75.75 0 0 1 .75.75v.749L18.75 4A1.25 1.25 0 0 1 20 5.25v7a1.25 1.25 0 0 1-1.072 1.238l-.178.012H5.5v7.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 4.75 2ZM5.5 5.5v6.5h13v-6.5h-13Z",
  star: "M10.788 3.103c.495-1.004 1.926-1.004 2.421 0l2.358 4.777 5.273.766c1.107.161 1.549 1.522.748 2.303l-3.816 3.72.901 5.25c.19 1.103-.968 1.944-1.959 1.424l-4.716-2.48-4.715 2.48c-.99.52-2.148-.32-1.96-1.424l.901-5.25-3.815-3.72c-.801-.78-.359-2.142.748-2.303L6.43 7.88l2.358-4.777Z",
  heart: "M12.82 5.58l-.82.822-.824-.824a5.375 5.375 0 1 0-7.601 7.602l7.895 7.895a.75.75 0 0 0 1.06 0l7.902-7.897a5.376 5.376 0 0 0-.001-7.599 5.38 5.38 0 0 0-7.611 0Z",
  lightning: "M11.197 2.44a.75.75 0 0 1 .615-.186l.098.02a.75.75 0 0 1 .503.465l.036.117 1.86 8.36h5.94a.75.75 0 0 1 .682 1.058l-.053.092-8.25 12a.75.75 0 0 1-1.342-.487l-.005-.11.002-7.519H5.75a.75.75 0 0 1-.735-.894l.033-.107 5.502-12.5a.75.75 0 0 1 .647-.309Z",
  target: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  briefcase: "M6.25 5h1.257a3.25 3.25 0 0 1 6.24-.746l.11.277.143.469h3.75a3.25 3.25 0 0 1 3.245 3.065L21 8.25v9.5a3.25 3.25 0 0 1-3.066 3.245L17.75 21H6.25a3.25 3.25 0 0 1-3.245-3.066L3 17.75v-9.5a3.25 3.25 0 0 1 3.066-3.245L6.25 5Zm0 1.5a1.75 1.75 0 0 0-1.744 1.606L4.5 8.25v9.5a1.75 1.75 0 0 0 1.606 1.744l.144.006h11.5a1.75 1.75 0 0 0 1.744-1.607l.006-.143v-9.5a1.75 1.75 0 0 0-1.607-1.744L17.75 6.5H6.25ZM12 3.5a1.75 1.75 0 0 0-1.647 1.163l-.044.148L10.11 5.5h3.535l-.107-.35a1.75 1.75 0 0 0-1.386-1.143L12 3.5Z",
  book: "M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v14.25a.75.75 0 0 1-.75.75H5.5a1 1 0 0 0 1 1h13.25a.75.75 0 0 1 0 1.5H6.5A2.5 2.5 0 0 1 4 19.5v-15Zm1.5 0v12.326A2.49 2.49 0 0 1 6.5 16.5h12v-12a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1Z",
  graduation: "M12.894 2.553a1.75 1.75 0 0 0-1.788 0L2.354 7.553A1.75 1.75 0 0 0 1.5 9.086v5.664a.75.75 0 0 0 1.5 0v-4.728l1.5.879v4.349c0 .704.347 1.37.926 1.782l.141.091 5.539 3.249a1.75 1.75 0 0 0 1.788 0l5.539-3.249a2.25 2.25 0 0 0 1.067-1.873V10.9l2.646-1.551a1.75 1.75 0 0 0 0-3.007l-8.752-5.34ZM18 12.15l-5.106 2.994a1.75 1.75 0 0 1-1.788 0L6 12.15v3.1c0 .235.115.457.31.594l.116.07 5.574 3.27 5.574-3.27a.75.75 0 0 0 .42-.593L18 15.25v-3.1Zm-6-8.15.072.037 7.952 4.851-7.952 4.664a.25.25 0 0 1-.144.048l-.072-.012-.072-.036-7.952-4.664 7.952-4.851a.25.25 0 0 1 .216-.037Z",
  beach: "M17.416 2.624a.75.75 0 0 1 .958.45l.036.111 1.5 6a.75.75 0 0 1-1.417.484l-.036-.11-.234-.937-5.473 2.128v10.5a.75.75 0 0 1-.648.743L12 22a.75.75 0 0 1-.743-.648L11.25 21.25v-10.5l-5.473-2.128-.234.937a.75.75 0 0 1-.87.561l-.107-.026a.75.75 0 0 1-.562-.87l.027-.107 1.5-6a.75.75 0 0 1 .926-.564l.107.034L12 4.967l5.436-2.38a.75.75 0 0 1 .98.038Z",
  plane: "M21.673 2.328a2.5 2.5 0 0 1 .127 3.392l-.127.138-5.53 5.53 1.964 7.856a1.5 1.5 0 0 1-.325 1.358l-.103.11-1.586 1.585a1.5 1.5 0 0 1-2.311.192l-.1-.117-3.932-5.244-3.543 3.543a1.5 1.5 0 0 1-.974.433l-.147.006H3.75a.75.75 0 0 1-.713-.514l-.024-.1-.263-1.576a1.5 1.5 0 0 1 .306-1.214l.102-.112 3.543-3.543-5.244-3.932a1.5 1.5 0 0 1-.152-2.203l.077-.108 1.586-1.586a1.5 1.5 0 0 1 1.247-.43l.12.016 7.858 1.965 5.528-5.528a2.5 2.5 0 0 1 3.53 0Z",
  gift: "M12.75 14v7.75H17a2.25 2.25 0 0 0 2.245-2.096L19.25 19.5v-5.5h-6.5Zm-1.5 0h-6.5v5.5a2.25 2.25 0 0 0 2.096 2.245L7 21.75h4.25V14Zm0-6.5H5.756a2.25 2.25 0 0 0-2.25 2.096l-.006.154v2.5h7.75V7.5Zm6.494 0H12.75v4.75h7.75v-2.5a2.25 2.25 0 0 0-2.096-2.245L18.244 7.5ZM12 2a3.5 3.5 0 0 1 3.163 5.015l.081-.015H17.744a3.75 3.75 0 0 1 3.745 3.55l.005.2v8.5a3.75 3.75 0 0 1-3.55 3.745L17.744 23H6.244a3.75 3.75 0 0 1-3.745-3.55L2.494 19.25v-8.5a3.75 3.75 0 0 1 3.55-3.745l.2-.005h2.5l.08.015A3.5 3.5 0 0 1 12 2Zm0 1.5a2 2 0 0 0-.15 3.995L12 7.5h.15A2 2 0 0 0 12 3.5Z",
  megaphone: "M18.251 2.001a1.75 1.75 0 0 1 1.743 1.606l.006.144v16.5a1.75 1.75 0 0 1-2.524 1.57l-.128-.071-6.86-4.287a6.888 6.888 0 0 1-.963.107l-.275.016H8c-.966 0-1.75.784-1.75 1.75v2.914a.75.75 0 0 1-1.493.102L4.75 22.25v-2.914A3.25 3.25 0 0 1 7.824 16.1l.176-.008V5.994l-.176-.008a3.25 3.25 0 0 1-3.068-3.066L4.75 2.751a.75.75 0 0 1 1.493-.102l.007.102a1.75 1.75 0 0 0 1.606 1.743l.144.006h1.25c.12 0 .24.006.358.016l.154.015 6.736-4.21.13-.068a1.75 1.75 0 0 1 1.623.098l.001-.35Z",
  chart: "M3 3.75A.75.75 0 0 1 3.75 3h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 3.75ZM3 20.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75ZM6.25 8A2.25 2.25 0 0 0 4 10.25v3.5A2.25 2.25 0 0 0 6.25 16h.5A2.25 2.25 0 0 0 9 13.75v-3.5A2.25 2.25 0 0 0 6.75 8h-.5Zm5 0A2.25 2.25 0 0 0 9 10.25v3.5A2.25 2.25 0 0 0 11.25 16h1.5A2.25 2.25 0 0 0 15 13.75v-3.5A2.25 2.25 0 0 0 12.75 8h-1.5Zm5 0A2.25 2.25 0 0 0 14 10.25v3.5A2.25 2.25 0 0 0 16.25 16h1.5A2.25 2.25 0 0 0 20 13.75v-3.5A2.25 2.25 0 0 0 17.75 8h-1.5Z",
  checkmark: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.22 6.97-4.47 4.47-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5a.75.75 0 1 0-1.06-1.06Z",
  warning: "M10.91 2.782a2.25 2.25 0 0 1 2.975.74l.083.138 7.759 14.009a2.25 2.25 0 0 1-1.814 3.334l-.154.006H4.243a2.25 2.25 0 0 1-2.041-3.197l.072-.143L10.031 3.66a2.25 2.25 0 0 1 .878-.878ZM12 16.002a.999.999 0 1 0 0 1.997.999.999 0 0 0 0-1.997ZM12 8.5a.75.75 0 0 0-.743.648l-.007.102v4.5a.75.75 0 0 0 1.493.102l.007-.102v-4.5A.75.75 0 0 0 12 8.5Z",
  info: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 9h-.01a.75.75 0 0 0-.74.648l-.007.102v4.5a.76.76 0 0 0 .758.75.75.75 0 0 0 .742-.648l.007-.102v-4.5a.75.75 0 0 0-.75-.75Zm.01-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  question: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-9.5a3.5 3.5 0 0 0-3.5 3.5.75.75 0 0 0 1.5 0 2 2 0 1 1 4 0c0 .818-.395 1.293-1.188 2.006l-.169.149c-.985.876-1.393 1.555-1.393 2.595a.75.75 0 0 0 1.5 0c0-.521.205-.852.845-1.424l.227-.198c1.108-.97 1.678-1.761 1.678-3.128A3.5 3.5 0 0 0 12 6.5Z",
  bulb: "M12 2a7.5 7.5 0 0 1 5 13.082V17.5a2.5 2.5 0 0 1-2.336 2.495L14.5 20h-5a2.5 2.5 0 0 1-2.495-2.336L7 17.5v-2.418A7.5 7.5 0 0 1 12 2Zm2.5 16.5h-5a1 1 0 0 0-.993.883L8.5 19.5h7a1 1 0 0 0 .993-.883L16.5 18.5h-2Zm-.5 2h-4a.5.5 0 0 0-.09.992L10 21.5h4a.5.5 0 0 0 .09-.992L14 20.5ZM12 3.5a6 6 0 0 0-3.5 10.876V17.5a1 1 0 0 0 .883.993L9.5 18.5h5a1 1 0 0 0 .993-.883L15.5 17.5v-3.124A6 6 0 0 0 12 3.5Z",
  tools: "M17.5 3a4.5 4.5 0 0 0-4.206 6.088l-7.616 7.616a2.25 2.25 0 1 0 3.182 3.182l7.616-7.616A4.5 4.5 0 1 0 17.5 3Zm0 1.5a3 3 0 0 1 1.293 5.708.75.75 0 0 0-.293.594v.003a.75.75 0 0 0 .22.532l.057.05a.75.75 0 0 0-.22.532v.003a.75.75 0 0 0 .44.683A3 3 0 1 1 17.5 4.5Zm-9.439 8.5 1.439 1.439-6.793 6.793a.75.75 0 0 1-1.061-1.061L8.061 13Z",
  rocket: "M13.287 2.426a3.5 3.5 0 0 1 4.547.614l.145.163 2.818 3.384a3.5 3.5 0 0 1 .607 3.21l-.08.213-5.027 11.296a1.75 1.75 0 0 1-2.934.463l-.104-.127-2.505-3.34-.006.006-2.11 2.11a.75.75 0 0 1-.976.073l-.084-.073-4.5-4.5a.75.75 0 0 1 .073-.976l.073-.084 2.11-2.11.006-.006-3.34-2.505a1.75 1.75 0 0 1-.38-2.342l.09-.125.127-.145L12.734 2.6l.553-.174ZM17.5 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  trophy: "M6.5 2h11a.5.5 0 0 1 .5.5V4h2.5a.5.5 0 0 1 .5.5v3a4.5 4.5 0 0 1-4.293 4.493C15.986 14.265 14.154 16 12 16c-2.154 0-3.986-1.735-4.707-3.993A4.5 4.5 0 0 1 3 7.5v-3a.5.5 0 0 1 .5-.5H6V2.5a.5.5 0 0 1 .5-.5ZM6 5.5H4.5v2a3 3 0 0 0 2.236 2.897l.264.057V5.5Zm11.5 0v5.054l.264-.107A3 3 0 0 0 19.5 7.5v-2H18v.001h-.5ZM17 3.5H7V14c0 2.485 2.239 4.5 5 4.5s5-2.015 5-4.5V3.5Z",
};

/**
 * Configurable activity type definition
 */
export interface ActivityTypeConfig {
  id: string;
  key: string; // Internal key like "meeting", "deadline"
  label: string; // Display label
  color: string; // RGB hex color
  highlightColor: string; // Darker color for highlights/borders
  icon: ActivityIcon; // Icon identifier
  description?: string;
  isDefault?: boolean; // Can't be deleted if true
  sortOrder: number;
}

/**
 * Form data for creating/editing activity types
 */
export interface ActivityTypeFormData {
  key: string;
  label: string;
  color: string;
  icon: ActivityIcon;
  description?: string;
}

/**
 * Helper to darken a hex color by a percentage
 * @param color - Hex color string (e.g., "#0078D4")
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color string
 */
export function darkenColor(color: string, percent: number = 40): string {
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = Math.max(0, Math.floor(parseInt(hex.slice(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(4, 6), 16) * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generate highlight color from a base color
 * @param color - Base hex color
 * @returns Darker highlight color (40% darker)
 */
export function generateHighlightColor(color: string): string {
  return darkenColor(color, 40);
}

/**
 * App settings configuration
 */
export interface AppSettings {
  activityTypes: ActivityTypeConfig[];
  defaultView: "half" | "full";
  dateFormat: "en-GB" | "en-US" | "nb-NO";
  showWeekNumbers: boolean;
}

/**
 * User role information
 */
export interface UserRoles {
  isAdmin: boolean;
  roles: string[];
}

/**
 * Default activity types configuration
 */
export const defaultActivityTypes: ActivityTypeConfig[] = [
  {
    id: "1",
    key: "meeting",
    label: "Meeting",
    color: "#0078D4",
    highlightColor: "#00487f",
    icon: "people",
    description: "Team meetings, stand-ups, and discussions",
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: "2",
    key: "deadline",
    label: "Deadline",
    color: "#D13438",
    highlightColor: "#7d1f22",
    icon: "flag",
    description: "Important due dates and milestones",
    isDefault: true,
    sortOrder: 2,
  },
  {
    id: "3",
    key: "event",
    label: "Event",
    color: "#107C10",
    highlightColor: "#094a09",
    icon: "calendar",
    description: "Conferences, workshops, and special events",
    isDefault: true,
    sortOrder: 3,
  },
  {
    id: "4",
    key: "planning",
    label: "Planning",
    color: "#8764B8",
    highlightColor: "#513c6e",
    icon: "target",
    description: "Sprint planning, roadmap sessions",
    isDefault: true,
    sortOrder: 4,
  },
  {
    id: "5",
    key: "review",
    label: "Review",
    color: "#FF8C00",
    highlightColor: "#995400",
    icon: "checkmark",
    description: "Performance reviews, retrospectives",
    isDefault: true,
    sortOrder: 5,
  },
  {
    id: "6",
    key: "training",
    label: "Training",
    color: "#008272",
    highlightColor: "#004e44",
    icon: "graduation",
    description: "Learning sessions and skill development",
    isDefault: true,
    sortOrder: 6,
  },
  {
    id: "7",
    key: "holiday",
    label: "Holiday",
    color: "#E3008C",
    highlightColor: "#880054",
    icon: "beach",
    description: "Public holidays and vacation periods",
    isDefault: true,
    sortOrder: 7,
  },
  {
    id: "8",
    key: "other",
    label: "Other",
    color: "#7A7574",
    highlightColor: "#494645",
    icon: "star",
    description: "Miscellaneous activities",
    isDefault: true,
    sortOrder: 8,
  },
];

/**
 * Default app settings
 */
export const defaultAppSettings: AppSettings = {
  activityTypes: defaultActivityTypes,
  defaultView: "half",
  dateFormat: "en-GB",
  showWeekNumbers: true,
};
