export const PICKUP_TIME_ZONE = "America/New_York";

export function pickupDateTimeMinimum(now = new Date()) {
  const earliest = new Date(now.getTime() + 5 * 60_000);
  earliest.setSeconds(0, 0);
  const offset = earliest.getTimezoneOffset() * 60_000;
  return new Date(earliest.getTime() - offset).toISOString().slice(0, 16);
}

export function formatPickupTime(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized.toUpperCase() === "ASAP") return "ASAP";

  const pickupAt = new Date(normalized);
  if (Number.isNaN(pickupAt.getTime())) return normalized;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: PICKUP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(pickupAt);
}

export function normalizePickupTime(value: unknown, now = new Date()) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.toUpperCase() === "ASAP") return "ASAP";

  const pickupAt = new Date(normalized);
  if (Number.isNaN(pickupAt.getTime())) return null;

  const clockTolerance = 2 * 60_000;
  if (pickupAt.getTime() < now.getTime() - clockTolerance) return null;

  return pickupAt.toISOString();
}
