import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- New Color Logic ---
const teamColors: Record<string, string> = {
  "Team 1": "#3b82f6", // Blue 500
  "Team 2": "#ef4444", // Red 500
  "Team 3": "#22c55e", // Green 500
  "Team 4": "#eab308", // Yellow 500
  "Team 5": "#a855f7", // Purple 500
  "Team 6": "#ec4899", // Pink 500
  "Team 7": "#14b8a6", // Teal 500
  "Team 8": "#f97316", // Orange 500
  // Add more if needed, up to the max number of teams you expect
};

// Default color if team not found or too many teams
const defaultColor = "#6b7280"; // Gray 500

export function getTeamColor(team: string | undefined | null): string {
  if (!team) return defaultColor;
  return teamColors[team] || defaultColor;
}
// --- End New Color Logic ---
