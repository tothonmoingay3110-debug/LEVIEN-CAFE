import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";

const statuses = ["new", "in_progress", "resolved", "archived"] as const;
type ContactStatus = (typeof statuses)[number];
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function authorizeContactMessages() {
  const access = await getStaffAccess("manage_contacts");
  if (!access.staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (!access.allowed) return { response: NextResponse.json({ error: "Contact messages require Owner or Manager permission." }, { status: 403 }), staff: access.staff };
  return { response: null, staff: access.staff };
}

export async function GET() {
  try {
    const authorization = await authorizeContactMessages();
    if (authorization.response) return authorization.response;

    const { data, error } = await createAdminClient()
      .from("contact_messages")
      .select("id,name,email,phone,subject,message,status,admin_note,handled_by,handled_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    return NextResponse.json({
      messages: (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone,
        subject: item.subject,
        message: item.message,
        status: item.status,
        adminNote: item.admin_note,
        handledBy: item.handled_by,
        handledAt: item.handled_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load contact messages:", error);
    return NextResponse.json({ error: "Unable to load contact messages." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const authorization = await authorizeContactMessages();
    if (authorization.response || !authorization.staff) return authorization.response;
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

    let body: { id?: unknown; status?: unknown; adminNote?: unknown };
    try {
      body = (await request.json()) as { id?: unknown; status?: unknown; adminNote?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = typeof body.status === "string" && statuses.includes(body.status as ContactStatus)
      ? body.status as ContactStatus
      : null;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) : "";
    if (!uuidPattern.test(id) || !status) return NextResponse.json({ error: "Invalid message update." }, { status: 400 });

    const handled = status !== "new";
    const { data, error } = await createAdminClient()
      .from("contact_messages")
      .update({
        status,
        admin_note: adminNote,
        handled_by: handled && !authorization.staff.legacy ? authorization.staff.id : null,
        handled_at: handled ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id,status,admin_note,handled_by,handled_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Message not found." }, { status: 404 });

    await recordWorkforceEvent({
      activity: {
        actorId: authorization.staff.legacy ? null : authorization.staff.id,
        action: "contact_message_updated",
        entityType: "contact_message",
        entityId: data.id,
        summary: `Contact message marked ${status.replace("_", " ")}.`,
        metadata: { status },
      },
    });

    return NextResponse.json({
      message: {
        id: data.id,
        status: data.status,
        adminNote: data.admin_note,
        handledBy: data.handled_by,
        handledAt: data.handled_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error("Unable to update contact message:", error);
    return NextResponse.json({ error: "Unable to update contact message." }, { status: 500 });
  }
}
