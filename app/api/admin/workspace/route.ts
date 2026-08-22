import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffSession } from "@/lib/staff-auth";
import { roleHasPermission, type StaffSessionSummary } from "@/lib/staff-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent, shiftNotificationMessage } from "@/lib/workforce-events";
import type { Database } from "@/types/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
type WorkShift = Database["public"]["Tables"]["staff_shifts"]["Row"];
type SwapRequest = Database["public"]["Tables"]["staff_shift_swap_requests"]["Row"];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
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
  };
}

function canManageProfile(actor: StaffSessionSummary, target: StaffProfile) {
  return actor.role === "owner" || target.role !== "owner";
}

async function authorize() {
  const staff = await getStaffSession();
  if (!staff) return { staff: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (staff.mustChangePassword) return { staff: null, response: NextResponse.json({ error: "Change the temporary password before opening My Workspace." }, { status: 403 }) };
  if (!roleHasPermission(staff.role, "view_own_schedule")) return { staff: null, response: NextResponse.json({ error: "Workspace access is not enabled for this role." }, { status: 403 }) };
  return { staff, response: null };
}

async function hasShiftConflict(staffId: string, shift: WorkShift) {
  const { data, error } = await createAdminClient()
    .from("staff_shifts")
    .select("id")
    .eq("staff_id", staffId)
    .eq("shift_date", shift.shift_date)
    .eq("status", "scheduled")
    .neq("id", shift.id)
    .lt("start_time", shift.end_time)
    .gt("end_time", shift.start_time)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function hasApprovedTimeOff(staffId: string, date: string) {
  const { data, error } = await createAdminClient()
    .from("staff_time_off_requests")
    .select("id")
    .eq("staff_id", staffId)
    .eq("status", "approved")
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

function swapResponse(swap: SwapRequest, shifts: Map<string, WorkShift>, profiles: Map<string, StaffProfile>) {
  const shift = shifts.get(swap.shift_id);
  const requester = profiles.get(swap.requester_id);
  const offered = profiles.get(swap.offered_to);
  return {
    id: swap.id,
    shiftId: swap.shift_id,
    requesterId: swap.requester_id,
    requesterName: requester?.full_name || "Former employee",
    offeredTo: swap.offered_to,
    offeredName: offered?.full_name || "Former employee",
    note: swap.note,
    status: swap.status,
    reviewedBy: swap.reviewed_by,
    reviewedAt: swap.reviewed_at,
    createdAt: swap.created_at,
    shift: shift ? shiftResponse(shift) : null,
  };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    const canManage = roleHasPermission(staff.role, "manage_schedule");
    const supabase = createAdminClient();
    const today = storeDateKey();
    const profileResult = await supabase.from("staff_profiles").select("*").order("full_name");
    if (profileResult.error) throw profileResult.error;
    const profiles = profileResult.data || [];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    let swaps: SwapRequest[] = [];
    if (staff.legacy && canManage) {
      const result = await supabase.from("staff_shift_swap_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      swaps = result.data || [];
    } else if (!staff.legacy) {
      let query = supabase.from("staff_shift_swap_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (!canManage) query = query.or(`requester_id.eq.${staff.id},offered_to.eq.${staff.id}`);
      const result = await query;
      if (result.error) throw result.error;
      swaps = result.data || [];
    }

    const swapShiftIds = [...new Set(swaps.map((swap) => swap.shift_id))];
    const personalShiftPromise = staff.legacy
      ? Promise.resolve({ data: [] as WorkShift[], error: null })
      : supabase.from("staff_shifts").select("*").eq("staff_id", staff.id).eq("status", "scheduled").gte("shift_date", today).lte("shift_date", addDays(today, 90)).order("shift_date").order("start_time");
    const swapShiftPromise = swapShiftIds.length
      ? supabase.from("staff_shifts").select("*").in("id", swapShiftIds)
      : Promise.resolve({ data: [] as WorkShift[], error: null });
    const timeOffPromise = staff.legacy
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("staff_time_off_requests").select("*").eq("staff_id", staff.id).gte("end_date", today).order("start_date").limit(20);
    const notificationPromise = staff.legacy
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("staff_notifications").select("*").eq("staff_id", staff.id).order("created_at", { ascending: false }).limit(50);
    const [personalShiftResult, swapShiftResult, timeOffResult, notificationResult] = await Promise.all([
      personalShiftPromise,
      swapShiftPromise,
      timeOffPromise,
      notificationPromise,
    ]);
    if (personalShiftResult.error) throw personalShiftResult.error;
    if (swapShiftResult.error) throw swapShiftResult.error;
    if (timeOffResult.error) throw timeOffResult.error;
    if (notificationResult.error) throw notificationResult.error;

    const personalShifts = personalShiftResult.data || [];
    const allShiftMap = new Map([...personalShifts, ...(swapShiftResult.data || [])].map((shift) => [shift.id, shift]));
    const notifications = (notificationResult.data || []).map((notification) => ({
      id: notification.id,
      type: notification.notification_type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      readAt: notification.read_at,
      createdAt: notification.created_at,
    }));

    return NextResponse.json({
      canManage,
      legacy: staff.legacy,
      team: profiles
        .filter((profile) => profile.active && profile.id !== staff.id && (staff.role === "owner" || profile.role !== "owner"))
        .map((profile) => ({ id: profile.id, fullName: profile.full_name, role: profile.role })),
      shifts: personalShifts.map(shiftResponse),
      timeOff: (timeOffResult.data || []).map((request) => ({
        id: request.id,
        startDate: request.start_date,
        endDate: request.end_date,
        reason: request.reason,
        status: request.status,
      })),
      notifications,
      unreadCount: notifications.filter((notification) => !notification.readAt).length,
      swaps: swaps.map((swap) => swapResponse(swap, allShiftMap, profileMap)),
    });
  } catch (error) {
    console.error("Unable to load staff workspace:", error);
    return NextResponse.json({ error: "Unable to load My Workspace." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authorize();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    if (staff.legacy) return NextResponse.json({ error: "Create a Supabase Auth Owner account before requesting shift coverage." }, { status: 400 });
    const body = (await request.json()) as { shiftId?: unknown; offeredTo?: unknown; note?: unknown };
    const shiftId = typeof body.shiftId === "string" && uuidPattern.test(body.shiftId) ? body.shiftId : "";
    const offeredTo = typeof body.offeredTo === "string" && uuidPattern.test(body.offeredTo) ? body.offeredTo : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!shiftId || !offeredTo || note.length > 500 || offeredTo === staff.id) return NextResponse.json({ error: "Choose your future shift and a different active coworker." }, { status: 400 });

    const supabase = createAdminClient();
    const [shiftResult, targetResult, pendingResult, managerResult] = await Promise.all([
      supabase.from("staff_shifts").select("*").eq("id", shiftId).maybeSingle(),
      supabase.from("staff_profiles").select("*").eq("id", offeredTo).maybeSingle(),
      supabase.from("staff_shift_swap_requests").select("id").eq("shift_id", shiftId).eq("status", "pending").limit(1),
      supabase.from("staff_profiles").select("id").eq("active", true).in("role", ["owner", "manager"]),
    ]);
    if (shiftResult.error) throw shiftResult.error;
    if (targetResult.error) throw targetResult.error;
    if (pendingResult.error) throw pendingResult.error;
    if (managerResult.error) throw managerResult.error;
    const shift = shiftResult.data;
    const target = targetResult.data;
    if (!shift || shift.staff_id !== staff.id || shift.status !== "scheduled" || shift.shift_date < storeDateKey()) return NextResponse.json({ error: "Only your own future published shift can be offered." }, { status: 403 });
    if (!target?.active || (target.role === "owner" && staff.role !== "owner")) return NextResponse.json({ error: "Choose an eligible active coworker." }, { status: 400 });
    if (pendingResult.data?.length) return NextResponse.json({ error: "This shift already has a pending coverage request." }, { status: 409 });
    if (await hasApprovedTimeOff(target.id, shift.shift_date)) return NextResponse.json({ error: "That coworker has approved time off on this date." }, { status: 409 });
    if (await hasShiftConflict(target.id, shift)) return NextResponse.json({ error: "That coworker already has an overlapping shift." }, { status: 409 });

    const { data: swap, error } = await supabase.from("staff_shift_swap_requests").insert({
      shift_id: shift.id,
      requester_id: staff.id,
      offered_to: target.id,
      note,
    }).select("*").single();
    if (error || !swap) throw error || new Error("Coverage request was not created.");
    const message = `${staff.fullName} offered ${shiftNotificationMessage(shift.shift_date, shift.start_time, shift.end_time)} to ${target.full_name}.`;
    await recordWorkforceEvent({
      notifications: [
        { staffId: target.id, type: "swap", title: "Shift offered to you", message, link: "/admin" },
        ...(managerResult.data || []).filter((manager) => manager.id !== staff.id && manager.id !== target.id).map((manager) => ({ staffId: manager.id, type: "swap" as const, title: "Coverage request awaiting review", message, link: "/admin" })),
      ],
      activity: { actorId: staff.id, action: "swap.request", entityType: "shift_swap", entityId: swap.id, summary: message, metadata: { shiftId: shift.id, offeredTo: target.id } },
    });
    return NextResponse.json({ created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create shift coverage request:", error);
    return NextResponse.json({ error: "Unable to submit the coverage request." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authorize();
    if (authorization.response || !authorization.staff) return authorization.response;
    const staff = authorization.staff;
    const body = (await request.json()) as { kind?: unknown; id?: unknown; action?: unknown };
    const action = typeof body.action === "string" ? body.action : "";
    const id = typeof body.id === "string" && uuidPattern.test(body.id) ? body.id : "";
    const supabase = createAdminClient();

    if (body.kind === "notification") {
      if (staff.legacy) return NextResponse.json({ changed: true });
      if (action === "read_all") {
        const { error } = await supabase.from("staff_notifications").update({ read_at: new Date().toISOString() }).eq("staff_id", staff.id).is("read_at", null);
        if (error) throw error;
        return NextResponse.json({ changed: true });
      }
      if (!id || action !== "read") return NextResponse.json({ error: "Choose a notification action." }, { status: 400 });
      const { error } = await supabase.from("staff_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("staff_id", staff.id);
      if (error) throw error;
      return NextResponse.json({ changed: true });
    }

    if (body.kind !== "swap" || !id) return NextResponse.json({ error: "Choose a coverage request." }, { status: 400 });
    const { data: swap, error } = await supabase.from("staff_shift_swap_requests").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!swap) return NextResponse.json({ error: "Coverage request not found." }, { status: 404 });
    if (swap.status !== "pending") return NextResponse.json({ error: "This coverage request has already been reviewed." }, { status: 409 });

    if (action === "cancel") {
      if (staff.legacy || swap.requester_id !== staff.id) return NextResponse.json({ error: "Only the requester can cancel this request." }, { status: 403 });
      const { error: cancelError } = await supabase.from("staff_shift_swap_requests").update({ status: "cancelled" }).eq("id", swap.id);
      if (cancelError) throw cancelError;
      await recordWorkforceEvent({ activity: { actorId: staff.id, action: "swap.cancel", entityType: "shift_swap", entityId: swap.id, summary: `${staff.fullName} cancelled a coverage request.` } });
      return NextResponse.json({ changed: true });
    }

    const canManage = roleHasPermission(staff.role, "manage_schedule");
    if (!canManage || (action !== "approve" && action !== "decline")) return NextResponse.json({ error: "Only Owner or Manager can review coverage requests." }, { status: 403 });
    if (!staff.legacy && swap.requester_id === staff.id) return NextResponse.json({ error: "A manager cannot review their own coverage request. Cancel it or ask another manager." }, { status: 403 });
    const [shiftResult, requesterResult, targetResult] = await Promise.all([
      supabase.from("staff_shifts").select("*").eq("id", swap.shift_id).maybeSingle(),
      supabase.from("staff_profiles").select("*").eq("id", swap.requester_id).maybeSingle(),
      supabase.from("staff_profiles").select("*").eq("id", swap.offered_to).maybeSingle(),
    ]);
    if (shiftResult.error) throw shiftResult.error;
    if (requesterResult.error) throw requesterResult.error;
    if (targetResult.error) throw targetResult.error;
    const shift = shiftResult.data;
    const requesterProfile = requesterResult.data;
    const target = targetResult.data;
    if (!shift || !requesterProfile || !target) return NextResponse.json({ error: "The shift or employee account no longer exists." }, { status: 404 });
    if (!canManageProfile(staff, requesterProfile) || !canManageProfile(staff, target)) return NextResponse.json({ error: "Only an Owner can review coverage involving an Owner account." }, { status: 403 });
    const actorId = staff.legacy ? null : staff.id;

    if (action === "decline") {
      const { error: declineError } = await supabase.from("staff_shift_swap_requests").update({ status: "declined", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", swap.id);
      if (declineError) throw declineError;
      const message = `${staff.fullName} declined the coverage request for ${shiftNotificationMessage(shift.shift_date, shift.start_time, shift.end_time)}.`;
      await recordWorkforceEvent({
        notifications: [swap.requester_id, swap.offered_to].map((staffId) => ({ staffId, type: "swap" as const, title: "Coverage request declined", message, link: "/admin" })),
        activity: { actorId, action: "swap.decline", entityType: "shift_swap", entityId: swap.id, summary: message },
      });
      return NextResponse.json({ changed: true });
    }

    if (shift.status !== "scheduled" || shift.staff_id !== swap.requester_id || shift.shift_date < storeDateKey()) return NextResponse.json({ error: "The original future shift is no longer available." }, { status: 409 });
    if (!target.active) return NextResponse.json({ error: "The receiving employee account is not active." }, { status: 400 });
    if (await hasApprovedTimeOff(target.id, shift.shift_date)) return NextResponse.json({ error: "The receiving employee has approved time off on this date." }, { status: 409 });
    if (await hasShiftConflict(target.id, shift)) return NextResponse.json({ error: "The receiving employee has an overlapping shift." }, { status: 409 });

    const { data: reassignedShift, error: shiftError } = await supabase.from("staff_shifts").update({ staff_id: target.id, updated_by: actorId }).eq("id", shift.id).eq("staff_id", swap.requester_id).eq("status", "scheduled").select("id").maybeSingle();
    if (shiftError) throw shiftError;
    if (!reassignedShift) return NextResponse.json({ error: "The shift changed while this request was being reviewed. Refresh and try again." }, { status: 409 });
    const reviewedAt = new Date().toISOString();
    const { data: approvedSwap, error: approveError } = await supabase.from("staff_shift_swap_requests").update({ status: "approved", reviewed_by: actorId, reviewed_at: reviewedAt }).eq("id", swap.id).eq("status", "pending").select("id").maybeSingle();
    if (approveError || !approvedSwap) {
      await supabase.from("staff_shifts").update({ staff_id: swap.requester_id, updated_by: actorId }).eq("id", shift.id).eq("staff_id", target.id);
      if (approveError) throw approveError;
      return NextResponse.json({ error: "This coverage request was reviewed by someone else. Refresh the page." }, { status: 409 });
    }
    const message = `${staff.fullName} reassigned ${shiftNotificationMessage(shift.shift_date, shift.start_time, shift.end_time)} from ${requesterProfile.full_name} to ${target.full_name}.`;
    await recordWorkforceEvent({
      notifications: [swap.requester_id, swap.offered_to].map((staffId) => ({ staffId, type: "swap" as const, title: "Coverage request approved", message, link: "/admin" })),
      activity: { actorId, action: "swap.approve", entityType: "shift", entityId: shift.id, summary: message, metadata: { swapId: swap.id, from: swap.requester_id, to: target.id } },
    });
    return NextResponse.json({ changed: true });
  } catch (error) {
    console.error("Unable to update staff workspace:", error);
    return NextResponse.json({ error: "Unable to update My Workspace." }, { status: 500 });
  }
}
