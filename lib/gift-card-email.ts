import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
  })[character] || character);
}

export async function sendGiftCardEmail(input: {
  saleId: string;
  to: string;
  recipientName: string;
  purchaserEmail: string;
  amount: number;
  code: string;
  message: string;
  accountUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.GIFT_CARD_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { status: "manual_required" as const, providerId: null };

  const recipient = escapeHtml(input.recipientName || "there");
  const message = input.message ? `<p style="margin:20px 0;padding:16px;background:#f7f3e9;border-radius:12px">${escapeHtml(input.message)}</p>` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `gift-card/${input.saleId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Your $${input.amount.toFixed(2)} LEVIEN CAFE Gift Card`,
      html: `<div style="font-family:Arial,sans-serif;color:#143c2d;max-width:620px;margin:auto">
        <p style="letter-spacing:.16em;font-size:12px;font-weight:700">LEVIEN CAFE</p>
        <h1 style="font-family:Georgia,serif;font-size:38px">A little joy, ready to share.</h1>
        <p>Hi ${recipient}, a LEVIEN CAFE Gift Card has been prepared for you.</p>
        ${message}
        <div style="background:#0d4a36;color:white;padding:24px;border-radius:16px;margin:24px 0">
          <div style="font-size:12px;opacity:.75">GIFT CARD VALUE</div>
          <strong style="display:block;font-size:30px;margin:6px 0 18px">$${input.amount.toFixed(2)}</strong>
          <div style="font-size:12px;opacity:.75">SECURE CODE</div>
          <strong style="display:block;font-size:22px;letter-spacing:.08em;margin-top:6px">${escapeHtml(input.code)}</strong>
        </div>
        <p>Use this code at checkout or manage it from the purchaser's LEVIEN account.</p>
        <p><a href="${escapeHtml(input.accountUrl)}" style="color:#0d6b4c;font-weight:700">Open LEVIEN CAFE</a></p>
        <p style="font-size:12px;color:#68756f">Purchased by ${escapeHtml(input.purchaserEmail)}. Treat this code like cash.</p>
      </div>`,
    }),
  });
  const result = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok || !result?.id) throw new Error(result?.message || "Unable to send Gift Card email.");
  return { status: "sent" as const, providerId: result.id };
}

