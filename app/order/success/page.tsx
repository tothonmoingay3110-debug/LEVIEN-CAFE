"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OrderTrackingQr } from "@/components/OrderTrackingQr";
import { readOrders } from "@/lib/orders";
import type { CustomerOrder } from "@/types";
import { useStore } from "@/components/StoreProvider";

type ConfirmedPaymentOrder = { trackingToken: string; orderNumber: string; firstName: string; type: "Pickup" | "Delivery"; pickupTime: string | null; total: number; amountDue: number; giftCardAmount: number; loyaltyDiscount: number; paymentStatus: string; status: string };

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [paidOrder, setPaidOrder] = useState<ConfirmedPaymentOrder | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const { clearCart } = useStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("order");
    const sessionId = params.get("session_id");
    if (sessionId) {
      void fetch(`/api/payments/session?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { paid?: boolean; order?: ConfirmedPaymentOrder; error?: string };
        if (!response.ok || !result.paid || !result.order) return setPaymentError(result.error || "Payment has not been confirmed yet. Please refresh in a moment.");
        setPaidOrder(result.order); setTrackingToken(result.order.trackingToken); clearCart();
      }).catch(() => setPaymentError("Unable to confirm payment. Your card will not be charged twice; please contact LEVIEN if this continues."));
      return;
    }
    const storedOrder = id ? readOrders().find((item) => item.id === id) || null : null;
    setOrder(storedOrder);
    setTrackingToken(params.get("token") || storedOrder?.trackingToken || "");
  }, [clearCart]);

  const display = paidOrder ? { id: paidOrder.orderNumber, firstName: paidOrder.firstName, type: paidOrder.type, pickupTime: paidOrder.pickupTime || undefined, total: paidOrder.total, amountDue: paidOrder.amountDue, giftCardAmount: paidOrder.giftCardAmount, loyaltyDiscount: paidOrder.loyaltyDiscount } : order;

  return <>
    <Header />
    <main className="orderResultPage">
      <section className="orderResultCard">
        <div className="orderSuccessMark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></div>
        <span className="sectionLabel">{paymentError ? "Payment confirmation" : "Order confirmed"}</span>
        <h1>{paymentError ? "We’re checking your payment." : `Thank you${display?.firstName ? `, ${display.firstName}` : ""}.`}</h1>
        <p>{paymentError || "Your order has been received by LEVIEN CAFE."}</p>
        <div className="orderResultNumber"><span>Order number</span><strong>{display?.id || (paymentError ? "Pending confirmation" : "Loading…")}</strong></div>
        <div className="orderResultDetails">
          <div><span>Order type</span><strong>{display?.type || "—"}</strong></div>
          <div><span>Estimated ready</span><strong>{display?.type === "Delivery" ? "30–45 minutes" : display?.pickupTime === "ASAP" ? "15–20 minutes" : display?.pickupTime || "15–20 minutes"}</strong></div>
          <div><span>{display?.giftCardAmount || display?.loyaltyDiscount ? "Amount paid / due" : "Total"}</span><strong>{display ? `$${(display.amountDue ?? display.total).toFixed(2)}` : "—"}</strong>{Boolean(display?.giftCardAmount) && <small>Gift Card applied: −${display?.giftCardAmount?.toFixed(2)}</small>}{Boolean(display?.loyaltyDiscount) && <small>Member reward: −${display?.loyaltyDiscount?.toFixed(2)}</small>}</div>
        </div>
        <div className="orderResultActions">
          <Link className="button primary" href={display && trackingToken ? `/order/track?order=${encodeURIComponent(display.id)}&token=${encodeURIComponent(trackingToken)}` : "/menu"}>Track Order</Link>
          <Link className="button secondary" href="/">Back Home</Link>
        </div>
        {display && trackingToken && !paymentError ? <OrderTrackingQr orderNumber={display.id} trackingToken={trackingToken} /> : null}
      </section>
    </main>
    <Footer />
  </>;
}
