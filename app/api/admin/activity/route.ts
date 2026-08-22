import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { staff, allowed } = await getStaffAccess("view_audit_log");
    if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!allowed) return NextResponse.json({ error: "Only Owner or Manager can view activity history." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 100);
    const limit = Number.isInteger(requestedLimit) ? Math.min(200, Math.max(20, requestedLimit)) : 100;
    const supabase = createAdminClient();
    const [activityResult, profileResult] = await Promise.all([
      supabase.from("staff_audit_log").select("*").order("created_at", { ascending: false }).limit(limit),
      supabase.from("staff_profiles").select("id,full_name,email,role"),
    ]);
    if (activityResult.error) throw activityResult.error;
    if (profileResult.error) throw profileResult.error;
    const profiles = new Map((profileResult.data || []).map((profile) => [profile.id, profile]));
    return NextResponse.json({
      events: (activityResult.data || []).map((event) => {
        const actor = event.actor_id ? profiles.get(event.actor_id) : null;
        return {
          id: event.id,
          actorId: event.actor_id,
          actorName: actor?.full_name || (event.actor_id ? "Former employee" : "Legacy Owner / system"),
          actorRole: actor?.role || null,
          action: event.action,
          entityType: event.entity_type,
          entityId: event.entity_id,
          summary: event.summary,
          metadata: event.metadata,
          createdAt: event.created_at,
        };
      }),
    });
  } catch (error) {
    console.error("Unable to load staff activity:", error);
    return NextResponse.json({ error: "Unable to load activity history." }, { status: 500 });
  }
}
