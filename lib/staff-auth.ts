import "server-only";

import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isStaffRole,
  roleHasPermission,
  type StaffPermission,
  type StaffSessionSummary,
} from "@/lib/staff-permissions";

export async function getActiveStaffProfile(
  authUser: { id: string; email?: string | null },
): Promise<StaffSessionSummary | null> {
  const { data: profile, error } = await createAdminClient()
    .from("staff_profiles")
    .select("id,auth_user_id,email,full_name,role,active")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile || !profile.active || !isStaffRole(profile.role)) return null;

  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    email: profile.email || authUser.email || "",
    fullName: profile.full_name,
    role: profile.role,
    legacy: false,
  };
}

async function legacyOwnerSession(): Promise<StaffSessionSummary | null> {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) return null;
    return {
      id: "legacy-owner",
      authUserId: null,
      email: process.env.ADMIN_USERNAME || "admin",
      fullName: "Store Owner",
      role: "owner",
      legacy: true,
    };
  } catch {
    return null;
  }
}

export async function getStaffSession(): Promise<StaffSessionSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return getActiveStaffProfile(data.user);
    }
  } catch (error) {
    console.error("Unable to verify Supabase staff session:", error);
  }

  return legacyOwnerSession();
}

export async function getStaffAccess(permission: StaffPermission) {
  const staff = await getStaffSession();
  return { staff, allowed: Boolean(staff && roleHasPermission(staff.role, permission)) };
}
