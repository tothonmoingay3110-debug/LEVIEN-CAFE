import "server-only";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] || character);

export async function sendEventBookingEmail(input: { id: string; referenceCode: string; eventName: string; eventDate: string; startTime: string; customerName: string; customerPhone: string; customerEmail: string; guestCount: number | null; notes: string; to: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EVENT_BOOKING_FROM_EMAIL?.trim() || process.env.GIFT_CARD_FROM_EMAIL?.trim();
  if (!apiKey || !from || !input.to) return { status: "not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `event-booking/${input.id}` }, body: JSON.stringify({ from, to: [input.to], subject: `New event request · ${input.eventName} · ${input.referenceCode}`, html: `<div style="font-family:Arial,sans-serif;color:#153b2e;max-width:620px"><p style="font-weight:800;letter-spacing:.12em">LEVIEN CAFE</p><h1 style="font-family:Georgia,serif">New event booking request</h1><p><b>Reference:</b> ${escapeHtml(input.referenceCode)}</p><p><b>Event:</b> ${escapeHtml(input.eventName)}</p><p><b>Date and time:</b> ${escapeHtml(input.eventDate)} at ${escapeHtml(input.startTime)}</p><p><b>Customer:</b> ${escapeHtml(input.customerName || "Not provided")}</p><p><b>Phone:</b> ${escapeHtml(input.customerPhone || "Not provided")}</p><p><b>Email:</b> ${escapeHtml(input.customerEmail || "Not provided")}</p><p><b>Guests:</b> ${input.guestCount ?? "Not provided"}</p><p><b>Details:</b><br>${escapeHtml(input.notes || "No additional details")}</p><p>Open Admin → Event Bookings to review and update this request.</p></div>` }) });
  if (!response.ok) throw new Error("Unable to send event booking email.");
  return { status: "sent" as const };
}
