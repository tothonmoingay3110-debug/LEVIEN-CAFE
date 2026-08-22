import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffSession } from "@/lib/staff-auth";
import { roleHasPermission, type StaffSessionSummary } from "@/lib/staff-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";
import type { Database } from "@/types/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
type TimeOffRequest = Database["public"]["Tables"]["staff_time_off_requests"]["Row"];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown) {
  if (typeof value !== "string" || !datePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function storeDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function rangeDays(startDate: string, endDate: string) {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
}

function dateWithinDays(date: string, minimumDays: number, maximumDays: number) {
  const today = Date.parse(`${storeDateKey()}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  const days = Math.round((target - today) / 86_400_000);
  return days >= minimumDays && days <= maximumDays;
}

function employee(profile: StaffProfile) {
  return { id: profile.id, fullName: profile.full_name, role: profile.role, active: profile.active };
}

function requestResponse(request: TimeOffRequest) {
  return {
    id: request.id,
    staffId: request.staff_id,
    startDate: request.start_date,
    endDate: request.end_date,
    days: rangeDays(request.start_date, request.end_date),
    reason: request.reason,
    status: request.status,
    reviewedBy: request.reviewed_by,
    reviewedAt: request.reviewed_at,
    createdAt: request.created_at,
  };
}

function canManageProfile(actor: StaffSessionSummary, target: StaffProfile) {
  return actor.role === "owner" || target.role !== "owner";
}

async function authenticatedStaff() {
  const staff = await getStaffSession();
  if (!staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (staff.mustChangePassword) return { response: NextResponse.json({ error: "Change the temporary password before managing time off." }, { status: 403 }), staff: null };
  if (!roleHasPermission(staff.role, "view_own_schedule")) return { response: NextResponse.json({ error: "Time-off access is not enabled for this role." }, { status: 403 }), staff: null };
  return { response: null, staff };
}

async function readProfile(id: string) {
  const { data, error } = await createAdminClient().from("staff_profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function hasRequestOverlap(staffId: string, startDate: string, endDate: string) {
  const { data, error } = await createAdminClient()
    .from("staff_time_off_requests")
    .select("id")
    .eq("staff_id", staffId)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function GET(request: Request) {
  try {
    const authorization = await authenticatedStaff();
    if (authorization.response || !authorization.staff) return authorization.response;
    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));
    if (!from || !to || from > to || rangeDays(from, to) > 366) return NextResponse.json({ error: "Choose a valid date range of 366 days or less." }, { status: 400 });

    const staff = authorization.staff;
    const canManage = roleHasPermission(staff.role, "manage_schedule");
    if (!canManage && staff.legacy) return NextResponse.json({ error: "Create a Supabase Auth Owner account to use personal time off." }, { status: 400 });
    const supabase = createAdminClient();
    let requestQuery = supabase.from("staff_time_off_requests").select("*").lte("start_date", to).gte("end_date", from).order("start_date").order("created_at");
    if (!canManage) requestQuery = requestQuery.eq("staff_id", staff.id);
    const [profileResult, requestResult] = await Promise.all([
      canManage ? supabase.from("staff_profiles").select("*").order("full_name") : supabase.from("staff_profiles").select("*").eq("id", staff.id),
      requestQuery,
    ]);
    if (profileResult.error) throw profileResult.error;
    if (requestResult.error) throw requestResult.error;
    return NextResponse.json({ canManage, team: (profileResult.data || []).map(employee), requests: (requestResult.data || []).map(requestResponse) });
  } catch (error) {
    console.error("Unable to load time-off requests:", error);
    return NextResponse.json({ error: "Unable to load time-off requests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authenticatedStaff();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    if (staff.legacy) return NextResponse.json({ error: "Legacy Owner accounts cannot submit personal time off." }, { status: 400 });
    const body = (await request.json()) as { startDate?: unknown; endDate?: unknown; reason?: unknown };
    const startDate = validDate(body.startDate);
    const endDate = validDate(body.endDate);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!startDate || !endDate || startDate > endDate || rangeDays(startDate, endDate) > 31 || !dateWithinDays(startDate, 0, 365) || !dateWithinDays(endDate, 0, 395) || reason.length > 500) {
      return NextResponse.json({ error: "Choose a valid future date range of 31 days or less." }, { status: 400 });
    }
    if (await hasRequestOverlap(staff.id, startDate, endDate)) return NextResponse.json({ error: "This request overlaps another pending or approved time-off request." }, { status: 409 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("staff_time_off_requests").insert({ staff_id: staff.id, start_date: startDate, end_date: endDate, reason }).select("*").single();
    if (error || !data) throw error || new Error("Time-off request was not created.");
    const { data: managers } = await supabase.from("staff_profiles").select("id").eq("active", true).in("role", ["owner", "manager"]);
    const message = `${staff.fullName} requested time off from ${startDate} to ${endDate}.`;
    await recordWorkforceEvent({
      notifications: (managers || []).filter((manager) => manager.id !== staff.id).map((manager) => ({ staffId: manager.id, type: "time_off", title: "Time-off request awaiting review", message, link: "/admin" })),
      activity: { actorId: staff.id, action: "time_off.request", entityType: "time_off", entityId: data.id, summary: message, metadata: { startDate, endDate } },
    });
    return NextResponse.json({ request: requestResponse(data) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create time-off request:", error);
    return NextResponse.json({ error: "Unable to submit the time-off request." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authenticatedStaff();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    const body = (await request.json()) as { id?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id) return NextResponse.json({ error: "Time-off request is required." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: timeOff, error } = await supabase.from("staff_time_off_requests").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!timeOff) return NextResponse.json({ error: "Time-off request not found." }, { status: 404 });
    const canManage = roleHasPermission(staff.role, "manage_schedule");
    const target = await readProfile(timeOff.staff_id);
    if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    if (action === "cancel") {
      const ownPending = !staff.legacy && timeOff.staff_id === staff.id && timeOff.status === "pending";
      const managerCancellation = canManage && canManageProfile(staff, target) && (timeOff.status === "pending" || timeOff.status === "approved");
      if (!ownPending && !managerCancellation) return NextResponse.json({ error: "This time-off request cannot be cancelled." }, { status: 403 });
      const { error: cancelError } = await supabase.from("staff_time_off_requests").update({ status: "cancelled", reviewed_by: managerCancellation ? (staff.legacy ? null : staff.id) : timeOff.reviewed_by, reviewed_at: managerCancellation ? new Date().toISOString() : timeOff.reviewed_at }).eq("id", id);
      if (cancelError) throw cancelError;
      const message = `${staff.fullName} cancelled ${target.full_name}'s time off for ${timeOff.start_date} to ${timeOff.end_date}.`;
      await recordWorkforceEvent({
        notifications: managerCancellation && target.id !== staff.id ? [{ staffId: target.id, type: "time_off", title: "Time off cancelled", message, link: "/admin" }] : [],
        activity: { actorId: staff.legacy ? null : staff.id, action: "time_off.cancel", entityType: "time_off", entityId: id, summary: message },
      });
      return NextResponse.json({ changed: true });
    }

    if (!canManage || (action !== "approve" && action !== "decline")) return NextResponse.json({ error: "Only Owner or Manager can review time off." }, { status: 403 });
    if (!canManageProfile(staff, target)) return NextResponse.json({ error: "Only an Owner can review an Owner request." }, { status: 403 });
    if (timeOff.status !== "pending") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    const actorId = staff.legacy ? null : staff.id;

    if (action === "approve") {
      const { data: conflictingShifts, error: shiftError } = await supabase.from("staff_shifts").select("id,shift_date").eq("staff_id", timeOff.staff_id).eq("status", "scheduled").gte("shift_date", timeOff.start_date).lte("shift_date", timeOff.end_date).limit(5);
      if (shiftError) throw shiftError;
      if (conflictingShifts?.length) return NextResponse.json({ error: `Cancel or reassign ${conflictingShifts.length} scheduled shift(s) in this date range before approval.` }, { status: 409 });
    }

    const nextStatus = action === "approve" ? "approved" : "declined";
    const { error: reviewError } = await supabase.from("staff_time_off_requests").update({ status: nextStatus, reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (reviewError) throw reviewError;
    const message = `${staff.fullName} ${nextStatus} ${target.full_name}'s time off for ${timeOff.start_date} to ${timeOff.end_date}.`;
    await recordWorkforceEvent({
      notifications: [{ staffId: target.id, type: "time_off", title: `Time off ${nextStatus}`, message, link: "/admin" }],
      activity: { actorId, action: `time_off.${nextStatus}`, entityType: "time_off", entityId: id, summary: message },
    });
    return NextResponse.json({ changed: true });
  } catch (error) {
    console.error("Unable to update time off:", error);
    return NextResponse.json({ error: "Unable to update the time-off request." }, { status: 500 });
  }
}
