import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  verifyAdminCredentials,
} from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { getActiveStaffProfile, getStaffSession } from "@/lib/staff-auth";

export async function GET() {
  try {
    const staff = await getStaffSession();
    return NextResponse.json({ authenticated: Boolean(staff), staff });
  } catch (error) {
    console.error("Unable to verify admin session:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    let body: { username?: unknown; password?: unknown };
    try {
      body = (await request.json()) as { username?: unknown; password?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (username.includes("@")) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
      if (!error && data.user) {
        const staff = await getActiveStaffProfile(data.user);
        if (!staff) {
          await supabase.auth.signOut();
          return NextResponse.json({ error: "This account does not have active staff access." }, { status: 403 });
        }
        const response = NextResponse.json({ authenticated: true, staff });
        response.cookies.set(ADMIN_SESSION_COOKIE, "", {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 0,
          priority: "high",
        });
        return response;
      }
    }

    if (!verifyAdminCredentials(username, password)) {
      return NextResponse.json({ error: "Incorrect email, username, or password." }, { status: 401 });
    }

    const session = createAdminSession();
    const staff = {
      id: "legacy-owner",
      authUserId: null,
      email: username,
      fullName: "Store Owner",
      role: "owner" as const,
      legacy: true,
    };
    const response = NextResponse.json({ authenticated: true, staff });
    response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: session.maxAge,
      priority: "high",
    });
    return response;
  } catch (error) {
    console.error("Unable to create admin session:", error);
    return NextResponse.json({ error: "Admin login is not configured." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Unable to sign out Supabase staff session:", error);
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0, priority: "high" });
  return response;
}
