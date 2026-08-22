"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/components/CustomerSessionProvider";

export default function MemberCard() {
  const { profile, loading } = useCustomerSession();
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (profile) void QRCode.toDataURL(`LEVIEN-MEMBER:${profile.membershipNumber}`, { width: 360, margin: 1, color: { dark: "#0b4634", light: "#fffaf0" } }).then(setQr);
  }, [profile]);
  if (loading) return <div className="accountLoading">Loading member card…</div>;
  if (!profile) return <div className="accountLoading">Please <Link href="/account/sign-in">sign in</Link> to view your card.</div>;
  return <div className="memberCardPage">
    <div className="memberCardToolbar"><Link href="/account">← Back to account</Link><button className="button primary" onClick={() => window.print()}>Print Card</button></div>
    <article className="printMemberCard">
      <div className="memberCardBrand"><span>LV</span><div><strong>LEVIEN CAFE</strong><small>MEMBERSHIP</small></div></div>
      <div className="memberCardBody"><div><small>MEMBER</small><h1>{profile.firstName} {profile.lastName}</h1><span>{profile.membershipNumber}</span><p>Scan at LEVIEN CAFE to identify this membership. No private contact information is stored in this QR code.</p></div>{qr && <img src={qr} alt={`QR code for member ${profile.membershipNumber}`} />}</div>
      <footer><span>MEMBER SINCE {new Date(profile.memberSince).getFullYear()}</span><strong>Good coffee. Better rewards.</strong></footer>
    </article>
    <p className="memberCardHint">Print at 100% scale or save as PDF. The card uses a standard wallet-card proportion.</p>
  </div>;
}
