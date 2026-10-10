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
    const { data, error } = await createAdminClient().from("customer_profiles").select("id,auth_user_id,email,first_name,last_name,phone,membership_number,email_verified_at,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ profiles: (data || []).map((profile) => ({ id: profile.id, authUserId: profile.auth_user_id, email: profile.email || "", firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone, membershipNumber: profile.email && profile.email_verified_at ? profile.membership_number : "", verificationPending: Boolean(profile.email && !profile.email_verified_at), memberSince: profile.created_at, onlineAccess: Boolean(profile.auth_user_id && profile.email_verified_at) })) }, { headers: { "Cache-Control": "no-store" } });
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
    if (!firstName || !email) return NextResponse.json({ error: "Enter a first name and email address. Membership requires email verification." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

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
    return NextResponse.json({ created: true, verificationPending: true, invitationSent: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create customer member:", error);
    return NextResponse.json({ error: "Unable to create this customer. Check for duplicate contact information and try again." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 16 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const access = await authorize();
    if (access.response || !access.staff) return access.response;
    if (access.staff.role !== "owner" && access.staff.role !== "manager") {
      return NextResponse.json({ error: "Only an owner or manager can link an existing customer to an email address." }, { status: 403 });
    }
    const body = await request.json() as { profileId?: unknown; email?: unknown };
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(profileId) || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Choose a customer and enter a valid email address." }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: profile, error: profileError } = await db.from("customer_profiles")
      .select("id,auth_user_id,email,email_verified_at,first_name,last_name,phone")
      .eq("id", profileId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.auth_user_id || profile.email || profile.email_verified_at) {
      return NextResponse.json({ error: "Only a customer profile without an email or online account can be invited here." }, { status: 409 });
    }
    const { data: duplicate, error: duplicateError } = await db.from("customer_profiles").select("id").ilike("email", email).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return NextResponse.json({ error: "This email is already linked to a customer." }, { status: 409 });

    // Use a distinct account type so the signup trigger does not create a second profile.
    const origin = new URL(request.url).origin;
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/account/reset-password`,
      data: { account_type: "legacy_customer_invitation", first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone },
    });
    if (inviteError || !invited.user?.id) {
      return NextResponse.json({ error: inviteError?.message || "Unable to send the invitation." }, { status: 409 });
    }

    const { data: linked, error: linkError } = await db.from("customer_profiles")
      .update({ auth_user_id: invited.user.id, email })
      .eq("id", profile.id).is("auth_user_id", null).is("email", null)
      .select("id").maybeSingle();
    if (linkError || !linked) {
      if (linkError) throw linkError;
      return NextResponse.json({ error: "Invitation sent, but the profile changed before it could be linked. Contact support before retrying." }, { status: 409 });
    }

    await db.from("staff_audit_log").insert({
      actor_id: access.staff.legacy ? null : access.staff.id,
      action: "customer_email_invited",
      entity_type: "customer_profile",
      entity_id: profile.id,
      summary: `${profile.first_name} ${profile.last_name}`.trim(),
      metadata: { email, actorRole: access.staff.role },
    });
    return NextResponse.json({ invited: true, verificationPending: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to invite existing customer:", error);
    return NextResponse.json({ error: "Unable to invite this customer. Check the email and try again." }, { status: 500 });
  }
}
