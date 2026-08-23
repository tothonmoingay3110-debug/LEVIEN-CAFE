"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type OrderTrackingQrProps = {
  orderNumber: string;
  trackingToken: string;
};

export function OrderTrackingQr({ orderNumber, trackingToken }: OrderTrackingQrProps) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const trackingPath = useMemo(
    () => `/order/track?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`,
    [orderNumber, trackingToken],
  );

  useEffect(() => {
    let active = true;
    const trackingUrl = `${window.location.origin}${trackingPath}`;
    void QRCode.toDataURL(trackingUrl, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b4634", light: "#fffaf0" },
    }).then((value) => {
      if (active) setQr(value);
    }).catch(() => {
      if (active) setQr("");
    });
    return () => { active = false; };
  }, [trackingPath]);

  const copyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${trackingPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (!qr) return null;
  return <section className="orderTrackingQr" aria-label="Order tracking QR code">
    <img src={qr} alt={`QR code to track order ${orderNumber}`} />
    <div>
      <span className="sectionLabel">Track from any device</span>
      <h2>Scan to follow your order</h2>
      <p>This QR contains the private tracking link for order <strong>{orderNumber}</strong>. Keep it with your receipt.</p>
      <button className="button secondary" type="button" onClick={() => void copyTrackingLink()}>{copied ? "Link copied" : "Copy tracking link"}</button>
    </div>
  </section>;
}
