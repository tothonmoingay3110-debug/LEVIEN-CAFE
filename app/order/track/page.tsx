"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { readOrders } from "@/lib/orders";
import type { CustomerOrder, OrderStatus } from "@/types";

const stages: OrderStatus[] = ["New", "Preparing", "Ready", "Completed"];

export default function TrackOrderPage() {
  const [order, setOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    const refresh = () => setOrder(id ? readOrders().find((item) => item.id === id) || null : null);
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("levien-orders-updated", refresh);
    const timer = window.setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("levien-orders-updated", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const currentIndex = order ? stages.indexOf(order.status) : -1;

  return <>
    <Header />
    <main className="trackOrderPage">
      <section className="trackOrderCard">
        <span className="sectionLabel">Live local status</span>
        <h1>Track your order</h1>
        {!order ? <div className="trackMissing"><p>We could not find this order in the current browser.</p><Link className="button primary" href="/menu">Browse Menu</Link></div> : <>
          <div className="trackOrderHeader"><div><span>Order</span><strong>{order.id}</strong></div><div><span>Customer</span><strong>{order.customer}</strong></div><div><span>Type</span><strong>{order.type}</strong></div></div>
          {order.status === "Cancelled" ? <div className="orderCancelled"><strong>Order cancelled</strong><p>Please contact LEVIEN CAFE if you have questions about this order.</p></div> : <div className="orderTimeline">{stages.map((stage, index) => <div className={index <= currentIndex ? "complete" : ""} key={stage}>
            <span className="timelineDot">{index < currentIndex ? <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg> : index + 1}</span>
            <strong>{stage === "New" ? "Order received" : stage}</strong>
            <small>{stage === "New" ? "Your order is waiting for confirmation." : stage === "Preparing" ? "The team is preparing your order." : stage === "Ready" ? "Your order is ready for pickup or delivery." : "Your order has been completed."}</small>
          </div>)}</div>}
          <div className="trackOrderItems"><h2>Order details</h2>{order.items.map((item) => <article key={item.lineId}><div><strong>{item.quantity} × {item.name}</strong><small>{[item.ice && `Ice ${item.ice}`, item.sugar && `Sugar ${item.sugar}`, ...item.toppings.map((t) => `+ ${t.name}`)].filter(Boolean).join(" · ")}</small></div><b>${(item.unitPrice * item.quantity).toFixed(2)}</b></article>)}<div className="trackTotal"><span>Total</span><strong>${order.total.toFixed(2)}</strong></div></div>
          <p className="trackRefreshNote">This page refreshes the local order status automatically.</p>
        </>}
      </section>
    </main>
    <Footer />
  </>;
}
