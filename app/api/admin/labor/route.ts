import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
type Compensation = Database["public"]["Tables"]["staff_compensation"]["Row"];
type WorkShift = Database["public"]["Tables"]["staff_shifts"]["Row"];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null) {
  if (!value || !datePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function minutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function shiftHours(shift: WorkShift) {
  return Math.max(0, (minutes(shift.end_time) - minutes(shift.start_time)) / 60);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dateKeys(from: string, days: number) {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

function compensationFor(map: Map<string, Compensation>, staffId: string) {
  const compensation = map.get(staffId);
  return {
    hourlyRate: Number(compensation?.hourly_rate || 0),
    weeklyHours: Number(compensation?.weekly_hours || 0),
    currency: compensation?.currency || "USD",
  };
}

function employeeSummary(profile: StaffProfile, compensation: Map<string, Compensation>, shifts: WorkShift[], rangeDays: number) {
  const pay = compensationFor(compensation, profile.id);
  const scheduledHours = shifts.reduce((total, shift) => total + shiftHours(shift), 0);
  const plannedHours = pay.weeklyHours * (rangeDays / 7);
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    active: profile.active,
    plannedHours: round(plannedHours),
    scheduledHours: round(scheduledHours),
    varianceHours: round(scheduledHours - plannedHours),
    hourlyRate: round(pay.hourlyRate),
    plannedCost: round(plannedHours * pay.hourlyRate),
    forecastCost: round(scheduledHours * pay.hourlyRate),
    shiftCount: shifts.length,
    currency: pay.currency,
  };
}

export async function GET(request: Request) {
  try {
    const access = await getStaffAccess("view_compensation");
    if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!access.allowed) return NextResponse.json({ error: "Labor planning requires Owner or Manager permission." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));
    if (!from || !to || from > to) return NextResponse.json({ error: "Choose a valid report date range." }, { status: 400 });
    const rangeDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    if (rangeDays < 1 || rangeDays > 31) return NextResponse.json({ error: "Labor reports support up to 31 days." }, { status: 400 });

    const supabase = createAdminClient();
    const [profileResult, compensationResult, shiftResult] = await Promise.all([
      supabase.from("staff_profiles").select("*").order("full_name"),
      supabase.from("staff_compensation").select("*"),
      supabase.from("staff_shifts").select("*").eq("status", "scheduled").gte("shift_date", from).lte("shift_date", to).order("shift_date").order("start_time"),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (compensationResult.error) throw compensationResult.error;
    if (shiftResult.error) throw shiftResult.error;

    const profiles = profileResult.data || [];
    const shifts = shiftResult.data || [];
    const compensation = new Map((compensationResult.data || []).map((item) => [item.staff_id, item]));
    const employees = profiles.map((profile) => employeeSummary(profile, compensation, shifts.filter((shift) => shift.staff_id === profile.id), rangeDays));
    const rateByStaff = new Map(profiles.map((profile) => [profile.id, compensationFor(compensation, profile.id).hourlyRate]));
    const daily = dateKeys(from, rangeDays).map((date) => {
      const dateShifts = shifts.filter((shift) => shift.shift_date === date);
      return {
        date,
        shiftCount: dateShifts.length,
        employeeCount: new Set(dateShifts.map((shift) => shift.staff_id)).size,
        scheduledHours: round(dateShifts.reduce((total, shift) => total + shiftHours(shift), 0)),
        forecastCost: round(dateShifts.reduce((total, shift) => total + shiftHours(shift) * (rateByStaff.get(shift.staff_id) || 0), 0)),
      };
    });

    return NextResponse.json({
      from,
      to,
      rangeDays,
      currency: "USD",
      totals: {
        plannedHours: round(employees.reduce((total, employee) => total + employee.plannedHours, 0)),
        scheduledHours: round(employees.reduce((total, employee) => total + employee.scheduledHours, 0)),
        varianceHours: round(employees.reduce((total, employee) => total + employee.varianceHours, 0)),
        plannedCost: round(employees.reduce((total, employee) => total + employee.plannedCost, 0)),
        forecastCost: round(employees.reduce((total, employee) => total + employee.forecastCost, 0)),
        shiftCount: shifts.length,
      },
      employees,
      daily,
    });
  } catch (error) {
    console.error("Unable to build labor report:", error);
    return NextResponse.json({ error: "Unable to build the labor forecast." }, { status: 500 });
  }
}
