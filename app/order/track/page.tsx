"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { readOrders } from "@/lib/orders";
import type { CustomerOrder, OrderStatus } from "@/types";

const stages: OrderStatus[] = ["New", "Preparing", "Ready", "Completed"];
type TrackedOrder = Pick<CustomerOrder, "id" | "customer" | "type" | "status" | "total" | "items">;

export default function TrackOrderPage() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");

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
          setLoadError(localOrder ? "" : "We could not find this order.");
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

  return <>
    <Header />
    <main className="trackOrderPage">
      <section className="trackOrderCard">
        <span className="sectionLabel">Live order status</span>
        <h1>Track your order</h1>
        {!order && !loading ? <div className="trackMissing"><p>{loadError || "We could not find this order."}</p><Link className="button primary" href="/menu">Browse Menu</Link></div> : order ? <>
          <div className="trackOrderHeader"><div><span>Order</span><strong>{order.id}</strong></div><div><span>Customer</span><strong>{order.customer}</strong></div><div><span>Type</span><strong>{order.type}</strong></div></div>
          {loadError && <p className="trackSyncWarning" role="status">{loadError}</p>}
          {order.status === "Cancelled" ? <div className="orderCancelled"><strong>Order cancelled</strong><p>Please contact LEVIEN CAFE if you have questions about this order.</p></div> : <div className="orderTimeline">{stages.map((stage, index) => <div className={index <= currentIndex ? "complete" : ""} key={stage}>
            <span className="timelineDot">{index < currentIndex ? <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg> : index + 1}</span>
            <strong>{stage === "New" ? "Order received" : stage}</strong>
            <small>{stage === "New" ? "Your order is waiting for confirmation." : stage === "Preparing" ? "The team is preparing your order." : stage === "Ready" ? "Your order is ready for pickup or delivery." : "Your order has been completed."}</small>
          </div>)}</div>}
          <div className="trackOrderItems"><h2>Order details</h2>{order.items.map((item) => <article className={item.itemType === "combo" ? "trackComboItem" : ""} key={item.lineId}><div><strong>{item.quantity} × {item.name}</strong>{item.itemType === "combo" && item.comboItems?.length ? <div className="trackComboChildren">{item.comboItems.map((child) => <span key={child.productId}><b>{child.emoji} {child.name}</b><small>{[child.ice && `Ice ${child.ice}`, child.sugar && `Sugar ${child.sugar}`, ...child.toppings.map((t) => `+ ${t.name}`), child.note && `Note: ${child.note}`].filter(Boolean).join(" · ")}</small></span>)}</div> : <small>{[item.ice && `Ice ${item.ice}`, item.sugar && `Sugar ${item.sugar}`, ...item.toppings.map((t) => `+ ${t.name}`)].filter(Boolean).join(" · ")}</small>}</div><b>${(item.unitPrice * item.quantity).toFixed(2)}</b></article>)}<div className="trackTotal"><span>Total</span><strong>${order.total.toFixed(2)}</strong></div></div>
          <p className={`trackRefreshNote sync-${syncStatus}`}>{syncStatus === "live" ? "Live order updates connected." : "Automatic status checks are active while live updates reconnect."}</p>
        </> : null}
      </section>
    </main>
    <Footer />
  </>;
}
