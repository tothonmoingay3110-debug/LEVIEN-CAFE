import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffSession } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function strongPassword(password: string) {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const staff = await getStaffSession();
    if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (staff.legacy || !staff.authUserId) {
      return NextResponse.json({ error: "Legacy Owner passwords are managed through environment variables." }, { status: 400 });
    }

    const body = (await request.json()) as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || !strongPassword(newPassword) || currentPassword === newPassword) {
      return NextResponse.json({ error: "Use a new 8+ character password with uppercase, lowercase, number, and symbol." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    if (passwordError) return NextResponse.json({ error: passwordError.message }, { status: 400 });

    const { error: profileError } = await createAdminClient()
      .from("staff_profiles")
      .update({ must_change_password: false })
      .eq("id", staff.id);
    if (profileError) throw profileError;

    return NextResponse.json({ changed: true });
  } catch (error) {
    console.error("Unable to change staff password:", error);
    return NextResponse.json({ error: "Unable to change password." }, { status: 500 });
  }
}
