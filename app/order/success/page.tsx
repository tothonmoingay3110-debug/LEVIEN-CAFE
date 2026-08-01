"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { readOrders } from "@/lib/orders";
import type { CustomerOrder } from "@/types";

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (id) setOrder(readOrders().find((item) => item.id === id) || null);
  }, []);

  return <>
    <Header />
    <main className="orderResultPage">
      <section className="orderResultCard">
        <div className="orderSuccessMark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></div>
        <span className="sectionLabel">Order confirmed</span>
        <h1>Thank you{order?.firstName ? `, ${order.firstName}` : ""}.</h1>
        <p>Your order has been received by LEVIEN CAFE.</p>
        <div className="orderResultNumber"><span>Order number</span><strong>{order?.id || "Loading…"}</strong></div>
        <div className="orderResultDetails">
          <div><span>Order type</span><strong>{order?.type || "—"}</strong></div>
          <div><span>Estimated ready</span><strong>{order?.type === "Delivery" ? "30–45 minutes" : order?.pickupTime === "ASAP" ? "15–20 minutes" : order?.pickupTime || "15–20 minutes"}</strong></div>
          <div><span>Total</span><strong>{order ? `$${order.total.toFixed(2)}` : "—"}</strong></div>
        </div>
        <div className="orderResultActions">
          <Link className="button primary" href={order ? `/order/track?order=${encodeURIComponent(order.id)}` : "/menu"}>Track Order</Link>
          <Link className="button secondary" href="/">Back Home</Link>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
