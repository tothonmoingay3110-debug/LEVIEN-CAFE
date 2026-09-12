import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/rate-limit";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";

const digits = (value: unknown) => typeof value === "string" ? value.replace(/\D/g, "").slice(0, 15) : "";
const maskEmail = (email: string) => { const [name, domain] = email.split("@"); return domain ? `${name.slice(0, 2)}***@${domain}` : ""; };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!allowRequest(request, "member-lookup", 20, 60_000)) return NextResponse.json({ error: "Too many lookups. Please wait a moment." }, { status: 429 });
  if (requestBodyExceeds(request, 2048)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const phone = digits((await request.json() as { phone?: unknown }).phone);
  if (phone.length < 10) return NextResponse.json({ found: false });
  const db = createAdminClient();
  const { data: customers, error } = await db.from("customer_profiles").select("id,first_name,last_name,email,phone,membership_number");
  if (error) return NextResponse.json({ error: "Unable to check membership." }, { status: 500 });
  const customer = (customers || []).find((item) => digits(item.phone) === phone);
  if (!customer) return NextResponse.json({ found: false });
  const { data: rewards } = await db.from("loyalty_rewards").select("id,reward_name,expires_at").eq("customer_profile_id", customer.id).eq("status", "issued").eq("reward_type", "free_product").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  return NextResponse.json({ found: true, member: { firstName: customer.first_name, lastInitial: customer.last_name ? `${customer.last_name[0]}.` : "", maskedEmail: maskEmail(customer.email || ""), membershipNumber: customer.membership_number, rewards: rewards || [] } }, { headers: { "Cache-Control": "no-store" } });
}
