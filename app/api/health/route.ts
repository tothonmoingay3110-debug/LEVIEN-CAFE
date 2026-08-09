import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const { error } = await createAdminClient()
      .from("site_content")
      .select("id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      services: { database: "ok" },
      checkedAt,
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("Production health check failed:", error);
    return NextResponse.json({
      status: "degraded",
      services: { database: "unavailable" },
      checkedAt,
    }, { status: 503, headers: responseHeaders });
  }
}
