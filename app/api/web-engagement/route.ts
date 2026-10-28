import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const moduleKeys = new Set(["home", "menu", "combos", "story", "location", "event-booking", "franchise", "catering", "gift-card", "account", "checkout"]);
type EventType = "page_view" | "module_click" | "product_view" | "product_click";
const eventTypes = new Set<EventType>(["page_view", "module_click", "product_view", "product_click"]);

type WebEventRequest = { eventType?: unknown; moduleKey?: unknown; productId?: unknown; sessionKey?: unknown };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin events are not allowed." }, { status: 403 });
  if (!allowRequest(request, "web-engagement", 180, 60_000)) return NextResponse.json({ error: "Too many events." }, { status: 429 });
  if (requestBodyExceeds(request, 1024)) return NextResponse.json({ error: "Event too large." }, { status: 413 });

  let body: WebEventRequest;
  try { body = await request.json() as WebEventRequest; }
  catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }

  const eventType = typeof body.eventType === "string" && eventTypes.has(body.eventType as EventType) ? body.eventType as EventType : null;
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey : "";
  const productEvent = eventType?.startsWith("product_") || false;
  const moduleKey = typeof body.moduleKey === "string" && moduleKeys.has(body.moduleKey) ? body.moduleKey : null;
  const productId = typeof body.productId === "string" && uuidPattern.test(body.productId) ? body.productId : null;
  if (!eventType || !uuidPattern.test(sessionKey) || (productEvent ? !productId || body.moduleKey != null : !moduleKey || body.productId != null)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    if (productId) {
      const { data, error } = await db.from("products").select("id").eq("id", productId).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ recorded: false });
    }

    const duplicateSeconds = eventType === "product_view" ? 1800 : eventType === "page_view" ? 2 : 1;
    const duplicateWindow = new Date(Date.now() - duplicateSeconds * 1000).toISOString();
    const query = db.from("web_engagement_events")
      .select("id")
      .eq("event_type", eventType)
      .eq("session_key", sessionKey)
      .eq(productEvent ? "product_id" : "module_key", productId || moduleKey || "")
      .gte("created_at", duplicateWindow)
      .limit(1);
    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ recorded: false });

    const { error } = await db.from("web_engagement_events").insert({
      event_type: eventType,
      module_key: moduleKey,
      product_id: productId,
      session_key: sessionKey,
    });
    if (error) throw error;
    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to record web engagement:", error);
    return NextResponse.json({ error: "Unable to record event." }, { status: 500 });
  }
}
