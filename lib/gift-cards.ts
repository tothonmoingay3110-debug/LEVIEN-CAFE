import "server-only";

import { createHash, randomInt } from "node:crypto";

const giftCardAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const giftCardPattern = /^LVGC[A-HJ-NP-Z2-9]{12}$/;

export function normalizeGiftCardCode(value: unknown) {
  if (typeof value !== "string") return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return giftCardPattern.test(compact) ? compact : null;
}

export function hashGiftCardCode(normalizedCode: string) {
  return createHash("sha256").update(normalizedCode, "utf8").digest("hex");
}

export function generateGiftCardCode() {
  let payload = "";
  for (let index = 0; index < 12; index += 1) {
    payload += giftCardAlphabet[randomInt(0, giftCardAlphabet.length)];
  }
  const normalized = `LVGC${payload}`;
  return {
    normalized,
    formatted: `LVGC-${payload.slice(0, 4)}-${payload.slice(4, 8)}-${payload.slice(8, 12)}`,
    lastFour: payload.slice(-4),
    hash: hashGiftCardCode(normalized),
  };
}
