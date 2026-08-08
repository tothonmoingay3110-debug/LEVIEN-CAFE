import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    const body = (await request.json()) as { username?: unknown; password?: unknown };
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
    });
    return response;
  } catch (error) {
    console.error("Unable to create admin session:", error);
    return NextResponse.json({ error: "Admin login is not configured." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
