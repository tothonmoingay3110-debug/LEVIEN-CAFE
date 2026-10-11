import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (requestBodyExceeds(request, 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const access = await getStaffAccess("manage_catalog");
  if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Only managers or owners can change online ordering." }, { status: 403 });
  let body: { enabled?: unknown };
  try {
    body = await request.json() as { enabled?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "The ordering setting must be true or false." }, { status: 400 });
  const db = createAdminClient();
  const { data, error } = await db.from("site_content").update({ online_ordering_enabled: body.enabled }).eq("singleton_key", "main").select("online_ordering_enabled").single();
  if (error || !data) {
    console.error("Unable to update online ordering:", error);
    return NextResponse.json({ error: "Unable to save online ordering. Check that the database migration is applied." }, { status: 500 });
  }
  return NextResponse.json({ enabled: data.online_ordering_enabled }, { headers: { "Cache-Control": "no-store" } });
}
