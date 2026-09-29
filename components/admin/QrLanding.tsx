"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QrLanding({ notify }: { notify: (message: string) => void }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
    const scanUrl = `${siteOrigin}/scan`;
    setUrl(scanUrl);
    void QRCode.toDataURL(scanUrl, {
      width: 960,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#18382f", light: "#ffffff" },
    }).then(setQr);
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    notify("QR landing link copied");
  }

  return <div className="adminStack qrAdminPage">
    <section className="adminCard qrAdminIntro">
      <div><span className="adminEyebrow">Customer access</span><h2>Event & catering QR</h2><p>This QR always opens one mobile page where customers can choose Book an Event or View Catering Menu.</p></div>
      <a className="adminSecondary" href="/scan" target="_blank" rel="noreferrer">Open landing page ↗</a>
    </section>
    <section className="adminCard qrAdminGenerator">
      <div className="qrAdminPreview">{qr ? <img src={qr} alt="QR code for the LEVIEN event and catering landing page" /> : <span>Generating QR…</span>}</div>
      <div className="qrAdminDetails">
        <span className="adminEyebrow">Automatically generated</span>
        <h3>Ready to print and share</h3>
        <p>The destination stays at <b>/scan</b>, so the printed QR remains valid when menu items or page content change.</p>
        <label>QR destination<input value={url} readOnly aria-readonly="true" /></label>
        <div className="qrAdminActions">
          <button type="button" className="adminSecondary" onClick={() => void copyLink()}>Copy link</button>
          {qr && <a className="adminPrimary" href={qr} download="levien-event-catering-qr.png">Download PNG</a>}
          <button type="button" className="adminSecondary" onClick={() => window.print()}>Print QR</button>
        </div>
        <small>High error correction is enabled so the code remains easier to scan when printed.</small>
      </div>
    </section>
  </div>;
}
