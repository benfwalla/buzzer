import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- New Color Logic ---
const teamColors: Record<string, string> = {
  "Blue": "#3b82f6", // Blue 500
  "Red": "#ef4444", // Red 500
  "Green": "#22c55e", // Green 500
  "Yellow": "#eab308", // Yellow 500
  "Purple": "#a855f7", // Purple 500
  "Pink": "#ec4899", // Pink 500
  "Teal": "#14b8a6", // Teal 500
  "Orange": "#f97316", // Orange 500
  // Add more if needed, up to the max number of teams you expect
};

// Default color if team not found or too many teams
const defaultColor = "#6b7280"; // Gray 500

export function getTeamColor(team: string | undefined | null): string {
  if (!team) return defaultColor;
  return teamColors[team] || defaultColor;
}
// --- End New Color Logic ---

// --- Contrast Logic ---
// Function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Function to get contrasting text color (black or white)
export function getContrastingTextColor(bgColor: string): string {
  const rgb = hexToRgb(bgColor);
  if (!rgb) return '#000000'; // Default to black if hex is invalid

  // Calculate luminance using the WCAG formula
  // https://www.w3.org/TR/WCAG20/#relativeluminancedef
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  // Use black text for light backgrounds, white text for dark backgrounds
  // Threshold 0.5 is a common choice
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
// --- End Contrast Logic ---
