import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sessionPattern = /^[a-z0-9-]{8,80}$/i;

type PromotionEventRequest = {
  promotionId?: unknown;
  eventType?: unknown;
  sessionKey?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin promotion events are not allowed." }, { status: 403 });
  }
  if (!allowRequest(request, "promotion-events", 120, 60_000)) {
    return NextResponse.json({ error: "Too many promotion events." }, { status: 429 });
  }
  if (requestBodyExceeds(request, 2 * 1024)) {
    return NextResponse.json({ error: "Promotion event is too large." }, { status: 413 });
  }

  let body: PromotionEventRequest;
  try {
    body = await request.json() as PromotionEventRequest;
  } catch {
    return NextResponse.json({ error: "Invalid promotion event." }, { status: 400 });
  }

  const promotionId = typeof body.promotionId === "string" ? body.promotionId.trim() : "";
  const eventType = body.eventType === "impression" || body.eventType === "click" ? body.eventType : null;
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
  if (!uuidPattern.test(promotionId) || !eventType || !sessionPattern.test(sessionKey)) {
    return NextResponse.json({ error: "Invalid promotion event." }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data: promotion, error: promotionError } = await db
      .from("promotions")
      .select("id")
      .eq("id", promotionId)
      .eq("active", true)
      .maybeSingle();
    if (promotionError) throw promotionError;
    if (!promotion) return NextResponse.json({ recorded: false }, { status: 200 });

    const duplicateWindow = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: existing, error: existingError } = await db
      .from("promotion_events")
      .select("id")
      .eq("promotion_id", promotionId)
      .eq("event_type", eventType)
      .eq("session_key", sessionKey)
      .gte("created_at", duplicateWindow)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ recorded: false }, { status: 200 });

    const { error } = await db.from("promotion_events").insert({
      promotion_id: promotionId,
      event_type: eventType,
      session_key: sessionKey,
    });
    if (error) throw error;
    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to record promotion event:", error);
    return NextResponse.json({ error: "Unable to record promotion event." }, { status: 500 });
  }
}
