"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerSession } from "@/components/CustomerSessionProvider";
import { useSiteData } from "@/components/SiteDataProvider";
import { onlineGiftCardPurchaseEnabled } from "@/lib/features";
import type { CustomerAccountData } from "@/types/account";
import type { CartItem, ProductSelection } from "@/types";
import { useStore } from "@/components/StoreProvider";

const money = (value: number) => `$${value.toFixed(2)}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No expiry";
type OrderFeedback = { orderNumber: string; rating: number; comment: string; updatedAt: string };

export default function CustomerAccountDashboard() {
  const { content, products, combos, ready: catalogReady } = useSiteData();
  const { addProduct, addCombo, openCart } = useStore();
  const router = useRouter();
  const { signOut, favorites, removeFavorite } = useCustomerSession();
  const [data, setData] = useState<CustomerAccountData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [orderNotice, setOrderNotice] = useState("");
  const [feedbackByOrder, setFeedbackByOrder] = useState<Record<string, OrderFeedback>>({});
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null);

  function addCurrentItem(item: CartItem) {
    if (item.itemType === "combo") {
      const combo = combos.find((entry) => entry.id === (item.comboId || item.productId) && entry.active);
      if (!combo || !item.comboItems || item.comboItems.length !== combo.productIds.length ||
        [...item.comboItems.map((entry) => entry.productId)].sort().join("|") !== [...combo.productIds].sort().join("|")) return false;
      const selections = item.comboItems.map((entry) => {
        const product = products.find((candidate) => candidate.id === entry.productId && !candidate.soldOut);
        if (!product || !combo.productIds.includes(product.id)) return null;
        const toppings = product.allowToppings ? (product.toppings || []).filter((topping) => entry.toppings.some((saved) => saved.id === topping.id)) : [];
        if (toppings.length !== entry.toppings.length) return null;
        return { productId: product.id, name: product.name, emoji: product.emoji,
          ice: product.allowIce ? entry.ice : undefined, sugar: product.allowSugar ? entry.sugar : undefined,
          note: entry.note, toppings };
      });
      if (selections.some((entry) => !entry)) return false;
      addCombo(combo, selections as NonNullable<typeof selections[number]>[], item.quantity);
      return true;
    }
    const product = products.find((entry) => entry.id === item.productId && !entry.soldOut);
    if (!product) return false;
    const toppings = product.allowToppings ? (product.toppings || []).filter((topping) => item.toppings.some((saved) => saved.id === topping.id)) : [];
    if (toppings.length !== item.toppings.length) return false;
    addProduct(product, { quantity: item.quantity, ice: product.allowIce ? item.ice : undefined,
      sugar: product.allowSugar ? item.sugar : undefined, note: item.note,
      toppings });
    return true;
  }

  function orderAgain(items: CartItem[]) {
    if (!content.onlineOrderingEnabled || !catalogReady) return;
    const added = items.filter(addCurrentItem).length;
    const skipped = items.length - added;
    setOrderNotice(added ? `${added} item${added === 1 ? "" : "s"} added using current prices.${skipped ? ` ${skipped} unavailable item${skipped === 1 ? " was" : "s were"} skipped.` : ""} Review your cart before checkout.` : "These items are no longer available on the current menu.");
    if (added) openCart();
  }

  function addFavorite(productId: string, selection: { ice?: string; sugar?: string; toppingIds?: string[]; note?: string }) {
    if (!content.onlineOrderingEnabled || !catalogReady) return;
    const product = products.find((item) => item.id === productId && !item.soldOut);
    if (!product) { setOrderNotice("This favorite is not available on the current menu."); return; }
    const toppings = product.allowToppings ? (product.toppings || []).filter((item) => selection.toppingIds?.includes(item.id)) : [];
    if (toppings.length !== (selection.toppingIds || []).length) { setOrderNotice("Some saved toppings are no longer available. Edit this favorite before ordering."); return; }
    const options: ProductSelection = { quantity: 1, ice: product.allowIce ? selection.ice : undefined,
      sugar: product.allowSugar ? selection.sugar : undefined, note: selection.note,
      toppings };
    addProduct(product, options);
    setOrderNotice(`${product.name} added using the current menu price. Review your cart before checkout.`);
    openCart();
  }

  const load = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (response.status === 401) return router.replace("/account/sign-in");
    const result = (await response.json()) as CustomerAccountData & { error?: string };
    if (!response.ok) return setError(result.error || "Unable to load your account.");
    setData(result);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/feedback", { cache: "no-store" }).then(async (response) => {
      if (!response.ok || !active) return;
      const result = await response.json() as { feedback?: OrderFeedback[] };
      if (active) setFeedbackByOrder(Object.fromEntries((result.feedback || []).map((item) => [item.orderNumber, item])));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function submitFeedback(event: FormEvent<HTMLFormElement>, orderNumber: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rating = Number(form.get("rating"));
    const comment = String(form.get("comment") || "").trim();
    setSavingFeedback(orderNumber); setError("");
    try {
      const response = await fetch("/api/account/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, rating, comment }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save feedback.");
      setFeedbackByOrder((current) => ({ ...current, [orderNumber]: { orderNumber, rating, comment, updatedAt: new Date().toISOString() } }));
      setOrderNotice(`Thanks for rating order ${orderNumber}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save feedback."); }
    finally { setSavingFeedback(null); }
  }

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
      <div className="accountHeroActions"><Link className="button primary" href="/account/member-card">View Member Card</Link><Link className="button secondary" href="/menu">{content.onlineOrderingEnabled ? "Order Now" : "View Menu"}</Link><button className="button accountSignOut" onClick={async () => { await signOut(); router.replace("/"); }}>Sign out</button></div>
    </section>
    {error && <div className="customerAuthError" role="alert">{error}</div>}
    {orderNotice && <div className="accountOrderNotice" role="status">{orderNotice}</div>}

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
      <div className="accountPanelHead"><div><span className="sectionLabel">SAVED FOR LATER</span><h2>Your favorites</h2></div><Link href="/menu">Browse menu</Link></div>
      {!favorites.length ? <p className="accountEmpty">Save a favorite from any menu card to keep your usual options here.</p> : <div className="accountFavorites">{favorites.map((favorite) => {
        const product = products.find((item) => item.id === favorite.productId);
        const unavailable = !product || product.soldOut;
        return <article key={favorite.productId}><div><strong>{product?.name || "No longer on menu"}</strong><span>{[favorite.selection.ice && `Ice ${favorite.selection.ice}`, favorite.selection.sugar && `Sugar ${favorite.selection.sugar}`, ...(favorite.selection.toppingIds || []).map((id) => product?.toppings?.find((topping) => topping.id === id)?.name).filter(Boolean)].filter(Boolean).join(" · ") || "Regular"}</span></div><div><button type="button" disabled={unavailable || !content.onlineOrderingEnabled || !catalogReady} onClick={() => addFavorite(favorite.productId, favorite.selection)}>Add to cart</button><button type="button" onClick={() => void removeFavorite(favorite.productId).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to remove favorite."))}>Remove</button></div></article>;
      })}</div>}
    </section>

    <section className="accountPanel accountWidePanel">
      <div className="accountPanelHead"><div><span className="sectionLabel">HISTORY</span><h2>Your orders</h2></div></div>
      {!data.orders.length ? <p className="accountEmpty">No linked orders yet.</p> : <div className="accountOrders">{data.orders.map((order) => <article key={order.id}>
        <div><strong>{order.id}</strong><span>{date(order.createdAt)} · {order.type}</span></div><div><b>{money(order.total)}</b><span className={`orderStatus ${order.status.replace(/\s/g, "").toLowerCase()}`}>{order.status}</span></div>
        {order.trackingToken && <Link href={`/order/track?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.trackingToken)}`}>Track order</Link>}
        <button type="button" disabled={!content.onlineOrderingEnabled || !catalogReady || !order.items.length} onClick={() => orderAgain(order.items)}>Order again</button>
        {order.status === "Completed" && <details className="accountFeedback"><summary>{feedbackByOrder[order.id] ? `Your rating: ${feedbackByOrder[order.id].rating}/5` : "Rate this order"}</summary><form key={`${order.id}-${feedbackByOrder[order.id]?.updatedAt || "new"}`} onSubmit={(event) => void submitFeedback(event, order.id)}><label>Rating <select name="rating" defaultValue={feedbackByOrder[order.id]?.rating || ""} required><option value="" disabled>Choose</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label><label>Private feedback for LEVIEN <textarea name="comment" maxLength={1000} rows={3} defaultValue={feedbackByOrder[order.id]?.comment || ""} placeholder="What went well? What should we improve?" /></label><button type="submit" disabled={savingFeedback === order.id}>{savingFeedback === order.id ? "Saving…" : "Save feedback"}</button></form></details>}
      </article>)}</div>}
    </section>
  </div>;
}
