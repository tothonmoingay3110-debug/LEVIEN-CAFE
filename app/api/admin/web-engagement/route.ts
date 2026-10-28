import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: string | null) {
  if (!value || !datePattern.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export async function GET(request: Request) {
  const { staff, allowed } = await getStaffAccess("view_sales_reports");
  if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = validDate(searchParams.get("from"));
  const to = validDate(searchParams.get("to"));
  if (!from || !to || from > to || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 365 * 86_400_000) {
    return NextResponse.json({ error: "Choose a valid date range of 366 days or less." }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("web_engagement_report", { p_from: from, p_to: to });
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load web engagement report:", error);
    return NextResponse.json({ error: "Unable to load web engagement report. Confirm the database migration has been applied." }, { status: 500 });
  }
}
