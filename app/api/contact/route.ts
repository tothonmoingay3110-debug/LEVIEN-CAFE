import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const subjects = new Set(["General question", "Order support", "Catering", "Feedback", "Other"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (requestBodyExceeds(request, 12 * 1024)) {
      return NextResponse.json({ error: "Message is too large." }, { status: 413 });
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Bots commonly populate this visually hidden field. Return a normal success
    // response without storing the submission so the field cannot be probed.
    if (text(body.company, 200)) {
      return NextResponse.json({ received: true }, { status: 201 });
    }

    const name = text(body.name, 100);
    const email = text(body.email, 254).toLowerCase();
    const phone = text(body.phone, 30);
    const subject = text(body.subject, 80);
    const message = text(body.message, 2000);

    if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    if (!emailPattern.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (phone && phone.length < 7) return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
    if (!subjects.has(subject)) return NextResponse.json({ error: "Please choose a valid subject." }, { status: 400 });
    if (message.length < 10) return NextResponse.json({ error: "Please enter at least 10 characters." }, { status: 400 });

    const { error } = await createAdminClient().from("contact_messages").insert({
      name,
      email,
      phone,
      subject,
      message,
      status: "new",
      admin_note: "",
      handled_by: null,
      handled_at: null,
    });
    if (error) throw error;

    return NextResponse.json(
      { received: true },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Unable to save contact message:", error);
    return NextResponse.json(
      { error: "We could not send your message. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
