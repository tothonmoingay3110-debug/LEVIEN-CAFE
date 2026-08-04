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

type CheckoutErrors = Partial<
  Record<"firstName" | "lastName" | "phone" | "email" | "address" | "city" | "zip", string>
>;

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, clearCart, ready } = useStore();
  const [type, setType] = useState<FulfillmentType>("Pickup");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const tax = useMemo(() => subtotal * 0.08, [subtotal]);
  const deliveryFee = type === "Delivery" ? 3.99 : 0;
  const total = subtotal + tax + deliveryFee;

  function clearError(field: keyof CheckoutErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
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
      const existing = readOrders();
      const id = createOrderNumber(existing);

      saveOrder({
        id,
        customer: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        phone,
        email,
        type,
        pickupTime: type === "Pickup" ? String(data.get("pickupTime") || "ASAP") : undefined,
        address: type === "Delivery" ? address : undefined,
        city: type === "Delivery" ? city : undefined,
        zip: type === "Delivery" ? zip : undefined,
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
    } catch (error) {
      console.error("Unable to place order:", error);
      setSubmitting(false);
      window.alert("We could not place your order. Please try again.");
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
                <input name="firstName" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "firstName-error" : undefined} onChange={() => clearError("firstName")} />
                {errors.firstName && <span className="fieldError" id="firstName-error">{errors.firstName}</span>}
              </label>
              <label>
                <span className="fieldLabel">Last name <span className="requiredMark">*</span></span>
                <input name="lastName" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "lastName-error" : undefined} onChange={() => clearError("lastName")} />
                {errors.lastName && <span className="fieldError" id="lastName-error">{errors.lastName}</span>}
              </label>
              <label>
                <span className="fieldLabel">Phone number <span className="requiredMark">*</span></span>
                <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(215) 555-0123" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} onChange={() => clearError("phone")} />
                {errors.phone && <span className="fieldError" id="phone-error">{errors.phone}</span>}
              </label>
              <label>
                <span className="fieldLabel">Email <small className="optionalLabel">Optional</small></span>
                <input name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} onChange={() => clearError("email")} />
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
            <div className="checkoutCardHead"><span>03</span><div><h2>Payment & notes</h2><p>Online card payment will be connected in a later release.</p></div></div>
            <div className="checkoutFields twoColumns">
              <label>Payment method<select name="payment"><option>Pay at Store</option><option>Cash on Delivery</option><option>Card at Pickup</option></select></label>
              <label className="wide"><span className="fieldLabel">Order note <small className="optionalLabel">Optional</small></span><textarea name="note" rows={4} placeholder="Allergies, delivery instructions, or anything we should know" /></label>
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
