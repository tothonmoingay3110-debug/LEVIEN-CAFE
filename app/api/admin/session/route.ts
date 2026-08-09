import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  verifyAdminCredentials,
  verifyAdminSession,
} from "@/lib/admin-session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    return NextResponse.json({ authenticated: verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value) });
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
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyAdminCredentials(username, password)) {
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    const session = createAdminSession();
    const response = NextResponse.json({ authenticated: true });
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
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0, priority: "high" });
  return response;
}
