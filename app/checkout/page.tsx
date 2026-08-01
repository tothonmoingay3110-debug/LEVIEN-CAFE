"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStore } from "@/components/StoreProvider";
import { createOrderNumber, readOrders, saveOrder } from "@/lib/orders";
import type { FulfillmentType } from "@/types";

const money = (value: number) => `$${value.toFixed(2)}`;

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, clearCart, ready } = useStore();
  const [type, setType] = useState<FulfillmentType>("Pickup");
  const [submitting, setSubmitting] = useState(false);
  const tax = useMemo(() => subtotal * 0.08, [subtotal]);
  const deliveryFee = type === "Delivery" ? 3.99 : 0;
  const total = subtotal + tax + deliveryFee;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || submitting) return;
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    const existing = readOrders();
    const id = createOrderNumber(existing);
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();

    saveOrder({
      id,
      customer: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      type,
      pickupTime: type === "Pickup" ? String(data.get("pickupTime") || "ASAP") : undefined,
      address: type === "Delivery" ? String(data.get("address") || "").trim() : undefined,
      city: type === "Delivery" ? String(data.get("city") || "").trim() : undefined,
      zip: type === "Delivery" ? String(data.get("zip") || "").trim() : undefined,
      apartment: type === "Delivery" ? String(data.get("apartment") || "").trim() : undefined,
      payment: String(data.get("payment") || "Pay at Store"),
      subtotal,
      tax,
      deliveryFee,
      total,
      status: "New",
      createdAt: new Date().toISOString(),
      note: String(data.get("note") || "").trim(),
      items: cart,
    });
    clearCart();
    router.push(`/order/success?order=${encodeURIComponent(id)}`);
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
      </section> : <form className="checkoutLayout" onSubmit={submit}>
        <div className="checkoutFormColumn">
          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>01</span><div><h2>Customer information</h2><p>We will use your phone number for order updates.</p></div></div>
            <div className="checkoutFields twoColumns">
              <label>First name<input name="firstName" required autoComplete="given-name" /></label>
              <label>Last name<input name="lastName" required autoComplete="family-name" /></label>
              <label>Phone number<input name="phone" required type="tel" autoComplete="tel" /></label>
              <label>Email <small>Optional</small><input name="email" type="email" autoComplete="email" /></label>
            </div>
          </section>

          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>02</span><div><h2>Order type</h2><p>Choose pickup or local delivery.</p></div></div>
            <div className="fulfillmentOptions">
              {(["Pickup", "Delivery"] as FulfillmentType[]).map((option) => <label className={type === option ? "selected" : ""} key={option}>
                <input type="radio" name="type" value={option} checked={type === option} onChange={() => setType(option)} />
                <span className="fulfillmentIcon" aria-hidden="true">{option === "Pickup" ? <svg viewBox="0 0 24 24"><path d="M4 10h16v10H4z"/><path d="M3 10 5 4h14l2 6"/><path d="M9 20v-6h6v6"/></svg> : <svg viewBox="0 0 24 24"><path d="M3 6h11v11H3z"/><path d="M14 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>}</span>
                <span><strong>{option}</strong><small>{option === "Pickup" ? "Collect at LEVIEN CAFE" : "Delivered to your address"}</small></span>
              </label>)}
            </div>
            {type === "Pickup" ? <div className="checkoutFields"><label>Pickup time<select name="pickupTime" defaultValue="ASAP"><option>ASAP</option><option>In 15 minutes</option><option>In 30 minutes</option><option>In 45 minutes</option></select></label></div> : <div className="checkoutFields twoColumns deliveryFields">
              <label className="wide">Street address<input name="address" required autoComplete="street-address" /></label>
              <label>City<input name="city" required defaultValue="Philadelphia" autoComplete="address-level2" /></label>
              <label>ZIP code<input name="zip" required inputMode="numeric" autoComplete="postal-code" /></label>
              <label className="wide">Apartment / unit <small>Optional</small><input name="apartment" /></label>
            </div>}
          </section>

          <section className="checkoutCard">
            <div className="checkoutCardHead"><span>03</span><div><h2>Payment & notes</h2><p>Online card payment will be connected in a later release.</p></div></div>
            <div className="checkoutFields twoColumns">
              <label>Payment method<select name="payment"><option>Pay at Store</option><option>Cash on Delivery</option><option>Card at Pickup</option></select></label>
              <label className="wide">Order note <small>Optional</small><textarea name="note" rows={4} placeholder="Allergies, delivery instructions, or anything we should know" /></label>
            </div>
          </section>
        </div>

        <aside className="checkoutSummary">
          <div className="checkoutSummaryHead"><div><span className="sectionLabel">Your selection</span><h2>Order summary</h2></div><Link href="/menu">Add more</Link></div>
          <div className="checkoutSummaryItems">{cart.map((item) => <article key={item.lineId}>
            <div className="checkoutItemIcon">{item.emoji}</div>
            <div><strong>{item.quantity} × {item.name}</strong><small>{money(item.unitPrice)} each</small>
              <div className="checkoutItemOptions">{item.ice && <span>Ice {item.ice}</span>}{item.sugar && <span>Sugar {item.sugar}</span>}{item.toppings.map((topping) => <span key={topping.id}>+ {topping.name}</span>)}</div>
              {item.note && <em>{item.note}</em>}
            </div>
            <b>{money(item.unitPrice * item.quantity)}</b>
          </article>)}</div>
          <div className="checkoutTotals">
            <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
            <div><span>Tax (8%)</span><b>{money(tax)}</b></div>
            {deliveryFee > 0 && <div><span>Delivery fee</span><b>{money(deliveryFee)}</b></div>}
            <div className="checkoutGrandTotal"><span>Total</span><strong>{money(total)}</strong></div>
          </div>
          <button className="button primary full checkoutSubmit" type="submit" disabled={submitting}>{submitting ? "Placing order…" : "Place Order"}</button>
          <p className="checkoutFinePrint">This Sprint 4.3 order is saved locally and appears immediately in Admin → Orders.</p>
        </aside>
      </form>}
    </main>
    <Footer />
  </>;
}
