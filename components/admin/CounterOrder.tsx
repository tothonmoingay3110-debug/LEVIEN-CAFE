"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; sku: string; name: string; price: number; image_url: string; emoji: string; allow_toppings: boolean; sold_out: boolean; category_id: string | null; toppingIds: string[] };
type Topping = { id: string; name: string; price: number; image_url: string };
type Category = { id: string; name: string };
type Customer = { id: string; first_name: string; last_name: string; email: string | null; phone: string; membership_number: string };
type Line = { productId: string; quantity: number; toppingIds: string[] };
type Reward = { id: string; customer_profile_id: string; reward_code: string; reward_name: string; expires_at: string | null; productIds: string[] };

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const sameToppings = (left: string[], right: string[]) => [...left].sort().join("|") === [...right].sort().join("|");

export default function CounterOrder({ close, saved }: { close: () => void; saved: (orderNumber: string) => Promise<void> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [customerId, setCustomerId] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [customToppingIds, setCustomToppingIds] = useState<string[]>([]);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/admin/counter-orders", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setProducts(data.products || []);
        setToppings(data.toppings || []);
        setCategories(data.categories || []);
        setCustomers(data.customers || []);
        setRewards(data.rewards || []);
      })
      .catch((cause) => setError(cause.message || "Unable to load catalog"));
  }, []);

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const toppingMap = useMemo(() => new Map(toppings.map((item) => [item.id, item])), [toppings]);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const customerRewards = rewards.filter((reward) => reward.customer_profile_id === customerId && (!reward.expires_at || new Date(reward.expires_at).getTime() > Date.now()));
  const normalizedLookup = normalizePhone(memberPhone);
  const lookupAttempted = normalizedLookup.length >= 7;
  const total = lines.reduce((sum, line) => sum + (Number(productMap.get(line.productId)?.price || 0) + line.toppingIds.reduce((amount, id) => amount + Number(toppingMap.get(id)?.price || 0), 0)) * line.quantity, 0);
  const selectedReward = customerRewards.find((reward) => reward.id === rewardId);
  const rewardLine = selectedReward ? lines.filter((line) => selectedReward.productIds.includes(line.productId)).sort((left,right)=>Number(productMap.get(right.productId)?.price||0)-Number(productMap.get(left.productId)?.price||0))[0] : undefined;
  const rewardDiscount = rewardLine ? Number(productMap.get(rewardLine.productId)?.price || 0) : 0;
  const amountDue = Math.max(0,total*1.08-rewardDiscount);
  const filtered = products.filter((product) => !product.sold_out && (categoryId === "all" || product.category_id === categoryId) && `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase()));
  const availableToppings = customizing ? toppings.filter((topping) => customizing.toppingIds.includes(topping.id)) : [];

  function findMember(value: string) {
    setMemberPhone(value);
    setRewardId("");
    const normalized = normalizePhone(value);
    const match = normalized.length >= 7 ? customers.find((customer) => normalizePhone(customer.phone) === normalized) : undefined;
    setCustomerId(match?.id || "");
  }

  function chooseCustomer(id: string) {
    setCustomerId(id);
    setRewardId("");
    setMemberPhone(customers.find((customer) => customer.id === id)?.phone || "");
  }

  function openCustomizer(product: Product) {
    setCustomizing(product);
    setCustomToppingIds([]);
    setCustomQuantity(1);
  }

  function addCustomizedItem() {
    if (!customizing) return;
    const selected = [...customToppingIds].sort();
    setLines((current) => {
      const index = current.findIndex((line) => line.productId === customizing.id && sameToppings(line.toppingIds, selected));
      if (index < 0) return [...current, { productId: customizing.id, quantity: customQuantity, toppingIds: selected }];
      return current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: line.quantity + customQuantity } : line);
    });
    setCustomizing(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) return setError("Add at least one product.");
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/counter-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines, customerProfileId: customerId, loyaltyRewardId: rewardId || null, firstName: form.get("firstName"), lastName: form.get("lastName"), phone: form.get("phone"), payment: form.get("payment"), note: form.get("note") }),
      });
      const data = await response.json();
      if (!response.ok || !data.orderNumber) throw new Error(data.error || "Unable to create order");
      await saved(data.orderNumber);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create order");
    } finally {
      setSaving(false);
    }
  }

  return <div className="adminModalBackdrop">
    <div className="adminModal counterOrderModal" role="dialog" aria-modal="true">
      <header><div><span className="adminEyebrow">Staff counter service</span><h2>Create Counter Order</h2></div><button type="button" onClick={close} aria-label="Close">×</button></header>
      <form className="counterOrderLayout" onSubmit={submit}>
        <section className="counterCatalog">
          <input className="adminSearch counterProductSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product or SKU…" />
          <div className="counterCategoryFilters" aria-label="Product categories">
            <button type="button" className={categoryId === "all" ? "active" : ""} onClick={() => setCategoryId("all")}>All</button>
            {categories.map((category) => <button type="button" className={categoryId === category.id ? "active" : ""} key={category.id} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
          </div>
          <div className="counterProductGrid">{filtered.map((product) => <button type="button" key={product.id} onClick={() => openCustomizer(product)}>
            {product.image_url ? <img src={product.image_url} alt="" /> : <span>{product.emoji || "LV"}</span>}<strong>{product.name}</strong><small>${product.price.toFixed(2)}</small>
          </button>)}</div>
        </section>
        <aside>
          <div className="counterMemberLookup">
            <label>Find member by phone<input value={memberPhone} onChange={(event) => findMember(event.target.value)} inputMode="tel" placeholder="Enter member phone number" /></label>
            {selectedCustomer && <div className="counterMemberCard"><strong>{selectedCustomer.first_name} {selectedCustomer.last_name}</strong><span>{selectedCustomer.membership_number} · {selectedCustomer.phone}</span>{selectedCustomer.email && <span>{selectedCustomer.email}</span>}</div>}
            {!selectedCustomer && lookupAttempted && <small className="counterMemberMissing">No member found. Continue as guest or check the number.</small>}
          </div>
          <label>Customer / member<select value={customerId} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Guest customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.first_name} {customer.last_name} · {customer.membership_number}</option>)}</select></label>
          {customerId && <label>Available voucher<select value={rewardId} onChange={(event) => setRewardId(event.target.value)}><option value="">No voucher</option>{customerRewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.reward_name} · {reward.reward_code} · {reward.productIds.map((id) => productMap.get(id)?.name).filter(Boolean).join(", ")}</option>)}</select><small>Free product applies to an eligible item. Toppings remain chargeable.</small></label>}
          {selectedReward&&!rewardLine&&<div className="counterRewardWarning">Add an eligible product before using this reward.</div>}
          {!customerId && <div className="counterGuestFields"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Phone<input name="phone" type="tel" required /></label></div>}
          <div className="counterCart">{lines.map((line, index) => { const product = productMap.get(line.productId); if (!product) return null; const chosen = line.toppingIds.map((id) => toppingMap.get(id)).filter(Boolean) as Topping[]; return <article key={`${line.productId}-${line.toppingIds.join("-")}`}>
            <div><strong>{product.name}</strong><span><button type="button" onClick={() => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>−</button>{line.quantity}<button type="button" onClick={() => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item))}>+</button></span></div>
            {chosen.length > 0 && <p className="counterLineToppingSummary">+ {chosen.map((item) => item.name).join(", ")}</p>}
            <div className="counterLineActions"><span>${((product.price + chosen.reduce((sum, item) => sum + item.price, 0)) * line.quantity).toFixed(2)}</span><button className="counterRemove" type="button" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>
          </article>; })}</div>
          <label>Payment<select name="payment"><option>Cash</option><option>Card terminal</option></select></label>
          <label>Order note<textarea name="note" rows={2} /></label>
          <div className="counterTotal">{rewardDiscount>0&&<><span>Before reward</span><b>${(total*1.08).toFixed(2)}</b><span>Member reward</span><b>−${rewardDiscount.toFixed(2)}</b></>}<span>Estimated amount due</span><strong>${amountDue.toFixed(2)}</strong></div>
          {error && <div className="adminLoginError">{error}</div>}
          <button className="adminPrimary" disabled={saving || !lines.length}>{saving ? "Creating…" : "Place Counter Order"}</button>
        </aside>
      </form>
      {customizing && <div className="counterCustomizerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomizing(null); }}>
        <section className="counterCustomizer" role="dialog" aria-modal="true" aria-label={`Customize ${customizing.name}`}>
          <div className="counterCustomizerHeader"><div><span className="adminEyebrow">Customize item</span><h3>{customizing.name}</h3></div><button type="button" onClick={() => setCustomizing(null)} aria-label="Close customization">×</button></div>
          <div className="counterCustomizerProduct">{customizing.image_url ? <img src={customizing.image_url} alt="" /> : <span>{customizing.emoji || "LV"}</span>}<div><strong>${customizing.price.toFixed(2)}</strong><small>{customizing.sku}</small></div></div>
          <div className="counterCustomizerToppings"><h4>Toppings</h4>{customizing.allow_toppings && availableToppings.length ? availableToppings.map((topping) => <label key={topping.id}><input type="checkbox" checked={customToppingIds.includes(topping.id)} onChange={() => setCustomToppingIds((current) => current.includes(topping.id) ? current.filter((id) => id !== topping.id) : [...current, topping.id])} /><span>{topping.name}</span><strong>+${topping.price.toFixed(2)}</strong></label>) : <p>No toppings available for this item.</p>}</div>
          <div className="counterCustomizerActions"><div><button type="button" onClick={() => setCustomQuantity((value) => Math.max(1, value - 1))}>−</button><strong>{customQuantity}</strong><button type="button" onClick={() => setCustomQuantity((value) => value + 1)}>+</button></div><button type="button" className="adminPrimary" onClick={addCustomizedItem}>Add to Order · ${((customizing.price + customToppingIds.reduce((sum, id) => sum + Number(toppingMap.get(id)?.price || 0), 0)) * customQuantity).toFixed(2)}</button></div>
        </section>
      </div>}
    </div>
  </div>;
}
