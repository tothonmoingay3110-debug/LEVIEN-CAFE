import "server-only";

import { sendGiftCardEmail } from "@/lib/gift-card-email";
import { decryptSecret } from "@/lib/secret-envelope";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deliverGiftCardSale(saleId: string, origin: string) {
  const db = createAdminClient();
  const { data: sale, error } = await db.from("gift_card_sales").select("id,purchaser_email,recipient_name,recipient_email,personal_message,amount,delivery_status,gift_card_id").eq("id", saleId).single();
  if (error) throw error;
  if (sale.delivery_status === "sent") return;
  if (!sale.gift_card_id) throw new Error("Gift Card sale has not been fulfilled.");
  const { data: card, error: cardError } = await db.from("gift_cards").select("code_ciphertext").eq("id", sale.gift_card_id).single();
  if (cardError) throw cardError;
  if (!card.code_ciphertext) throw new Error("Gift Card code is unavailable.");
  try {
    const delivery = await sendGiftCardEmail({ saleId: sale.id, to: sale.recipient_email, recipientName: sale.recipient_name, purchaserEmail: sale.purchaser_email, amount: Number(sale.amount), code: decryptSecret(card.code_ciphertext), message: sale.personal_message, accountUrl: `${origin}/account` });
    await db.from("gift_card_sales").update({ delivery_status: delivery.status, delivery_provider_id: delivery.providerId }).eq("id", sale.id);
  } catch (deliveryError) {
    await db.from("gift_card_sales").update({ delivery_status: "failed" }).eq("id", sale.id);
    throw deliveryError;
  }
}
