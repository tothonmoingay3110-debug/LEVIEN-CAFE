export const holidayThemes = [
  { id: "default", name: "Original", detail: "Everyday LEVIEN look", symbol: "✦" },
  { id: "christmas", name: "Christmas", detail: "Evergreen, cranberry & gold", symbol: "❄" },
  { id: "new-year", name: "New Year", detail: "Midnight blue & gold", symbol: "✦" },
  { id: "valentines", name: "Valentine's Day", detail: "Rose & berry", symbol: "♥" },
  { id: "easter", name: "Easter", detail: "Spring lavender & mint", symbol: "✿" },
  { id: "independence-day", name: "Independence Day", detail: "Red, white & blue", symbol: "★" },
  { id: "halloween", name: "Halloween", detail: "Plum & pumpkin", symbol: "✦" },
  { id: "thanksgiving", name: "Thanksgiving", detail: "Harvest amber & cranberry", symbol: "✦" },
] as const;

export type HolidayTheme = (typeof holidayThemes)[number]["id"];

export function normalizeHolidayTheme(value: unknown): HolidayTheme {
  return holidayThemes.find((theme) => theme.id === value)?.id || "default";
}
