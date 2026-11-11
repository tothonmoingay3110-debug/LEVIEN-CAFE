import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { holidayThemes } from "@/lib/holiday-theme";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (requestBodyExceeds(request, 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const access = await getStaffAccess("manage_catalog");
  if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Only managers or owners can change the holiday theme." }, { status: 403 });

  let body: { theme?: unknown };
  try { body = await request.json() as { theme?: unknown }; }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!holidayThemes.some((item) => item.id === body.theme)) {
    return NextResponse.json({ error: "Choose a valid holiday theme." }, { status: 400 });
  }

  const { data, error } = await createAdminClient().from("site_content")
    .update({ holiday_theme: body.theme as string })
    .eq("singleton_key", "main")
    .select("holiday_theme")
    .single();
  if (error || !data) {
    console.error("Unable to save holiday theme:", error);
    return NextResponse.json({ error: "Unable to save the theme. Check that the database migration is applied." }, { status: 500 });
  }
  return NextResponse.json({ theme: data.holiday_theme }, { headers: { "Cache-Control": "no-store" } });
}
