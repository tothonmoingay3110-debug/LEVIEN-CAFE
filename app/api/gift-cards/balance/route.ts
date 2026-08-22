import { NextResponse } from "next/server";
import { hashGiftCardCode, normalizeGiftCardCode } from "@/lib/gift-cards";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!allowRequest(request, "gift-card-balance", 20, 10 * 60 * 1000)) return NextResponse.json({ error: "Too many balance checks. Try again later." }, { status: 429 });
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }

    let body: { code?: unknown };
    try {
      body = (await request.json()) as { code?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const normalized = normalizeGiftCardCode(body.code);
    if (!normalized) return NextResponse.json({ error: "Enter a valid LEVIEN Gift Card code." }, { status: 400 });

    const { data, error } = await createAdminClient()
      .from("gift_cards")
      .select("code_last_four,balance,currency,status,expires_on")
      .eq("code_hash", hashGiftCardCode(normalized))
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Gift Card not found." }, { status: 404 });

    const expired = Boolean(data.expires_on && data.expires_on < new Date().toISOString().slice(0, 10));
    const status = expired ? "expired" : Number(data.balance) <= 0 ? "redeemed" : data.status;
    return NextResponse.json({
      card: {
        lastFour: data.code_last_four,
        balance: Number(data.balance),
        currency: data.currency,
        status,
        expiresOn: data.expires_on,
        usable: status === "active",
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to check gift card balance:", error);
    return NextResponse.json({ error: "Unable to check this Gift Card." }, { status: 500 });
  }
}
