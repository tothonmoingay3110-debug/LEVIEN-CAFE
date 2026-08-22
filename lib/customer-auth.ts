import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CustomerSessionProfile = {
  id: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  membershipNumber: string;
  emailVerifiedAt: string | null;
  marketingOptIn: boolean;
  memberSince: string;
};

function mapProfile(profile: {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  membership_number: string;
  email_verified_at: string | null;
  marketing_opt_in: boolean;
  created_at: string;
}): CustomerSessionProfile {
  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone,
    membershipNumber: profile.membership_number,
    emailVerifiedAt: profile.email_verified_at,
    marketingOptIn: profile.marketing_opt_in,
    memberSince: profile.created_at,
  };
}

export async function getCustomerSession(options: { syncOrders?: boolean } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const admin = createAdminClient();
  let { data: profile, error: profileError } = await admin
    .from("customer_profiles")
    .select("id,auth_user_id,email,first_name,last_name,phone,membership_number,email_verified_at,marketing_opt_in,created_at")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile && data.user.user_metadata?.account_type === "customer" && data.user.email) {
    const created = await admin
      .from("customer_profiles")
      .insert({
        auth_user_id: data.user.id,
        email: data.user.email.toLowerCase(),
        first_name: String(data.user.user_metadata.first_name || "").slice(0, 100),
        last_name: String(data.user.user_metadata.last_name || "").slice(0, 100),
        phone: String(data.user.user_metadata.phone || "").slice(0, 30),
        email_verified_at: data.user.email_confirmed_at || null,
        marketing_opt_in: Boolean(data.user.user_metadata.marketing_opt_in),
      })
      .select("id,auth_user_id,email,first_name,last_name,phone,membership_number,email_verified_at,marketing_opt_in,created_at")
      .single();
    if (created.error) throw created.error;
    profile = created.data;
  }

  if (!profile) return null;
  if (data.user.email_confirmed_at && profile.email_verified_at !== data.user.email_confirmed_at) {
    const updated = await admin
      .from("customer_profiles")
      .update({
        email: (data.user.email || profile.email).toLowerCase(),
        email_verified_at: data.user.email_confirmed_at,
      })
      .eq("id", profile.id)
      .select("id,auth_user_id,email,first_name,last_name,phone,membership_number,email_verified_at,marketing_opt_in,created_at")
      .single();
    if (updated.error) throw updated.error;
    profile = updated.data;
  }

  if (options.syncOrders && profile.email_verified_at) {
    const { error: syncError } = await admin.rpc("sync_customer_profile_orders", {
      p_customer_profile_id: profile.id,
    });
    if (syncError) throw syncError;
  }

  return { user: data.user, profile: mapProfile(profile) };
}

