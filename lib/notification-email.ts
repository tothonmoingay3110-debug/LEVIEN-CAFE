import "server-only";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] || character);

export { escapeHtml };

export async function sendNotificationEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim() || process.env.EVENT_BOOKING_FROM_EMAIL?.trim() || process.env.GIFT_CARD_FROM_EMAIL?.trim();
  if (!apiKey || !from || !input.to.trim()) return { status: "not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ from, to: [input.to.trim()], subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}.`);
  return { status: "sent" as const };
}

