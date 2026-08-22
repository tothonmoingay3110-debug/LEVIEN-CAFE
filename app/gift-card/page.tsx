"use client";

import { FormEvent, useState } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import Link from "next/link";

const money = (value: number) => `$${value.toFixed(2)}`;

type BalanceCard = {
  lastFour: string;
  balance: number;
  status: string;
  expiresOn: string | null;
  usable: boolean;
};

export default function GiftCardPage() {
  const [code, setCode] = useState("");
  const [card, setCard] = useState<BalanceCard | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function checkBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || checking) return;
    setChecking(true);
    setError("");
    setCard(null);
    try {
      const response = await fetch("/api/gift-cards/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as { card?: BalanceCard; error?: string };
      if (!response.ok || !result.card) throw new Error(result.error || "Unable to check this Gift Card.");
      setCard(result.card);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to check this Gift Card.");
    } finally {
      setChecking(false);
    }
  }

  return <>
    <Header />
    <main className="giftCardPage">
      <section className="giftCardHero">
        <div className="giftCardHeroCopy"><span className="sectionLabel">LEVIEN Gift Cards</span><h1>A little joy, ready to share.</h1><p>Buy a digital Gift Card securely or enter an existing code below to check its balance.</p><Link className="button primary" href="/gift-card/buy">Buy a Gift Card</Link><div className="giftCardPromise"><span>✓ Activated only after payment</span><span>✓ Works at checkout</span><span>✓ Recoverable in My Account</span></div></div>
        <div className="giftCardArtwork" aria-hidden="true"><div className="giftCardMock"><span>LEVIEN CAFE</span><strong>GIFT CARD</strong><small>Vietnamese soul, made to share.</small><b>LV</b></div></div>
      </section>
      <section className="giftCardBalanceSection">
        <div className="giftCardBalanceIntro"><span className="sectionLabel">Balance lookup</span><h2>Check your Gift Card</h2><p>Your code begins with <strong>LVGC</strong>. We use it only for this secure balance request.</p></div>
        <form className="giftCardBalanceForm" onSubmit={checkBalance}>
          <label>Gift Card code<input value={code} maxLength={24} autoComplete="off" placeholder="LVGC-XXXX-XXXX-XXXX" onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); setCard(null); }} /></label>
          <button className="button primary" type="submit" disabled={!code.trim() || checking}>{checking ? "Checking…" : "Check Balance"}</button>
          {error && <div className="giftCardBalanceError" role="alert">{error}</div>}
          {card && <div className={`giftCardBalanceResult status-${card.status}`} role="status"><div><span>Card ending {card.lastFour}</span><strong>{money(card.balance)}</strong><small>Current balance</small></div><b>{card.status === "active" ? "Active" : card.status === "expired" ? "Expired" : card.status === "redeemed" ? "Redeemed" : "Disabled"}</b>{card.expiresOn && <p>Expires {new Date(`${card.expiresOn}T00:00:00`).toLocaleDateString()}</p>}</div>}
          <small className="giftCardBalancePrivacy">For your security, the complete Gift Card code is never displayed after checking.</small>
        </form>
      </section>
    </main>
    <Footer />
  </>;
}
