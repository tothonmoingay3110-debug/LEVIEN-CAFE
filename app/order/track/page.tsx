"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCustomerSession } from "@/components/CustomerSessionProvider";
import { readOrders } from "@/lib/orders";
import type { CustomerOrder, OrderStatus } from "@/types";

const stages: OrderStatus[] = ["New", "Preparing", "Ready", "Completed"];
type TrackedOrder = Pick<CustomerOrder, "id" | "customer" | "type" | "status" | "total" | "giftCardAmount" | "amountDue" | "items">;

export default function TrackOrderPage() {
  const { authenticated } = useCustomerSession();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [lookupOrder, setLookupOrder] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("order");
    const localOrder = id ? readOrders().find((item) => item.id === id) || null : null;
    const token = params.get("token") || localOrder?.trackingToken || "";
    let active = true;
    let refreshing = false;

    const refresh = async () => {
      if (refreshing) return;
      if (!token) {
        if (active) {
          setOrder(localOrder);
          setLoadError("");
          setLoading(false);
        }
        return;
      }
      refreshing = true;
      try {
        const response = await fetch(`/api/orders/track?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const result = (await response.json()) as { order?: TrackedOrder; error?: string };
        if (response.status === 404) {
          if (active) {
            setOrder(null);
            setLoadError("We could not find this order.");
          }
          return;
        }
        if (!response.ok || !result.order) throw new Error(result.error || "Unable to load order.");
        if (active) {
          setOrder(result.order);
          setLoadError("");
        }
      } catch (error) {
        console.error("Unable to refresh order tracking:", error);
        if (active) {
          setOrder((current) => current || localOrder);
          setLoadError("Live updates are temporarily unavailable. Status checks will continue automatically.");
          setSyncStatus("polling");
        }
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const eventSource = token ? new EventSource(`/api/orders/track/stream?token=${encodeURIComponent(token)}`) : null;
    eventSource?.addEventListener("ready", () => setSyncStatus("live"));
    eventSource?.addEventListener("orders", () => void refresh());
    eventSource?.addEventListener("unavailable", () => setSyncStatus("polling"));
    if (eventSource) eventSource.onerror = () => setSyncStatus("polling");

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      active = false;
      eventSource?.close();
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []); // The tracking link is fixed for the lifetime of this page.

  const currentIndex = order ? stages.indexOf(order.status) : -1;

  const findOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError("");
    const normalizedOrder = lookupOrder.trim().replace(/\s+/g, "").toUpperCase();
    const localOrder = readOrders().find((item) => item.id.toUpperCase() === normalizedOrder);
    if (localOrder?.trackingToken) {
      window.location.assign(`/order/track?order=${encodeURIComponent(localOrder.id)}&token=${encodeURIComponent(localOrder.trackingToken)}`);
      return;
    }

    setLookupLoading(true);
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: normalizedOrder, phone: lookupPhone }),
      });
      const result = await response.json() as { trackingToken?: string; error?: string };
      if (!response.ok || !result.trackingToken) throw new Error(result.error || "Unable to verify this order.");
      window.location.assign(`/order/track?order=${encodeURIComponent(normalizedOrder)}&token=${encodeURIComponent(result.trackingToken)}`);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Unable to verify this order.");
      setLookupLoading(false);
    }
  };

  return <>
    <Header />
    <main className="trackOrderPage">
      <section className="trackOrderCard">
        <span className="sectionLabel">Live order status</span>
        <h1>Track your order</h1>
        {!order && !loading ? <div className="trackLookup">
          <p>Scan the QR on your confirmation screen, or enter the order number and at least the last 4 digits of the checkout phone number.</p>
          {loadError ? <p className="trackLookupError" role="alert">{loadError}</p> : null}
          <form onSubmit={(event) => void findOrder(event)}>
            <label><span>Order number</span><input value={lookupOrder} onChange={(event) => setLookupOrder(event.target.value)} placeholder="LV260823001" autoComplete="off" required /></label>
            <label><span>Phone verification</span><input value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder="Last 4 digits or full phone" inputMode="tel" autoComplete="tel" minLength={4} required /></label>
            <button className="button primary" type="submit" disabled={lookupLoading}>{lookupLoading ? "Finding order…" : "Track Order"}</button>
          </form>
          {lookupError ? <p className="trackLookupError" role="alert">{lookupError}</p> : null}
          <small>Your phone check prevents someone with only an order number from viewing your order details.</small>
          <Link href="/menu">Browse Menu</Link>
        </div> : order ? <>
          <div className="trackOrderHeader"><div><span>Order</span><strong>{order.id}</strong></div><div><span>Customer</span><strong>{order.customer}</strong></div><div><span>Type</span><strong>{order.type}</strong></div></div>
          {loadError && <p className="trackSyncWarning" role="status">{loadError}</p>}
          {order.status === "Cancelled" ? <div className="orderCancelled"><strong>Order cancelled</strong><p>Please contact LEVIEN CAFE if you have questions about this order.</p></div> : <div className="orderTimeline">{stages.map((stage, index) => <div className={index <= currentIndex ? "complete" : ""} key={stage}>
            <span className="timelineDot">{index < currentIndex ? <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg> : index + 1}</span>
            <strong>{stage === "New" ? "Order received" : stage}</strong>
            <small>{stage === "New" ? "Your order is waiting for confirmation." : stage === "Preparing" ? "The team is preparing your order." : stage === "Ready" ? "Your order is ready for pickup or delivery." : "Your order has been completed."}</small>
          </div>)}</div>}
          <div className="trackOrderItems"><h2>Order details</h2>{order.items.map((item) => <article className={item.itemType === "combo" ? "trackComboItem" : ""} key={item.lineId}><div><strong>{item.quantity} × {item.name}</strong>{item.itemType === "combo" && item.comboItems?.length ? <div className="trackComboChildren">{item.comboItems.map((child) => <span key={child.productId}><b>{child.emoji} {child.name}</b><small>{[child.ice && `Ice ${child.ice}`, child.sugar && `Sugar ${child.sugar}`, ...child.toppings.map((t) => `+ ${t.name}`), child.note && `Note: ${child.note}`].filter(Boolean).join(" · ")}</small></span>)}</div> : <small>{[item.ice && `Ice ${item.ice}`, item.sugar && `Sugar ${item.sugar}`, ...item.toppings.map((t) => `+ ${t.name}`)].filter(Boolean).join(" · ")}</small>}</div><b>${(item.unitPrice * item.quantity).toFixed(2)}</b></article>)}{Boolean(order.giftCardAmount) && <div className="trackTotal trackGiftCardDiscount"><span>Gift Card</span><strong>−${order.giftCardAmount?.toFixed(2)}</strong></div>}<div className="trackTotal"><span>{order.giftCardAmount ? "Amount due" : "Total"}</span><strong>${(order.amountDue ?? order.total).toFixed(2)}</strong></div></div>
          <div className="trackOrderActions"><Link className="button primary" href={authenticated ? "/account" : "/menu"}>{authenticated ? "Back to My Account" : "Back to Menu"}</Link><Link className="button secondary" href="/menu">{order.status === "Completed" ? "Order Again" : "View Menu"}</Link></div>
          <p className={`trackRefreshNote sync-${syncStatus}`}>{syncStatus === "live" ? "Live order updates connected." : "Automatic status checks are active while live updates reconnect."}</p>
        </> : null}
      </section>
    </main>
    <Footer />
  </>;
}
