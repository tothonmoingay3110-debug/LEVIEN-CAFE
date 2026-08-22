"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type GiftCardStatus = "active" | "disabled" | "redeemed" | "expired";
type GiftCardTransaction = {
  id: string;
  type: "issue" | "redeem" | "refund";
  amount: number;
  balanceAfter: number;
  orderNumber: string | null;
  note: string;
  createdAt: string;
};
type GiftCard = {
  id: string;
  lastFour: string;
  initialBalance: number;
  balance: number;
  recipientName: string;
  recipientEmail: string;
  note: string;
  status: GiftCardStatus;
  storedStatus: "active" | "disabled" | "redeemed";
  expiresOn: string | null;
  createdAt: string;
  updatedAt: string;
  sale: { channel: string; tenderType: string; receiptReference: string; status: string; deliveryStatus: string; paidAt: string | null } | null;
  transactions: GiftCardTransaction[];
};
type IssuedCard = { id: string; code: string; lastFour: string; initialBalance: number };

const money = (value: number) => `$${value.toFixed(2)}`;
const statusLabels: Record<GiftCardStatus, string> = { active: "Active", disabled: "Disabled", redeemed: "Redeemed", expired: "Expired" };

export default function GiftCards({ notify }: { notify: (message: string) => void }) {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | GiftCardStatus>("all");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [issuedCard, setIssuedCard] = useState<IssuedCard | null>(null);

  async function loadCards(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/gift-cards", { cache: "no-store" });
      const result = (await response.json()) as { cards?: GiftCard[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load Gift Cards.");
      setCards(result.cards || []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Gift Cards.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadCards();
    const refresh = () => void loadCards(true);
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  const filteredCards = useMemo(() => {
    const term = query.trim().toLowerCase();
    return cards.filter((card) => (filter === "all" || card.status === filter) && (!term || `${card.lastFour} ${card.recipientName} ${card.recipientEmail} ${card.note}`.toLowerCase().includes(term)));
  }, [cards, filter, query]);

  async function issueCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issuing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setIssuing(true);
    try {
      const response = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(data.get("amount")),
          recipientName: data.get("recipientName"),
          recipientEmail: data.get("recipientEmail"),
          expiresOn: data.get("expiresOn"),
          note: data.get("note"),
          tenderType: data.get("tenderType"),
          receiptReference: data.get("receiptReference"),
        }),
      });
      const result = (await response.json()) as { card?: IssuedCard; error?: string };
      if (!response.ok || !result.card) throw new Error(result.error || "Unable to issue Gift Card.");
      setIssuedCard(result.card);
      setShowIssueForm(false);
      form.reset();
      await loadCards(true);
      notify("Gift Card created");
    } catch (issueError) {
      notify(issueError instanceof Error ? issueError.message : "Unable to issue Gift Card");
    } finally {
      setIssuing(false);
    }
  }

  async function updateStatus(card: GiftCard, status: "active" | "disabled") {
    setUpdatingId(card.id);
    try {
      const response = await fetch("/api/admin/gift-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update Gift Card.");
      await loadCards(true);
      notify(`Gift Card ending ${card.lastFour} ${status === "active" ? "reactivated" : "disabled"}`);
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "Unable to update Gift Card");
    } finally {
      setUpdatingId("");
    }
  }

  async function copyCode() {
    if (!issuedCard) return;
    try {
      await navigator.clipboard.writeText(issuedCard.code);
      notify("Gift Card code copied");
    } catch {
      notify("Select and copy the Gift Card code manually");
    }
  }

  const activeCards = cards.filter((card) => card.status === "active");
  const outstanding = activeCards.reduce((sum, card) => sum + card.balance, 0);
  const redeemedValue = cards.reduce((sum, card) => sum + Math.max(0, card.initialBalance - card.balance), 0);

  return <div className="adminStack giftCardAdmin">
    <section className="adminWelcome"><div><span>Stored value</span><h2>Gift Cards, without the spreadsheet.</h2><p>Create cards only after recording verified payment, then monitor every redemption or refund.</p></div><button className="adminPrimary" type="button" onClick={() => setShowIssueForm((current) => !current)}>{showIssueForm ? "Close form" : "+ Create Gift Card"}</button></section>
    <section className="adminMetrics"><div className="adminMetric"><span>Active cards</span><strong>{activeCards.length}</strong><small>Available to redeem</small></div><div className="adminMetric"><span>Outstanding</span><strong>{money(outstanding)}</strong><small>Active stored value</small></div><div className="adminMetric"><span>Redeemed value</span><strong>{money(redeemedValue)}</strong><small>Net of refunds</small></div><div className="adminMetric"><span>Total issued</span><strong>{cards.length}</strong><small>All Gift Cards</small></div></section>
    {showIssueForm && <section className="adminCard giftCardIssuePanel"><div className="adminCardHead"><div><span className="adminEyebrow">Verified in-store sale</span><h3>Create Gift Card</h3></div><span className="adminHint">The full code is shown once after creation</span></div><form className="giftCardIssueForm" onSubmit={issueCard}><label>Card value <span>*</span><input name="amount" type="number" min="5" max="1000" step="0.01" placeholder="50.00" required /></label><label>Payment / tender<select name="tenderType" defaultValue="card_terminal" required><option value="card_terminal">Card terminal</option><option value="cash">Cash</option><option value="complimentary">Complimentary (Owner only)</option></select></label><label>Receipt / terminal reference <span>*</span><input name="receiptReference" maxLength={120} placeholder="Receipt # or terminal reference" /></label><label>Recipient name<input name="recipientName" maxLength={120} /></label><label>Recipient email<input name="recipientEmail" type="email" maxLength={254} /></label><label>Expiry date<input name="expiresOn" type="date" min={new Date().toISOString().slice(0, 10)} /></label><label className="wide">Internal note<textarea name="note" rows={3} maxLength={1000} placeholder="Optional reason, occasion, or delivery note" /></label><button className="adminPrimary wide" type="submit" disabled={issuing}>{issuing ? "Creating…" : "Create Gift Card"}</button></form><small>Cash and terminal sales require a receipt reference. Complimentary cards are restricted to the Owner.</small></section>}
    {issuedCard && <section className="issuedGiftCard"><div><span>Gift Card issued successfully</span><h3>{issuedCard.code}</h3><p>Balance {money(issuedCard.initialBalance)} · This full code cannot be recovered after you close this notice.</p></div><div><button className="adminPrimary" type="button" onClick={() => void copyCode()}>Copy code</button><button className="adminSecondary" type="button" onClick={() => setIssuedCard(null)}>I saved it</button></div></section>}
    <section className="adminToolbar giftCardToolbar"><div className="adminSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipient, email, note, or last four…" /></div><div className="adminTabs">{(["all", "active", "disabled", "redeemed", "expired"] as const).map((status) => <button key={status} type="button" className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "all" ? "All" : statusLabels[status]}</button>)}</div></section>
    {error && <div className="adminLoginError">{error}</div>}
    <section className="giftCardList">
      {filteredCards.map((card) => <article className={`giftCardAdminCard status-${card.status}`} key={card.id}><header><div className="giftCardMini"><span>LEVIEN</span><strong>•••• {card.lastFour}</strong></div><div><span>{card.recipientName || "Unassigned Gift Card"}</span><h3>{money(card.balance)} <small>of {money(card.initialBalance)}</small></h3><p>{card.recipientEmail || "No recipient email"}</p></div><b>{statusLabels[card.status]}</b></header><div className="giftCardAdminMeta"><span><small>Created</small>{new Date(card.createdAt).toLocaleDateString()}</span><span><small>Tender</small>{card.sale ? card.sale.tenderType.replace(/_/g, " ") : "Legacy"}</span><span><small>Receipt</small>{card.sale?.receiptReference || "—"}</span><span><small>Delivery</small>{card.sale?.deliveryStatus.replace(/_/g, " ") || "—"}</span><span><small>Transactions</small>{card.transactions.length}</span></div>{card.note && <p className="giftCardAdminNote">{card.note}</p>}<footer>{(card.status === "active" || card.status === "disabled") && <button className={card.status === "active" ? "adminDangerSoft" : "adminSecondary"} type="button" disabled={updatingId === card.id} onClick={() => void updateStatus(card, card.status === "active" ? "disabled" : "active")}>{updatingId === card.id ? "Updating…" : card.status === "active" ? "Disable" : "Reactivate"}</button>}<details><summary>Transaction history</summary><div className="giftCardTransactions">{card.transactions.map((transaction) => <div key={transaction.id}><span className={`type-${transaction.type}`}>{transaction.type}</span><p><strong>{transaction.amount > 0 ? "+" : "−"}{money(Math.abs(transaction.amount))}</strong><small>{transaction.orderNumber ? `${transaction.orderNumber} · ` : ""}{new Date(transaction.createdAt).toLocaleString()}</small></p><b>{money(transaction.balanceAfter)}</b></div>)}</div></details></footer></article>)}
      {!loading && !filteredCards.length && <div className="contactInboxEmpty"><span>🎁</span><strong>No Gift Cards found</strong><p>Create the first Gift Card or change the current filter.</p></div>}
    </section>
  </div>;
}
