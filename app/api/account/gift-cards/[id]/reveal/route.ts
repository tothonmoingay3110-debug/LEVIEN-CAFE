import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { decryptSecret } from "@/lib/secret-envelope";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to reveal this Gift Card." }, { status: 401 });
    const { id } = await context.params;
    const { data, error } = await createAdminClient()
      .from("gift_cards")
      .select("id,code_ciphertext,code_last_four")
      .eq("id", id)
      .eq("owner_profile_id", session.profile.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Gift Card not found." }, { status: 404 });
    if (!data.code_ciphertext) return NextResponse.json({ error: `Only the final digits ···· ${data.code_last_four} are available for this legacy card.` }, { status: 409 });
    return NextResponse.json({ code: decryptSecret(data.code_ciphertext) }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Unable to reveal Gift Card:", error);
    return NextResponse.json({ error: "Unable to reveal this Gift Card." }, { status: 500 });
  }
}

