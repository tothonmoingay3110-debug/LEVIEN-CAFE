import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffSession } from "@/lib/staff-auth";
import { roleHasPermission, type StaffSessionSummary } from "@/lib/staff-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
type ShiftRequest = Database["public"]["Tables"]["staff_shift_requests"]["Row"];
type WorkShift = Database["public"]["Tables"]["staff_shifts"]["Row"];

type ShiftInput = {
  staffId?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  position?: unknown;
  note?: unknown;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function storeDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !datePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function validTime(value: unknown) {
  return typeof value === "string" && timePattern.test(value) ? value : null;
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function parseShiftInput(body: ShiftInput, requireStaff: boolean) {
  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  const date = validDate(body.date);
  const startTime = validTime(body.startTime);
  const endTime = validTime(body.endTime);
  const position = typeof body.position === "string" ? body.position.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if ((requireStaff && !staffId) || !date || !startTime || !endTime || minutes(endTime) <= minutes(startTime) || minutes(endTime) - minutes(startTime) > 16 * 60 || position.length > 80 || note.length > 500) {
    return null;
  }
  return { staffId, date, startTime, endTime, position, note };
}

function dateWithinDays(date: string, minimumDays: number, maximumDays: number) {
  const today = Date.parse(`${storeDateKey()}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  const days = Math.round((target - today) / 86_400_000);
  return days >= minimumDays && days <= maximumDays;
}

function employee(profile: StaffProfile) {
  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    active: profile.active,
  };
}

function requestResponse(request: ShiftRequest) {
  return {
    id: request.id,
    staffId: request.staff_id,
    date: request.shift_date,
    startTime: request.start_time.slice(0, 5),
    endTime: request.end_time.slice(0, 5),
    note: request.note,
    status: request.status,
    reviewedBy: request.reviewed_by,
    reviewedAt: request.reviewed_at,
    createdAt: request.created_at,
  };
}

function shiftResponse(shift: WorkShift) {
  return {
    id: shift.id,
    staffId: shift.staff_id,
    date: shift.shift_date,
    startTime: shift.start_time.slice(0, 5),
    endTime: shift.end_time.slice(0, 5),
    position: shift.position,
    note: shift.note,
    status: shift.status,
    sourceRequestId: shift.source_request_id,
    createdAt: shift.created_at,
  };
}

function canManageProfile(actor: StaffSessionSummary, target: StaffProfile) {
  return actor.role === "owner" || target.role !== "owner";
}

async function authenticatedStaff() {
  const staff = await getStaffSession();
  if (!staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (staff.mustChangePassword) return { response: NextResponse.json({ error: "Change the temporary password before opening the schedule." }, { status: 403 }), staff: null };
  if (!roleHasPermission(staff.role, "view_own_schedule")) return { response: NextResponse.json({ error: "Schedule access is not enabled for this role." }, { status: 403 }), staff: null };
  return { response: null, staff };
}

async function readProfile(id: string) {
  const { data, error } = await createAdminClient().from("staff_profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function hasShiftConflict(staffId: string, date: string, startTime: string, endTime: string, excludeId?: string) {
  let query = createAdminClient()
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", staffId)
    .eq("shift_date", date)
    .eq("status", "scheduled")
    .lt("start_time", endTime)
    .gt("end_time", startTime);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function hasRequestConflict(staffId: string, date: string, startTime: string, endTime: string) {
  const { data, error } = await createAdminClient()
    .from("staff_shift_requests")
    .select("id")
    .eq("staff_id", staffId)
    .eq("shift_date", date)
    .in("status", ["pending", "approved"])
    .lt("start_time", endTime)
    .gt("end_time", startTime)
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
    if (!from || !to || from > to || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 31 * 86_400_000) {
      return NextResponse.json({ error: "Choose a valid schedule range of 31 days or less." }, { status: 400 });
    }

    const staff = authorization.staff;
    const canManage = roleHasPermission(staff.role, "manage_schedule");
    const supabase = createAdminClient();
    let shiftQuery = supabase.from("staff_shifts").select("*").gte("shift_date", from).lte("shift_date", to).eq("status", "scheduled").order("shift_date").order("start_time");
    let requestQuery = supabase.from("staff_shift_requests").select("*").gte("shift_date", from).lte("shift_date", to).order("shift_date").order("start_time");
    if (!canManage) {
      if (staff.legacy) return NextResponse.json({ error: "Create a Supabase Auth Owner account to use personal scheduling." }, { status: 400 });
      shiftQuery = shiftQuery.eq("staff_id", staff.id);
      requestQuery = requestQuery.eq("staff_id", staff.id);
    }

    const [profileResult, shiftResult, requestResult] = await Promise.all([
      canManage
        ? supabase.from("staff_profiles").select("*").order("full_name")
        : supabase.from("staff_profiles").select("*").eq("id", staff.id),
      shiftQuery,
      requestQuery,
    ]);
    if (profileResult.error) throw profileResult.error;
    if (shiftResult.error) throw shiftResult.error;
    if (requestResult.error) throw requestResult.error;

    return NextResponse.json({
      canManage,
      team: (profileResult.data || []).map(employee),
      shifts: (shiftResult.data || []).map(shiftResponse),
      requests: (requestResult.data || []).map(requestResponse),
    });
  } catch (error) {
    console.error("Unable to load schedule:", error);
    return NextResponse.json({ error: "Unable to load the work schedule." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authenticatedStaff();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    const body = (await request.json()) as ShiftInput & { kind?: unknown };
    const kind = body.kind;

    if (kind === "request") {
      if (staff.legacy) return NextResponse.json({ error: "Legacy Owner accounts cannot submit personal shift requests." }, { status: 400 });
      const input = parseShiftInput(body, false);
      if (!input || !dateWithinDays(input.date, 0, 120)) return NextResponse.json({ error: "Choose a valid shift within the next 120 days (maximum 16 hours)." }, { status: 400 });
      if (await hasShiftConflict(staff.id, input.date, input.startTime, input.endTime)) {
        return NextResponse.json({ error: "You already have a published shift during this time." }, { status: 409 });
      }
      if (await hasRequestConflict(staff.id, input.date, input.startTime, input.endTime)) {
        return NextResponse.json({ error: "This request overlaps another pending or approved request." }, { status: 409 });
      }
      const { data, error } = await createAdminClient().from("staff_shift_requests").insert({
        staff_id: staff.id,
        shift_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        note: input.note,
      }).select("*").single();
      if (error || !data) throw error || new Error("Shift request was not created.");
      return NextResponse.json({ request: requestResponse(data) }, { status: 201 });
    }

    if (kind === "shift") {
      if (!roleHasPermission(staff.role, "manage_schedule")) return NextResponse.json({ error: "Only Owner or Manager can publish work shifts." }, { status: 403 });
      const input = parseShiftInput(body, true);
      if (!input || !dateWithinDays(input.date, 0, 365)) return NextResponse.json({ error: "Choose an active employee and a valid shift within the next year." }, { status: 400 });
      const target = await readProfile(input.staffId);
      if (!target || !target.active) return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
      if (!canManageProfile(staff, target)) return NextResponse.json({ error: "Only an Owner can schedule an Owner account." }, { status: 403 });
      if (await hasShiftConflict(target.id, input.date, input.startTime, input.endTime)) return NextResponse.json({ error: "This employee already has an overlapping scheduled shift." }, { status: 409 });
      const actorId = staff.legacy ? null : staff.id;
      const { data, error } = await createAdminClient().from("staff_shifts").insert({
        staff_id: target.id,
        shift_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        position: input.position,
        note: input.note,
        created_by: actorId,
        updated_by: actorId,
      }).select("*").single();
      if (error || !data) throw error || new Error("Work shift was not created.");
      return NextResponse.json({ shift: shiftResponse(data) }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown schedule action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to create schedule entry:", error);
    return NextResponse.json({ error: "Unable to save the schedule entry." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authenticatedStaff();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    const body = (await request.json()) as ShiftInput & { id?: unknown; kind?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "Schedule entry is required." }, { status: 400 });
    const canManage = roleHasPermission(staff.role, "manage_schedule");
    const actorId = staff.legacy ? null : staff.id;
    const supabase = createAdminClient();

    if (body.kind === "request") {
      const { data: shiftRequest, error } = await supabase.from("staff_shift_requests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!shiftRequest) return NextResponse.json({ error: "Shift request not found." }, { status: 404 });

      if (body.action === "cancel") {
        if (staff.legacy || shiftRequest.staff_id !== staff.id || shiftRequest.status !== "pending") return NextResponse.json({ error: "Only your own pending request can be cancelled." }, { status: 403 });
        const { error: cancelError } = await supabase.from("staff_shift_requests").update({ status: "cancelled" }).eq("id", id);
        if (cancelError) throw cancelError;
        return NextResponse.json({ changed: true });
      }

      if (!canManage || (body.action !== "approve" && body.action !== "decline")) return NextResponse.json({ error: "Only Owner or Manager can review shift requests." }, { status: 403 });
      if (shiftRequest.status !== "pending") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
      const target = await readProfile(shiftRequest.staff_id);
      if (!target || !target.active) return NextResponse.json({ error: "The employee account is not active." }, { status: 400 });
      if (!canManageProfile(staff, target)) return NextResponse.json({ error: "Only an Owner can review an Owner request." }, { status: 403 });

      if (body.action === "decline") {
        const { error: declineError } = await supabase.from("staff_shift_requests").update({ status: "declined", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", id);
        if (declineError) throw declineError;
        return NextResponse.json({ changed: true });
      }

      if (!dateWithinDays(shiftRequest.shift_date, 0, 365)) return NextResponse.json({ error: "Past shift requests cannot be approved." }, { status: 400 });
      if (await hasShiftConflict(target.id, shiftRequest.shift_date, shiftRequest.start_time.slice(0, 5), shiftRequest.end_time.slice(0, 5))) {
        return NextResponse.json({ error: "Approval would overlap an existing scheduled shift." }, { status: 409 });
      }
      const { data: createdShift, error: shiftError } = await supabase.from("staff_shifts").insert({
        staff_id: target.id,
        shift_date: shiftRequest.shift_date,
        start_time: shiftRequest.start_time,
        end_time: shiftRequest.end_time,
        note: shiftRequest.note,
        source_request_id: shiftRequest.id,
        created_by: actorId,
        updated_by: actorId,
      }).select("*").single();
      if (shiftError || !createdShift) throw shiftError || new Error("Approved shift was not created.");
      const { error: approveError } = await supabase.from("staff_shift_requests").update({ status: "approved", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (approveError) {
        await supabase.from("staff_shifts").delete().eq("id", createdShift.id);
        throw approveError;
      }
      return NextResponse.json({ changed: true, shift: shiftResponse(createdShift) });
    }

    if (body.kind === "shift") {
      if (!canManage) return NextResponse.json({ error: "Only Owner or Manager can edit published shifts." }, { status: 403 });
      const { data: shift, error } = await supabase.from("staff_shifts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!shift) return NextResponse.json({ error: "Work shift not found." }, { status: 404 });
      const currentTarget = await readProfile(shift.staff_id);
      if (!currentTarget || !canManageProfile(staff, currentTarget)) return NextResponse.json({ error: "Only an Owner can manage an Owner shift." }, { status: 403 });

      if (body.action === "cancel") {
        const { error: cancelError } = await supabase.from("staff_shifts").update({ status: "cancelled", updated_by: actorId }).eq("id", id);
        if (cancelError) throw cancelError;
        return NextResponse.json({ changed: true });
      }
      if (body.action !== "update") return NextResponse.json({ error: "Unknown shift action." }, { status: 400 });

      const input = parseShiftInput(body, true);
      if (!input || !dateWithinDays(input.date, 0, 365)) return NextResponse.json({ error: "Choose an active employee and a valid future shift." }, { status: 400 });
      const target = await readProfile(input.staffId);
      if (!target || !target.active) return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
      if (!canManageProfile(staff, target)) return NextResponse.json({ error: "Only an Owner can schedule an Owner account." }, { status: 403 });
      if (await hasShiftConflict(target.id, input.date, input.startTime, input.endTime, shift.id)) return NextResponse.json({ error: "This employee already has an overlapping scheduled shift." }, { status: 409 });
      const { data: updated, error: updateError } = await supabase.from("staff_shifts").update({
        staff_id: target.id,
        shift_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        position: input.position,
        note: input.note,
        updated_by: actorId,
      }).eq("id", id).select("*").single();
      if (updateError || !updated) throw updateError || new Error("Work shift was not updated.");
      return NextResponse.json({ shift: shiftResponse(updated) });
    }

    return NextResponse.json({ error: "Unknown schedule entry." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update schedule:", error);
    return NextResponse.json({ error: "Unable to update the work schedule." }, { status: 500 });
  }
}
