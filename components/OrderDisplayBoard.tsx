"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DisplayStatus = "New" | "Preparing" | "Ready" | "Completed";
type DisplayOrder = {
  orderNumber: string;
  status: DisplayStatus;
  createdAt: string;
  updatedAt: string;
};
type DisplayResponse = {
  orders?: DisplayOrder[];
  completedVisibilityMinutes?: number;
  error?: string;
};
type SyncState = "connecting" | "live" | "polling";

const pollingInterval = 15000;

function displayTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function OrderTicket({ order, tone }: { order: DisplayOrder; tone: "preparing" | "ready" | "completed" }) {
  return <article className={`orderDisplayTicket ${tone}`}>
    <span className="orderDisplayTicketLabel">Order</span>
    <strong>{order.orderNumber}</strong>
    <small>{tone === "completed" ? "Completed" : tone === "ready" ? "Ready now" : order.status === "New" ? "Order received" : "In progress"} · {displayTime(tone === "completed" ? order.updatedAt : order.createdAt)}</small>
  </article>;
}

function EmptyColumn({ message }: { message: string }) {
  return <div className="orderDisplayEmpty"><span>✓</span><p>{message}</p></div>;
}

export function OrderDisplayBoard() {
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [completedMinutes, setCompletedMinutes] = useState(20);
  const [fullscreen, setFullscreen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/orders/display", { cache: "no-store" });
      const result = (await response.json()) as DisplayResponse;
      if (!response.ok) throw new Error(result.error || "Unable to refresh orders.");
      setOrders(result.orders || []);
      setCompletedMinutes(result.completedVisibilityMinutes || 20);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refresh();
    const eventSource = new EventSource("/api/orders/display/stream");
    eventSource.addEventListener("ready", () => setSyncState("live"));
    eventSource.addEventListener("orders", () => void refresh());
    eventSource.addEventListener("unavailable", () => setSyncState("polling"));
    eventSource.onerror = () => setSyncState("polling");

    const pollingTimer = window.setInterval(() => void refresh(), pollingInterval);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      eventSource.close();
      window.clearInterval(pollingTimer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const updateFullscreenState = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const groupedOrders = useMemo(() => ({
    preparing: orders
      .filter((order) => order.status === "New" || order.status === "Preparing")
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    ready: orders
      .filter((order) => order.status === "Ready")
      .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()),
    completed: orders
      .filter((order) => order.status === "Completed")
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
  }), [orders]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  }

  return <main className="orderDisplayPage">
    <header className="orderDisplayHeader">
      <div className="orderDisplayBrand">
        <span className="orderDisplayLogo">LV</span>
        <div><strong>LEVIEN CAFE</strong><small>LIVE ORDER STATUS</small></div>
      </div>
      <div className="orderDisplayTitle">
        <span>Pickup board</span>
        <h1>Track your order</h1>
      </div>
      <div className="orderDisplayControls">
        <span className={`orderDisplayLive ${syncState}`}><i />{syncState === "live" ? "Live" : syncState === "polling" ? "Reconnecting" : "Connecting"}</span>
        <time dateTime={clock.toISOString()}><strong>{clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong><small>{clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</small></time>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
      </div>
    </header>

    {error && <div className="orderDisplayWarning" role="status">{error} Showing the most recent available information.</div>}

    <section className="orderDisplayColumns" aria-busy={loading} aria-live="polite">
      <section className="orderDisplayColumn preparing">
        <header><div><span>01</span><h2>Preparing</h2></div><b>{groupedOrders.preparing.length}</b></header>
        <div className="orderDisplayTickets">
          {groupedOrders.preparing.map((order) => <OrderTicket key={order.orderNumber} order={order} tone="preparing" />)}
          {!loading && !groupedOrders.preparing.length && <EmptyColumn message="No orders are being prepared." />}
        </div>
      </section>

      <section className="orderDisplayColumn ready">
        <header><div><span>02</span><h2>Ready for Pickup</h2></div><b>{groupedOrders.ready.length}</b></header>
        <div className="orderDisplayTickets">
          {groupedOrders.ready.map((order) => <OrderTicket key={order.orderNumber} order={order} tone="ready" />)}
          {!loading && !groupedOrders.ready.length && <EmptyColumn message="Ready orders will appear here." />}
        </div>
      </section>

      <section className="orderDisplayColumn completed">
        <header><div><span>03</span><h2>Completed</h2></div><b>{groupedOrders.completed.length}</b></header>
        <p className="orderDisplayColumnNote">Shown for {completedMinutes} minutes</p>
        <div className="orderDisplayTickets">
          {groupedOrders.completed.map((order) => <OrderTicket key={order.orderNumber} order={order} tone="completed" />)}
          {!loading && !groupedOrders.completed.length && <EmptyColumn message="Recently completed orders appear here." />}
        </div>
      </section>
    </section>

    <footer className="orderDisplayFooter">
      <strong>Please collect your order when its number appears under Ready for Pickup.</strong>
      <span>Need help? Please speak with a member of our team.</span>
    </footer>
  </main>;
}
