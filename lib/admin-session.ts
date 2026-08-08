import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "levien-admin-session";
const SESSION_SECONDS = 8 * 60 * 60;

function settings() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !password || !secret || secret.length < 32) {
    throw new Error("Missing ADMIN_USERNAME, ADMIN_PASSWORD, or a 32+ character ADMIN_SESSION_SECRET.");
  }
  return { username, password, secret };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = createHash("sha256").update(left).digest();
  const rightBuffer = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyAdminCredentials(username: string, password: string) {
  const config = settings();
  return safeEqual(username, config.username) && safeEqual(password, config.password);
}

export function createAdminSession() {
  const { secret } = settings();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  return { value: `${payload}.${signature(payload, secret)}`, maxAge: SESSION_SECONDS };
}

export function verifyAdminSession(value: string | undefined) {
  if (!value) return false;
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature || !/^\d+$/.test(payload)) return false;
  const { secret } = settings();
  if (Number(payload) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(suppliedSignature, signature(payload, secret));
}
