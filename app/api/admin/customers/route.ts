import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";

async function authorize() {
  const access = await getStaffAccess("view_customers");
  if (!access.staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (!access.allowed) return { response: NextResponse.json({ error: "Customer access is not permitted." }, { status: 403 }), staff: access.staff };
  return { response: null, staff: access.staff };
}

export async function GET() {
  try {
    const access = await authorize();
    if (access.response) return access.response;
    const { data, error } = await createAdminClient().from("customer_profiles").select("id,auth_user_id,email,first_name,last_name,phone,membership_number,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ profiles: (data || []).map((profile) => ({ id: profile.id, authUserId: profile.auth_user_id, email: profile.email || "", firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone, membershipNumber: profile.membership_number, memberSince: profile.created_at, onlineAccess: Boolean(profile.auth_user_id) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load customer profiles:", error);
    return NextResponse.json({ error: "Unable to load customer membership data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 16 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const access = await authorize();
    if (access.response || !access.staff) return access.response;
    const body = await request.json() as { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown };
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phoneDigits = phone.replace(/\D/g, "");
    if (!firstName || (!email && !phoneDigits)) return NextResponse.json({ error: "Enter a first name and either an email or phone number." }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const db = createAdminClient();
    if (email) {
      const { data: duplicateEmail } = await db.from("customer_profiles").select("id").ilike("email", email).maybeSingle();
      if (duplicateEmail) return NextResponse.json({ error: "A member with this email already exists." }, { status: 409 });
    }
    if (phoneDigits) {
      const { data: profiles } = await db.from("customer_profiles").select("id,phone");
      if ((profiles || []).some((profile) => String(profile.phone || "").replace(/\D/g, "") === phoneDigits)) return NextResponse.json({ error: "A member with this phone number already exists." }, { status: 409 });
    }

    let authUserId: string | null = null;
    if (email) {
      const origin = new URL(request.url).origin;
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/callback?next=/account/reset-password`, data: { account_type: "customer", first_name: firstName, last_name: lastName, phone } });
      if (error) throw error;
      authUserId = data.user?.id || null;
    }

    let profile = authUserId ? (await db.from("customer_profiles").select("id").eq("auth_user_id", authUserId).maybeSingle()).data : null;
    if (profile) {
      const { data, error } = await db.from("customer_profiles").update({ first_name: firstName, last_name: lastName, phone, email: email || null }).eq("id", profile.id).select("id,membership_number").single();
      if (error) throw error;
      profile = data;
    } else {
      const { data, error } = await db.from("customer_profiles").insert({ auth_user_id: authUserId, email: email || null, first_name: firstName, last_name: lastName, phone }).select("id,membership_number").single();
      if (error) throw error;
      profile = data;
    }
    await db.from("staff_audit_log").insert({ actor_id: access.staff.legacy ? null : access.staff.id, action: "customer_member_created", entity_type: "customer_profile", entity_id: profile.id, summary: `${firstName} ${lastName}`.trim(), metadata: { email: email || null, phone, onlineAccess: Boolean(authUserId), actorRole: access.staff.role } });
    return NextResponse.json({ created: true, membershipNumber: "membership_number" in profile ? profile.membership_number : "", invitationSent: Boolean(email) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create customer member:", error);
    return NextResponse.json({ error: "Unable to create this customer. Check for duplicate contact information and try again." }, { status: 500 });
  }
}
