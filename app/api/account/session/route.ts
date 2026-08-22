import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";

export async function GET() {
  try {
    const session = await getCustomerSession();
    return NextResponse.json({
      authenticated: Boolean(session),
      profile: session?.profile || null,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to read customer session:", error);
    return NextResponse.json({ authenticated: false, profile: null }, { status: 500 });
  }
}

