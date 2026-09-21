import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const models = new Set(["Café / dine-in shop", "Takeaway / express shop", "Food truck", "Mobile cart / trailer", "Kiosk", "Shop-in-shop / food court", "Drive-thru"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 16 * 1024)) return NextResponse.json({ error: "Inquiry is too large." }, { status: 413 });
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    const body = await request.json() as Record<string, unknown>;
    if (text(body.company, 200)) return NextResponse.json({ received: true }, { status: 201 });
    const name = text(body.name, 100), phone = text(body.phone, 30), email = text(body.email, 254).toLowerCase();
    const location = text(body.location, 180), franchiseModel = text(body.franchiseModel, 80), message = text(body.message, 2000);
    const products = Array.isArray(body.products) ? body.products.map((item) => text(item, 30)).filter((item) => item === "Bánh mì" || item === "Coffee") : [];
    if (name.length < 2) return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    if (phone.replace(/\D/g, "").length < 7) return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
    if (email && !emailPattern.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (location.length < 2) return NextResponse.json({ error: "Please enter your proposed location." }, { status: 400 });
    if (!models.has(franchiseModel)) return NextResponse.json({ error: "Please choose a franchise model." }, { status: 400 });
    if (!products.length) return NextResponse.json({ error: "Please choose at least one product." }, { status: 400 });
    const { error } = await createAdminClient().from("contact_messages").insert({ name, phone, email: email || null, subject: "Franchise inquiry", message, location, franchise_model: franchiseModel, franchise_products: products, status: "new", admin_note: "", handled_by: null, handled_at: null });
    if (error) throw error;
    return NextResponse.json({ received: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save franchise inquiry:", error);
    return NextResponse.json({ error: "We could not send your inquiry. Please try again." }, { status: 500 });
  }
}
