import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY in the server environment.");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET in the server environment.");
  return secret;
}

export function getSiteOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL in the production environment.");
  }
  const origin = configured || (request ? new URL(request.url).origin : "");
  if (!origin) throw new Error("Missing NEXT_PUBLIC_SITE_URL in the server environment.");
  const parsed = new URL(origin);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
  return parsed.origin;
}
