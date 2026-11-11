"use client";

import { useEffect, useState } from "react";

export function AdminOrderFeedback({ orderNumber }: { orderNumber: string }) {
  const [feedback, setFeedback] = useState<{ rating: number; comment: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    void fetch(`/api/admin/orders/feedback?orderNumber=${encodeURIComponent(orderNumber)}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ feedback: { rating: number; comment: string } | null }> : null)
      .then((result) => { if (active) { setFeedback(result?.feedback || null); setLoaded(true); } })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [orderNumber]);

  return <div className="adminNote"><strong>Customer feedback</strong>{!loaded ? <p>Loading…</p> : feedback ? <p><b>{feedback.rating}/5</b>{feedback.comment ? ` · ${feedback.comment}` : " · No comment"}</p> : <p>No feedback yet.</p>}</div>;
}
