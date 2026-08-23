import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import GiftCardPurchaseForm from "@/components/account/GiftCardPurchaseForm";
import { onlineGiftCardPurchaseEnabled } from "@/lib/features";
import { redirect } from "next/navigation";

export default function BuyGiftCardPage() {
  if (!onlineGiftCardPurchaseEnabled) redirect("/gift-card");

  return <><Header /><main className="giftCardBuyPage"><div className="giftCardBuyVisual"><div><span>LEVIEN CAFE</span><strong>GIFT CARD</strong><small>Good coffee, ready to share.</small></div></div><GiftCardPurchaseForm /></main><Footer /></>;
}
