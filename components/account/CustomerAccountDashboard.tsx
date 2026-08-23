"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerSession } from "@/components/CustomerSessionProvider";
import { onlineGiftCardPurchaseEnabled } from "@/lib/features";
import type { CustomerAccountData } from "@/types/account";

const money = (value: number) => `$${value.toFixed(2)}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No expiry";

export default function CustomerAccountDashboard() {
  const router = useRouter();
  const { signOut } = useCustomerSession();
  const [data, setData] = useState<CustomerAccountData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (response.status === 401) return router.replace("/account/sign-in");
    const result = (await response.json()) as CustomerAccountData & { error?: string };
    if (!response.ok) return setError(result.error || "Unable to load your account.");
    setData(result);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError("");
    const response = await fetch("/api/account", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"), lastName: form.get("lastName"),
        phone: form.get("phone"), marketingOptIn: form.get("marketingOptIn") === "on",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) setError(result.error || "Unable to save your profile."); else await load();
    setSaving(false);
  }

  async function revealCard(id: string) {
    const response = await fetch(`/api/account/gift-cards/${encodeURIComponent(id)}/reveal`, { method: "POST" });
    const result = (await response.json()) as { code?: string; error?: string };
    if (!response.ok || !result.code) return setError(result.error || "Unable to reveal this Gift Card.");
    setRevealed((current) => ({ ...current, [id]: result.code! }));
  }

  if (!data) return <div className="accountLoading">{error || "Loading your LEVIEN account…"}</div>;
  const availableRewards = data.rewards.filter((reward) => reward.status === "issued");

  return <div className="accountDashboard">
    <section className="accountHero">
      <div><span className="sectionLabel accountHeroEyebrow">LEVIEN MEMBER</span><h1>Hi, {data.profile.firstName}.</h1><p>Orders, rewards and Gift Cards live together here.</p></div>
      <div className="accountHeroActions"><Link className="button primary" href="/account/member-card">View Member Card</Link><Link className="button secondary" href="/menu">Order Now</Link><button className="button accountSignOut" onClick={async () => { await signOut(); router.replace("/"); }}>Sign out</button></div>
    </section>
    {error && <div className="customerAuthError" role="alert">{error}</div>}

    <div className="accountStatGrid">
      <article><small>MEMBER NUMBER</small><strong>{data.profile.membershipNumber}</strong><span>Member since {date(data.profile.memberSince)}</span></article>
      <article><small>AVAILABLE REWARDS</small><strong>{availableRewards.length}</strong><span>{availableRewards.length ? "Ready to use" : "Keep collecting visits"}</span></article>
      <article><small>ORDERS</small><strong>{data.orders.length}</strong><span>Linked by your verified email</span></article>
    </div>

    <div className="accountColumns">
      <section className="accountPanel">
        <div className="accountPanelHead"><div><span className="sectionLabel">YOUR PROGRESS</span><h2>Loyalty programs</h2></div></div>
        {!data.loyalty.length ? <p className="accountEmpty">No active progress yet. Eligible purchases appear after an order is completed.</p> : <div className="loyaltyProgressList">{data.loyalty.map((item) => <article key={item.ruleId}>
          <div><strong>{item.name}</strong><span>{item.currentUnits} of {item.requiredQuantity} · {item.triggerProductName}</span></div>
          <div className="loyaltyMeter" aria-label={`${item.currentUnits} of ${item.requiredQuantity}`}><i style={{ width: `${Math.min(100, (item.currentUnits / item.requiredQuantity) * 100)}%` }} /></div>
          <small>Reward: {item.rewardName}{item.reviewRequired ? " · Staff review needed" : ""}</small>
        </article>)}</div>}
        <div className="accountRewards"><h3>Rewards</h3>{!data.rewards.length ? <p className="accountEmpty">No rewards issued yet.</p> : data.rewards.map((reward) => <article key={reward.id}>
          <div><strong>{reward.name}</strong><small>{reward.code} · {reward.type === "physical_gift" ? "Show to staff" : `Choose at checkout${reward.productNames.length ? `: ${reward.productNames.join(" / ")}` : ""}`}</small></div><span className={`rewardStatus ${reward.status}`}>{reward.status}</span>
        </article>)}</div>
      </section>

      <section className="accountPanel">
        <div className="accountPanelHead"><div><span className="sectionLabel">PROFILE</span><h2>Your details</h2></div></div>
        <form className="accountProfileForm" onSubmit={saveProfile}>
          <div><label>First name<input name="firstName" defaultValue={data.profile.firstName} maxLength={100} required /></label><label>Last name<input name="lastName" defaultValue={data.profile.lastName} maxLength={100} required /></label></div>
          <label>Email<input value={data.profile.email} disabled /></label>
          <label>Phone<input name="phone" defaultValue={data.profile.phone} maxLength={30} /></label>
          <label className="customerAuthConsent"><input name="marketingOptIn" type="checkbox" defaultChecked={data.profile.marketingOptIn} /><span>Send me occasional LEVIEN offers.</span></label>
          <button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save Profile"}</button>
        </form>
      </section>
    </div>

    <section className="accountPanel accountWidePanel">
      <div className="accountPanelHead"><div><span className="sectionLabel">WALLET</span><h2>Your Gift Cards</h2></div>{onlineGiftCardPurchaseEnabled && <Link href="/gift-card/buy">Buy Gift Card</Link>}</div>
      {!data.giftCards.length ? <p className="accountEmpty">Gift Cards linked to your account will appear here.</p> : <div className="accountGiftCards">{data.giftCards.map((card) => <article key={card.id}>
        <small>LEVIEN GIFT CARD</small><strong>{money(card.balance)}</strong><span>{revealed[card.id] || `•••• •••• •••• ${card.lastFour}`}</span><em>{card.status} · {card.recipientName || "For you"}</em>
        {!revealed[card.id] && <button type="button" onClick={() => void revealCard(card.id)}>Reveal secure code</button>}
      </article>)}</div>}
    </section>

    <section className="accountPanel accountWidePanel">
      <div className="accountPanelHead"><div><span className="sectionLabel">HISTORY</span><h2>Your orders</h2></div></div>
      {!data.orders.length ? <p className="accountEmpty">No linked orders yet.</p> : <div className="accountOrders">{data.orders.map((order) => <article key={order.id}>
        <div><strong>{order.id}</strong><span>{date(order.createdAt)} · {order.type}</span></div><div><b>{money(order.total)}</b><span className={`orderStatus ${order.status.replace(/\s/g, "").toLowerCase()}`}>{order.status}</span></div>
        {order.trackingToken && <Link href={`/order/track?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.trackingToken)}`}>Track order</Link>}
      </article>)}</div>}
    </section>
  </div>;
}
