"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStore } from "@/components/StoreProvider";
import { saveOrder } from "@/lib/orders";
import { useCustomerSession } from "@/components/CustomerSessionProvider";
import type { CustomerAccountData, LoyaltyRewardView } from "@/types/account";
import type { CustomerOrder, FulfillmentType } from "@/types";

const money = (value: number) => `$${value.toFixed(2)}`;
const promotionAttributionKey = "levien-promotion-attribution";

function currentPromotionAttribution() {
  try {
    const raw = window.sessionStorage.getItem(promotionAttributionKey);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as { promotionId?: unknown; attributedAt?: unknown };
    if (typeof value.promotionId !== "string" || typeof value.attributedAt !== "string") return undefined;
    const age = Date.now() - Date.parse(value.attributedAt);
    return Number.isFinite(age) && age >= 0 && age <= 7 * 86_400_000 ? value.promotionId : undefined;
  } catch {
    return undefined;
  }
}

type CheckoutErrors = Partial<
  Record<"firstName" | "lastName" | "phone" | "email" | "address" | "city" | "zip", string>
>;

type AppliedGiftCard = {
  code: string;
  lastFour: string;
  balance: number;
  expiresOn: string | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useCustomerSession();
  const { cart, subtotal, clearCart, ready } = useStore();
  const [type, setType] = useState<FulfillmentType>("Pickup");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [giftCardInput, setGiftCardInput] = useState("");
  const [giftCard, setGiftCard] = useState<AppliedGiftCard | null>(null);
  const [giftCardError, setGiftCardError] = useState("");
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);
  const [rewards, setRewards] = useState<LoyaltyRewardView[]>([]);
  const [rewardId, setRewardId] = useState("");
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const tax = useMemo(() => subtotal * 0.08, [subtotal]);
  const deliveryFee = type === "Delivery" ? 3.99 : 0;
  const total = subtotal + tax + deliveryFee;
  const selectedReward = rewards.find((reward) => reward.id === rewardId);
  const selectedRewardProductIds = selectedReward
    ? (selectedReward.productIds.length ? selectedReward.productIds : selectedReward.productId ? [selectedReward.productId] : [])
    : [];
  const rewardItem = cart
    .filter((item) => item.itemType === "product" && selectedRewardProductIds.includes(item.productId))
    .sort((left, right) => right.basePrice - left.basePrice)[0];
  const loyaltyDiscount = selectedReward && rewardItem ? Math.min(rewardItem.basePrice, total) : 0;
  const giftCardAmount = giftCard ? Math.min(giftCard.balance, Math.max(0, total - loyaltyDiscount)) : 0;
  const amountDue = Math.max(0, total - loyaltyDiscount - giftCardAmount);

  useEffect(() => {
    setPaymentCancelled(new URLSearchParams(window.location.search).get("payment") === "cancelled");
    if (!profile) { setRewards([]); setRewardId(""); return; }
    void fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const account = await response.json() as CustomerAccountData;
      setRewards(account.rewards.filter((reward) => reward.status === "issued" && reward.type === "free_product"));
    });
  }, [profile]);

  async function applyGiftCard() {
    const code = giftCardInput.trim();
    if (!code || checkingGiftCard) return;
    setCheckingGiftCard(true);
    setGiftCardError("");
    try {
      const response = await fetch("/api/gift-cards/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as {
        card?: { lastFour: string; balance: number; expiresOn: string | null; usable: boolean; status: string };
        error?: string;
      };
      if (!response.ok || !result.card) throw new Error(result.error || "Unable to check this Gift Card.");
      if (!result.card.usable) {
        const reason = result.card.status === "expired" ? "This Gift Card has expired."
          : result.card.status === "redeemed" ? "This Gift Card has no remaining balance."
            : "This Gift Card is not active.";
        throw new Error(reason);
      }
      setGiftCard({ code, lastFour: result.card.lastFour, balance: Number(result.card.balance), expiresOn: result.card.expiresOn });
    } catch (error) {
      setGiftCard(null);
      setGiftCardError(error instanceof Error ? error.message : "Unable to check this Gift Card.");
    } finally {
      setCheckingGiftCard(false);
    }
  }

  function clearError(field: keyof CheckoutErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim();
    const address = String(data.get("address") || "").trim();
    const city = String(data.get("city") || "").trim();
    const zip = String(data.get("zip") || "").trim();
    const nextErrors: CheckoutErrors = {};

    if (!firstName) nextErrors.firstName = "First name is required.";
    if (!lastName) nextErrors.lastName = "Last name is required.";

    if (!phone) {
      nextErrors.phone = "Phone number is required.";
    } else {
      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        nextErrors.phone = "Please enter a valid phone number.";
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (type === "Delivery") {
      if (!address) nextErrors.address = "Street address is required.";
      if (!city) nextErrors.city = "City is required.";
      if (!zip) {
        nextErrors.zip = "ZIP code is required.";
      } else if (!/^\d{5}(?:-\d{4})?$/.test(zip)) {
        nextErrors.zip = "Please enter a valid ZIP code.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalidField = Object.keys(nextErrors)[0];
      requestAnimationFrame(() => {
        const element = form.elements.namedItem(firstInvalidField);
        if (element instanceof HTMLElement) element.focus();
      });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const orderDetails = {
        firstName, lastName, phone, email, type,
        pickupTime: type === "Pickup" ? String(data.get("pickupTime") || "ASAP") : undefined,
        address: type === "Delivery" ? address : undefined,
        city: type === "Delivery" ? city : undefined,
        zip: type === "Delivery" ? zip : undefined,
        apartment: type === "Delivery" ? String(data.get("apartment") || "").trim() : undefined,
        payment: String(data.get("payment") || "Pay at Store"),
        subtotal, tax, deliveryFee, total,
        note: String(data.get("note") || "").trim(),
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderDetails, giftCardCode: giftCard?.code, loyaltyRewardId: rewardId || undefined, promotionId: currentPromotionAttribution(), items: cart }),
      });
      const result = (await response.json()) as {
        orderNumber?: string;
        trackingToken?: string;
        paymentMethod?: string;
        giftCardAmount?: number;
        giftCardBalance?: number | null;
        loyaltyDiscount?: number;
        amountDue?: number;
        paymentStatus?: CustomerOrder["paymentStatus"];
        checkoutUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !result.orderNumber || !result.trackingToken) throw new Error(result.error || "Unable to place order.");
      const id = result.orderNumber;
      try { window.sessionStorage.removeItem(promotionAttributionKey); } catch { /* Checkout remains successful. */ }
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      saveOrder({
        id,
        trackingToken: result.trackingToken,
        customer: `${firstName} ${lastName}`.trim(),
        ...orderDetails,
        payment: result.paymentMethod || orderDetails.payment,
        giftCardAmount: Number(result.giftCardAmount || 0),
        giftCardLastFour: giftCard?.lastFour,
        loyaltyDiscount: Number(result.loyaltyDiscount || 0),
        loyaltyRewardId: rewardId || undefined,
        paymentStatus: result.paymentStatus,
        amountDue: Number(result.amountDue ?? Math.max(0, total - Number(result.giftCardAmount || 0))),
        status: "New",
        createdAt: new Date().toISOString(),
        items: cart,
      });

      clearCart();
      router.push(`/order/success?order=${encodeURIComponent(id)}&token=${encodeURIComponent(result.trackingToken)}`);
    } catch (error) {
      console.error("Unable to place order:", error);
      setSubmitting(false);
      window.alert(error instanceof Error ? error.message : "We could not place your order. Please try again.");
    }
  }

  if (!ready) return null;

  return <>
    <Header />
    <main className="checkoutPage">
      <div className="checkoutHeading">
        <span className="sectionLabel">Secure order review</span>
        <h1>Checkout</h1>
        <p>Confirm your details and how you would like to receive your order.</p>
      </div>

      {!cart.length ? <section className="checkoutEmpty">
        <div className="checkoutEmptyIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 7h16"/><path d="M9 11a3 3 0 0 0 6 0"/></svg></div>
        <h2>Your order is empty</h2>
        <p>Add your favorite drinks or food before continuing to checkout.</p>
        <Link className="button primary" href="/menu">Browse Menu</Link>
      </section> : <form className="checkoutLayout" onSubmit={submit} noValidate>
        <div className="checkoutFormColumn">
          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>01</span><div><h2>Customer information</h2><p>We will use your phone number for order updates.</p></div></div>
            <div className="checkoutFields twoColumns">
              <label>
                <span className="fieldLabel">First name <span className="requiredMark">*</span></span>
                <input name="firstName" defaultValue={profile?.firstName || ""} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "firstName-error" : undefined} onChange={() => clearError("firstName")} />
                {errors.firstName && <span className="fieldError" id="firstName-error">{errors.firstName}</span>}
              </label>
              <label>
                <span className="fieldLabel">Last name <span className="requiredMark">*</span></span>
                <input name="lastName" defaultValue={profile?.lastName || ""} autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "lastName-error" : undefined} onChange={() => clearError("lastName")} />
                {errors.lastName && <span className="fieldError" id="lastName-error">{errors.lastName}</span>}
              </label>
              <label>
                <span className="fieldLabel">Phone number <span className="requiredMark">*</span></span>
                <input name="phone" defaultValue={profile?.phone || ""} type="tel" inputMode="tel" autoComplete="tel" placeholder="(215) 555-0123" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} onChange={() => clearError("phone")} />
                {errors.phone && <span className="fieldError" id="phone-error">{errors.phone}</span>}
              </label>
              <label>
                <span className="fieldLabel">Email <small className="optionalLabel">Optional</small></span>
                <input name="email" defaultValue={profile?.email || ""} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} onChange={() => clearError("email")} />
                {errors.email && <span className="fieldError" id="email-error">{errors.email}</span>}
              </label>
            </div>
          </section>

          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>02</span><div><h2>Order type</h2><p>Choose pickup or local delivery.</p></div></div>
            <div className="fulfillmentOptions">
              {(["Pickup", "Delivery"] as FulfillmentType[]).map((option) => <label className={type === option ? "selected" : ""} key={option}>
                <input type="radio" name="type" value={option} checked={type === option} onChange={() => { setType(option); if (option === "Pickup") setErrors((current) => ({ firstName: current.firstName, lastName: current.lastName, phone: current.phone, email: current.email })); }} />
                <span className="fulfillmentIcon" aria-hidden="true">{option === "Pickup" ? <svg viewBox="0 0 24 24"><path d="M4 10h16v10H4z"/><path d="M3 10 5 4h14l2 6"/><path d="M9 20v-6h6v6"/></svg> : <svg viewBox="0 0 24 24"><path d="M3 6h11v11H3z"/><path d="M14 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>}</span>
                <span><strong>{option}</strong><small>{option === "Pickup" ? "Collect at LEVIEN CAFE" : "Delivered to your address"}</small></span>
              </label>)}
            </div>
            {type === "Pickup" ? <div className="checkoutFields"><label>Pickup time<select name="pickupTime" defaultValue="ASAP"><option>ASAP</option><option>In 15 minutes</option><option>In 30 minutes</option><option>In 45 minutes</option></select></label></div> : <div className="checkoutFields twoColumns deliveryFields">
              <label className="wide">
                <span className="fieldLabel">Street address <span className="requiredMark">*</span></span>
                <input name="address" autoComplete="street-address" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "address-error" : undefined} onChange={() => clearError("address")} />
                {errors.address && <span className="fieldError" id="address-error">{errors.address}</span>}
              </label>
              <label>
                <span className="fieldLabel">City <span className="requiredMark">*</span></span>
                <input name="city" defaultValue="Philadelphia" autoComplete="address-level2" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "city-error" : undefined} onChange={() => clearError("city")} />
                {errors.city && <span className="fieldError" id="city-error">{errors.city}</span>}
              </label>
              <label>
                <span className="fieldLabel">ZIP code <span className="requiredMark">*</span></span>
                <input name="zip" inputMode="numeric" autoComplete="postal-code" aria-invalid={Boolean(errors.zip)} aria-describedby={errors.zip ? "zip-error" : undefined} onChange={() => clearError("zip")} />
                {errors.zip && <span className="fieldError" id="zip-error">{errors.zip}</span>}
              </label>
              <label className="wide"><span className="fieldLabel">Apartment / unit <small className="optionalLabel">Optional</small></span><input name="apartment" /></label>
            </div>}
          </section>

          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>03</span><div><h2>Payment & notes</h2><p>Online card payments are processed securely by Stripe.</p></div></div>
            {paymentCancelled && <div className="customerAuthError">Payment was cancelled. Your cart is still here; choose a method and try again.</div>}
            <div className="checkoutFields twoColumns">
              <label>Payment method<select name="payment" defaultValue="Online Card"><option>Online Card</option><option>Pay at Store</option><option>Cash on Delivery</option><option>Card at Pickup</option></select></label>
              <label className="wide"><span className="fieldLabel">Order note <small className="optionalLabel">Optional</small></span><textarea name="note" rows={4} placeholder="Allergies, delivery instructions, or anything we should know" /></label>
            </div>
            {profile ? <div className="giftCardRedeem"><div className="giftCardRedeemHeading"><div><span>Member Reward</span><strong>{rewards.length ? "Use an available reward" : "No free-product rewards available"}</strong></div></div>{rewards.length > 0 && <select value={rewardId} onChange={(event) => setRewardId(event.target.value)}><option value="">Do not use a reward</option>{rewards.map((reward) => { const eligibleIds = reward.productIds.length ? reward.productIds : reward.productId ? [reward.productId] : []; const inCart = cart.some((item) => item.itemType === "product" && eligibleIds.includes(item.productId)); return <option key={reward.id} value={reward.id} disabled={!inCart}>{reward.name}{reward.productNames.length ? ` (${reward.productNames.join(" / ")})` : ""}{inCart ? "" : " — add an eligible product first"}</option>; })}</select>}{selectedReward && !rewardItem && <div className="giftCardError">Add one of the eligible reward products to your cart before using it.</div>}</div> : <div className="giftCardRedeem"><span>Member Reward</span><p><Link href="/account/sign-in">Sign in</Link> to use earned rewards.</p></div>}
            <div className={`giftCardRedeem ${giftCard ? "applied" : ""}`}>
              <div className="giftCardRedeemHeading"><div><span>Gift Card</span><strong>{giftCard ? `Card ending ${giftCard.lastFour}` : "Have a LEVIEN Gift Card?"}</strong></div>{giftCard && <button type="button" onClick={() => { setGiftCard(null); setGiftCardInput(""); setGiftCardError(""); }}>Remove</button>}</div>
              {giftCard ? <div className="giftCardApplied"><span>✓</span><div><strong>{money(giftCard.balance)} available</strong><small>{money(giftCardAmount)} will be applied to this order.</small></div></div> : <div className="giftCardCodeRow"><input value={giftCardInput} maxLength={24} autoComplete="off" placeholder="LVGC-XXXX-XXXX-XXXX" aria-label="Gift Card code" onChange={(event) => { setGiftCardInput(event.target.value.toUpperCase()); setGiftCardError(""); }} /><button className="adminSecondary" type="button" disabled={!giftCardInput.trim() || checkingGiftCard} onClick={() => void applyGiftCard()}>{checkingGiftCard ? "Checking…" : "Apply"}</button></div>}
              {giftCardError && <div className="giftCardError" role="alert">{giftCardError}</div>}
              <Link href="/gift-card">Check balance</Link>
            </div>
          </section>
        </div>

        <aside className="checkoutSummary">
          <div className="checkoutSummaryHead"><div><span className="sectionLabel">Your selection</span><h2>Order summary</h2></div><Link href="/menu">Add more</Link></div>
          <div className="checkoutSummaryItems">{cart.map((item) => <article className={item.itemType === "combo" ? "checkoutComboItem" : ""} key={item.lineId}>
            <div className="checkoutItemIcon">{item.itemType === "combo" ? "🎁" : item.emoji}</div>
            <div><strong>{item.quantity} × {item.name}</strong><small>{money(item.unitPrice)} each</small>
              {item.itemType === "combo" && item.comboItems?.length ? <div className="checkoutComboItems">{item.comboItems.map((comboItem) => <div key={comboItem.productId}><b>{comboItem.emoji} {comboItem.name}</b><div className="checkoutItemOptions">{comboItem.ice && <span>Ice {comboItem.ice}</span>}{comboItem.sugar && <span>Sugar {comboItem.sugar}</span>}{comboItem.toppings.map((topping) => <span key={topping.id}>+ {topping.name}</span>)}</div>{comboItem.note && <em>{comboItem.note}</em>}</div>)}</div> : <><div className="checkoutItemOptions">{item.ice && <span>Ice {item.ice}</span>}{item.sugar && <span>Sugar {item.sugar}</span>}{item.toppings.map((topping) => <span key={topping.id}>+ {topping.name}</span>)}</div>{item.note && <em>{item.note}</em>}</>}
            </div>
            <b>{money(item.unitPrice * item.quantity)}</b>
          </article>)}</div>
          <div className="checkoutTotals">
            <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
            <div><span>Tax (8%)</span><b>{money(tax)}</b></div>
            {deliveryFee > 0 && <div><span>Delivery fee</span><b>{money(deliveryFee)}</b></div>}
            {giftCardAmount > 0 && <div className="checkoutGiftCardDiscount"><span>Gift Card ···· {giftCard?.lastFour}</span><b>−{money(giftCardAmount)}</b></div>}
            {loyaltyDiscount > 0 && <div className="checkoutGiftCardDiscount"><span>Member reward · {selectedReward?.name}</span><b>−{money(loyaltyDiscount)}</b></div>}
            <div className="checkoutGrandTotal"><span>{giftCardAmount > 0 ? "Amount due" : "Total"}</span><strong>{money(amountDue)}</strong></div>
          </div>
          <button className="button primary full checkoutSubmit" type="submit" disabled={submitting}>{submitting ? "Placing order…" : "Place Order"}</button>
          <p className="checkoutFinePrint">Your order is saved securely and appears immediately in the LEVIEN order queue.</p>
        </aside>
      </form>}
    </main>
    <Footer />
  </>;
}
