import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null) {
  if (!value || !datePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function dateDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function minutes(time: string) {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function shiftHours(startTime: string, endTime: string) {
  return Math.max(0, (minutes(endTime) - minutes(startTime)) / 60);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request) {
  try {
    const { staff, allowed } = await getStaffAccess("view_workforce_reports");
    if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!allowed) return NextResponse.json({ error: "Only Owner or Manager can view staff reports." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));
    if (!from || !to || from > to || dateDifference(from, to) > 92) return NextResponse.json({ error: "Choose a valid report range of 93 days or less." }, { status: 400 });

    const supabase = createAdminClient();
    const [profileResult, shiftResult, timeOffResult] = await Promise.all([
      supabase.from("staff_profiles").select("*").order("full_name"),
      supabase.from("staff_shifts").select("*").eq("status", "scheduled").gte("shift_date", from).lte("shift_date", to).order("shift_date").order("start_time"),
      supabase.from("staff_time_off_requests").select("*").eq("status", "approved").lte("start_date", to).gte("end_date", from),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (shiftResult.error) throw shiftResult.error;
    if (timeOffResult.error) throw timeOffResult.error;
    const profiles = profileResult.data || [];
    const shifts = shiftResult.data || [];
    const timeOff = timeOffResult.data || [];
    const shiftIds = shifts.map((shift) => shift.id);
    const swapResult = shiftIds.length
      ? await supabase.from("staff_shift_swap_requests").select("*").in("shift_id", shiftIds)
      : { data: [], error: null };
    if (swapResult.error) throw swapResult.error;
    const swaps = swapResult.data || [];

    const employees = profiles.map((profile) => {
      const employeeShifts = shifts.filter((shift) => shift.staff_id === profile.id);
      const employeeTimeOff = timeOff.filter((item) => item.staff_id === profile.id);
      const scheduledHours = employeeShifts.reduce((total, shift) => total + shiftHours(shift.start_time, shift.end_time), 0);
      const timeOffDays = employeeTimeOff.reduce((total, item) => {
        const clippedStart = item.start_date < from ? from : item.start_date;
        const clippedEnd = item.end_date > to ? to : item.end_date;
        return total + dateDifference(clippedStart, clippedEnd) + 1;
      }, 0);
      return {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        active: profile.active,
        shiftCount: employeeShifts.length,
        scheduledDays: new Set(employeeShifts.map((shift) => shift.shift_date)).size,
        scheduledHours: round(scheduledHours),
        approvedTimeOffDays: timeOffDays,
        coverageRequests: swaps.filter((swap) => swap.requester_id === profile.id).length,
        coverageAccepted: swaps.filter((swap) => swap.offered_to === profile.id && swap.status === "approved").length,
      };
    });

    const daily = Array.from({ length: dateDifference(from, to) + 1 }, (_, index) => {
      const date = new Date(Date.parse(`${from}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10);
      const dailyShifts = shifts.filter((shift) => shift.shift_date === date);
      return {
        date,
        employeeCount: new Set(dailyShifts.map((shift) => shift.staff_id)).size,
        shiftCount: dailyShifts.length,
        scheduledHours: round(dailyShifts.reduce((total, shift) => total + shiftHours(shift.start_time, shift.end_time), 0)),
      };
    });

    return NextResponse.json({
      from,
      to,
      rangeDays: dateDifference(from, to) + 1,
      totals: {
        employees: profiles.filter((profile) => profile.active).length,
        shiftCount: shifts.length,
        scheduledHours: round(employees.reduce((total, employee) => total + employee.scheduledHours, 0)),
        approvedTimeOffDays: employees.reduce((total, employee) => total + employee.approvedTimeOffDays, 0),
        coverageRequests: swaps.length,
      },
      employees,
      daily,
    });
  } catch (error) {
    console.error("Unable to load workforce report:", error);
    return NextResponse.json({ error: "Unable to load the staff report." }, { status: 500 });
  }
}
