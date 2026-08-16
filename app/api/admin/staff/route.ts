import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffAccess } from "@/lib/staff-auth";
import { isStaffRole, type StaffRole } from "@/lib/staff-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
type StaffCompensation = Database["public"]["Tables"]["staff_compensation"]["Row"];

function temporaryPassword() {
  return `${randomBytes(12).toString("base64url")}aA1!`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validNumber(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function employeeResponse(profile: StaffProfile, compensation?: StaffCompensation | null) {
  const hourlyRate = Number(compensation?.hourly_rate || 0);
  const weeklyHours = Number(compensation?.weekly_hours || 0);
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    active: profile.active,
    hourlyRate,
    weeklyHours,
    estimatedWeeklyPay: hourlyRate * weeklyHours,
    mustChangePassword: profile.must_change_password,
    createdAt: profile.created_at,
  };
}

async function authorizeManagement() {
  const access = await getStaffAccess("manage_staff");
  if (!access.staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (!access.allowed) return { response: NextResponse.json({ error: "Employee management requires Manager or Owner permission." }, { status: 403 }), staff: null };
  return { response: null, staff: access.staff };
}

async function readTarget(id: string) {
  const { data, error } = await createAdminClient()
    .from("staff_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function canManageTarget(actorRole: StaffRole, targetRole: StaffRole, nextRole?: StaffRole) {
  if (actorRole === "owner") return true;
  return targetRole !== "owner" && nextRole !== "owner";
}

export async function GET() {
  try {
    const authorization = await authorizeManagement();
    if (authorization.response) return authorization.response;

    const supabase = createAdminClient();
    const [profileResult, compensationResult] = await Promise.all([
      supabase.from("staff_profiles").select("*").order("full_name"),
      supabase.from("staff_compensation").select("*"),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (compensationResult.error) throw compensationResult.error;

    const compensations = new Map(
      (compensationResult.data || []).map((item) => [item.staff_id, item]),
    );
    return NextResponse.json({
      employees: (profileResult.data || []).map((profile) => employeeResponse(profile, compensations.get(profile.id))),
    });
  } catch (error) {
    console.error("Unable to load employees:", error);
    return NextResponse.json({ error: "Unable to load employees." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 16 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authorizeManagement();
    if (authorization.response || !authorization.staff) return authorization.response;

    const body = (await request.json()) as Record<string, unknown>;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const role = body.role;
    const hourlyRate = validNumber(body.hourlyRate, 0, 10000);
    const weeklyHours = validNumber(body.weeklyHours, 0, 168);

    if (!fullName || fullName.length > 120 || !validEmail(email) || !isStaffRole(role) || hourlyRate === null || weeklyHours === null) {
      return NextResponse.json({ error: "Enter a valid name, email, role, hourly rate, and weekly hours." }, { status: 400 });
    }
    if (role === "owner" && authorization.staff.role !== "owner") {
      return NextResponse.json({ error: "Only an Owner can create another Owner." }, { status: 403 });
    }

    const supabase = createAdminClient();
    const password = temporaryPassword();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (authError || !authData.user) {
      const duplicate = authError?.message.toLowerCase().includes("already") || authError?.message.toLowerCase().includes("registered");
      return NextResponse.json({ error: duplicate ? "An Auth user already exists for this email." : "Unable to create the employee login." }, { status: duplicate ? 409 : 500 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .insert({
        auth_user_id: authData.user.id,
        email,
        full_name: fullName,
        phone,
        role,
        active: true,
        must_change_password: true,
      })
      .select("*")
      .single();
    if (profileError || !profile) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError || new Error("Employee profile was not created.");
    }

    const { data: compensation, error: compensationError } = await supabase
      .from("staff_compensation")
      .insert({ staff_id: profile.id, hourly_rate: hourlyRate, weekly_hours: weeklyHours, currency: "USD" })
      .select("*")
      .single();
    if (compensationError || !compensation) {
      await supabase.from("staff_profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw compensationError || new Error("Employee compensation was not created.");
    }

    return NextResponse.json({ employee: employeeResponse(profile, compensation), temporaryPassword: password }, { status: 201 });
  } catch (error) {
    console.error("Unable to create employee:", error);
    return NextResponse.json({ error: "Unable to create employee." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 16 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const authorization = await authorizeManagement();
    if (authorization.response || !authorization.staff) return authorization.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const target = id ? await readTarget(id) : null;
    if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const resetPassword = body.action === "reset_password";
    const requestedRole = typeof body.role === "string" && isStaffRole(body.role) ? body.role : target.role;
    if (!canManageTarget(authorization.staff.role, target.role, requestedRole)) {
      return NextResponse.json({ error: "Only an Owner can manage Owner accounts." }, { status: 403 });
    }

    if (resetPassword) {
      if (authorization.staff.id === target.id) {
        return NextResponse.json({ error: "Use My Account to change your own password." }, { status: 400 });
      }
      const password = temporaryPassword();
      const supabase = createAdminClient();
      const { error: passwordError } = await supabase.auth.admin.updateUserById(target.auth_user_id, { password });
      if (passwordError) throw passwordError;
      const { error: profileError } = await supabase.from("staff_profiles").update({ must_change_password: true }).eq("id", target.id);
      if (profileError) throw profileError;
      return NextResponse.json({ temporaryPassword: password });
    }

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const active = typeof body.active === "boolean" ? body.active : target.active;
    const hourlyRate = validNumber(body.hourlyRate, 0, 10000);
    const weeklyHours = validNumber(body.weeklyHours, 0, 168);
    if (!fullName || fullName.length > 120 || hourlyRate === null || weeklyHours === null) {
      return NextResponse.json({ error: "Enter a valid name, hourly rate, and weekly hours." }, { status: 400 });
    }
    if (authorization.staff.id === target.id && (!active || requestedRole !== target.role)) {
      return NextResponse.json({ error: "You cannot deactivate or change your own role." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error: authError } = await supabase.auth.admin.updateUserById(target.auth_user_id, {
      user_metadata: { full_name: fullName },
    });
    if (authError) throw authError;
    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .update({ full_name: fullName, phone, role: requestedRole, active })
      .eq("id", target.id)
      .select("*")
      .single();
    if (profileError || !profile) throw profileError || new Error("Employee profile was not updated.");
    const { data: compensation, error: compensationError } = await supabase
      .from("staff_compensation")
      .upsert({ staff_id: target.id, hourly_rate: hourlyRate, weekly_hours: weeklyHours, currency: "USD" }, { onConflict: "staff_id" })
      .select("*")
      .single();
    if (compensationError || !compensation) throw compensationError || new Error("Employee compensation was not updated.");

    return NextResponse.json({ employee: employeeResponse(profile, compensation) });
  } catch (error) {
    console.error("Unable to update employee:", error);
    return NextResponse.json({ error: "Unable to update employee." }, { status: 500 });
  }
}
