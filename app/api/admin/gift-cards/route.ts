import { NextResponse } from "next/server";
import { generateGiftCardCode } from "@/lib/gift-cards";
import { encryptSecret } from "@/lib/secret-envelope";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authorizeGiftCards() {
  const access = await getStaffAccess("manage_gift_cards");
  if (!access.staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (!access.allowed) return { response: NextResponse.json({ error: "Gift Cards require Owner or Manager permission." }, { status: 403 }), staff: access.staff };
  return { response: null, staff: access.staff };
}

export async function GET() {
  try {
    const authorization = await authorizeGiftCards();
    if (authorization.response) return authorization.response;
    const supabase = createAdminClient();
    const [{ data: cards, error: cardError }, { data: transactions, error: transactionError }, { data: sales, error: salesError }] = await Promise.all([
      supabase.from("gift_cards").select("id,code_last_four,initial_balance,balance,currency,recipient_name,recipient_email,note,status,expires_on,issued_by,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("gift_card_transactions").select("id,gift_card_id,transaction_type,amount,balance_after,order_id,created_by,note,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("gift_card_sales").select("gift_card_id,sales_channel,tender_type,receipt_reference,status,delivery_status,paid_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (cardError) throw cardError;
    if (transactionError) throw transactionError;
    if (salesError) throw salesError;

    const orderIds = [...new Set((transactions || []).map((item) => item.order_id).filter((id): id is string => Boolean(id)))];
    const { data: orders, error: orderError } = orderIds.length
      ? await supabase.from("orders").select("id,order_number").in("id", orderIds)
      : { data: [], error: null };
    if (orderError) throw orderError;
    const orderNumbers = new Map((orders || []).map((order) => [order.id, order.order_number]));
    const today = new Date().toISOString().slice(0, 10);
    const saleByCard = new Map((sales || []).filter((sale) => sale.gift_card_id).map((sale) => [sale.gift_card_id, sale]));

    return NextResponse.json({
      cards: (cards || []).map((card) => ({
        id: card.id,
        lastFour: card.code_last_four,
        initialBalance: Number(card.initial_balance),
        balance: Number(card.balance),
        currency: card.currency,
        recipientName: card.recipient_name,
        recipientEmail: card.recipient_email || "",
        note: card.note,
        status: card.expires_on && card.expires_on < today ? "expired" : card.status,
        storedStatus: card.status,
        expiresOn: card.expires_on,
        issuedBy: card.issued_by,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        sale: saleByCard.get(card.id) ? {
          channel: saleByCard.get(card.id)!.sales_channel,
          tenderType: saleByCard.get(card.id)!.tender_type,
          receiptReference: saleByCard.get(card.id)!.receipt_reference,
          status: saleByCard.get(card.id)!.status,
          deliveryStatus: saleByCard.get(card.id)!.delivery_status,
          paidAt: saleByCard.get(card.id)!.paid_at,
        } : null,
        transactions: (transactions || []).filter((item) => item.gift_card_id === card.id).map((item) => ({
          id: item.id,
          type: item.transaction_type,
          amount: Number(item.amount),
          balanceAfter: Number(item.balance_after),
          orderNumber: item.order_id ? orderNumbers.get(item.order_id) || null : null,
          note: item.note,
          createdAt: item.created_at,
        })),
      })),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load gift cards:", error);
    return NextResponse.json({ error: "Unable to load Gift Cards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const authorization = await authorizeGiftCards();
    if (authorization.response || !authorization.staff) return authorization.response;
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

    let body: { amount?: unknown; recipientName?: unknown; recipientEmail?: unknown; note?: unknown; expiresOn?: unknown; tenderType?: unknown; receiptReference?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? Math.round(body.amount * 100) / 100 : 0;
    const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim().slice(0, 120) : "";
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase().slice(0, 254) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    const expiresOn = typeof body.expiresOn === "string" ? body.expiresOn.trim() : "";
    const tenderType = body.tenderType === "cash" || body.tenderType === "card_terminal" || body.tenderType === "complimentary" ? body.tenderType : null;
    const receiptReference = typeof body.receiptReference === "string" ? body.receiptReference.trim().slice(0, 120) : "";
    const today = new Date().toISOString().slice(0, 10);
    if (amount < 5 || amount > 1000) return NextResponse.json({ error: "Amount must be between $5 and $1,000." }, { status: 400 });
    if (recipientEmail && !emailPattern.test(recipientEmail)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
    if (expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || expiresOn < today)) return NextResponse.json({ error: "Expiry must be today or later." }, { status: 400 });
    if (!tenderType) return NextResponse.json({ error: "Select how this Gift Card was paid." }, { status: 400 });
    if (tenderType === "complimentary" && authorization.staff.role !== "owner") return NextResponse.json({ error: "Only the Owner can create a complimentary Gift Card." }, { status: 403 });
    if (tenderType !== "complimentary" && receiptReference.length < 2) return NextResponse.json({ error: "A receipt or terminal reference is required." }, { status: 400 });

    const code = generateGiftCardCode();
    const { data, error } = await createAdminClient().rpc("issue_gift_card_v3", {
      p_code_hash: code.hash,
      p_code_last_four: code.lastFour,
      p_code_ciphertext: encryptSecret(code.formatted),
      p_amount: amount,
      p_recipient_name: recipientName,
      p_recipient_email: recipientEmail,
      p_note: note,
      p_expires_on: expiresOn || null,
      p_tender_type: tenderType,
      p_receipt_reference: receiptReference,
      p_created_by: authorization.staff.legacy ? null : authorization.staff.id,
      p_purchaser_email: authorization.staff.email,
    });
    if (error) throw error;
    const giftCardId = data?.[0]?.gift_card_id;
    if (!giftCardId) throw new Error("Gift Card was not created.");

    await recordWorkforceEvent({ activity: {
      actorId: authorization.staff.legacy ? null : authorization.staff.id,
      action: "gift_card_created",
      entityType: "gift_card",
      entityId: giftCardId,
      summary: `Gift Card ending ${code.lastFour} created for $${amount.toFixed(2)} with ${tenderType}.`,
      metadata: { lastFour: code.lastFour, amount, tenderType, receiptReference },
    } });

    return NextResponse.json({
      card: { id: giftCardId, code: code.formatted, lastFour: code.lastFour, initialBalance: amount },
    }, { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to issue gift card:", error);
    return NextResponse.json({ error: "Unable to issue Gift Card." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const authorization = await authorizeGiftCards();
    if (authorization.response || !authorization.staff) return authorization.response;
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

    let body: { id?: unknown; status?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = body.status === "active" || body.status === "disabled" ? body.status : null;
    if (!uuidPattern.test(id) || !status) return NextResponse.json({ error: "Invalid Gift Card update." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: current, error: currentError } = await supabase.from("gift_cards").select("id,code_last_four,balance,status,expires_on").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Gift Card not found." }, { status: 404 });
    if (current.status === "redeemed" || Number(current.balance) <= 0) return NextResponse.json({ error: "A redeemed Gift Card cannot be reactivated." }, { status: 409 });
    if (status === "active" && current.expires_on && current.expires_on < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "An expired Gift Card cannot be reactivated." }, { status: 409 });

    const { data, error } = await supabase.from("gift_cards").update({ status }).eq("id", id).select("id,status,updated_at").single();
    if (error) throw error;
    await recordWorkforceEvent({ activity: {
      actorId: authorization.staff.legacy ? null : authorization.staff.id,
      action: "gift_card_status_updated",
      entityType: "gift_card",
      entityId: id,
      summary: `Gift Card ending ${current.code_last_four} marked ${status}.`,
      metadata: { lastFour: current.code_last_four, status },
    } });
    return NextResponse.json({ card: { id: data.id, status: data.status, updatedAt: data.updated_at } });
  } catch (error) {
    console.error("Unable to update gift card:", error);
    return NextResponse.json({ error: "Unable to update Gift Card." }, { status: 500 });
  }
}
