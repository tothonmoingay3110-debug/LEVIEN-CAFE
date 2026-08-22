"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; price: number };
type Rule = { id: string; name: string; description: string; trigger_product_id: string; required_quantity: number; reward_type: "free_product" | "physical_gift"; reward_product_id: string | null; reward_name: string; reward_expires_days: number; repeatable: boolean; active: boolean };
type Reward = { id: string; reward_code: string; reward_name: string; customer_profile_id: string; issued_at: string; expires_at: string | null };
type Customer = { id: string; first_name: string; last_name: string; email: string; membership_number: string };

export default function LoyaltyPrograms({ notify }: { notify: (message: string) => void }) {
  const [rules, setRules] = useState<Rule[]>([]); const [products, setProducts] = useState<Product[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]); const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [creating, setCreating] = useState(false);
  const customerMap = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);
  const load = useCallback(async () => { setLoading(true); const response = await fetch("/api/admin/loyalty", { cache: "no-store" }); const result = await response.json() as { rules?: Rule[]; products?: Product[]; physicalRewards?: Reward[]; customers?: Customer[]; error?: string }; if (!response.ok) setError(result.error || "Unable to load loyalty programs."); else { setRules(result.rules || []); setProducts(result.products || []); setRewards(result.physicalRewards || []); setCustomers(result.customers || []); } setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (creating) return; const form = event.currentTarget; const data = new FormData(form); setCreating(true); setError(""); const response = await fetch("/api/admin/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), description: data.get("description"), triggerProductId: data.get("triggerProductId"), requiredQuantity: Number(data.get("requiredQuantity")), rewardType: data.get("rewardType"), rewardProductId: data.get("rewardProductId"), rewardName: data.get("rewardName"), expiresDays: Number(data.get("expiresDays")), repeatable: data.get("repeatable") === "on" }) }); const result = await response.json() as { error?: string }; if (!response.ok) setError(result.error || "Unable to create program."); else { form.reset(); notify("Loyalty program created"); await load(); } setCreating(false); }
  async function patch(id: string, payload: Record<string, unknown>) { const response = await fetch("/api/admin/loyalty", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) }); const result = await response.json() as { error?: string }; if (!response.ok) return setError(result.error || "Unable to update loyalty."); notify(payload.action === "fulfill" ? "Physical reward marked fulfilled" : "Loyalty program updated"); await load(); }
  if (loading) return <div className="adminCard">Loading loyalty programs…</div>;
  return <div className="adminStack loyaltyAdmin">
    {error && <div className="adminLoginError">{error}</div>}
    <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Configurable rules</span><h3>Create loyalty program</h3></div></div>
      <form className="adminForm" onSubmit={create}>
        <label>Program name<input name="name" placeholder="Buy 5 Vietnamese Coffees" required /></label>
        <label>Eligible product<select name="triggerProductId" required><option value="">Choose product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Required quantity<input name="requiredQuantity" type="number" defaultValue={5} min={1} max={1000} required /></label>
        <label>Reward type<select name="rewardType" defaultValue="free_product"><option value="free_product">Free menu product</option><option value="physical_gift">Physical gift</option></select></label>
        <label>Free product<select name="rewardProductId"><option value="">Not applicable / choose product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Reward name<input name="rewardName" placeholder="Free coffee or LEVIEN teddy bear" required /></label>
        <label>Reward expires after<input name="expiresDays" type="number" defaultValue={90} min={1} max={730} required /></label>
        <label className="adminCheck"><input name="repeatable" type="checkbox" defaultChecked /> Repeat after every completed set</label>
        <label className="wide">Description<textarea name="description" rows={3} maxLength={500} /></label>
        <div className="wide"><button className="adminPrimary" disabled={creating}>{creating ? "Creating…" : "Create Program"}</button></div>
      </form>
      <small>For a physical gift, leave “Free product” empty. For a free menu item, choose the product the customer can redeem.</small>
    </section>
    <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Live programs</span><h3>Rules</h3></div></div>
      <div className="loyaltyRuleRows">{rules.length ? rules.map((rule) => <article key={rule.id}><div><strong>{rule.name}</strong><span>Buy {rule.required_quantity} × {productMap.get(rule.trigger_product_id) || "Product"} → {rule.reward_name}</span><small>{rule.repeatable ? "Repeatable" : "One time"} · reward expires in {rule.reward_expires_days} days</small></div><button className={rule.active ? "adminSecondary" : "adminPrimary"} onClick={() => void patch(rule.id, { active: !rule.active })}>{rule.active ? "Pause" : "Activate"}</button></article>) : <p>No programs yet.</p>}</div>
    </section>
    <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Counter fulfillment</span><h3>Physical gifts waiting</h3></div></div>
      <div className="loyaltyRuleRows">{rewards.length ? rewards.map((reward) => { const customer = customerMap.get(reward.customer_profile_id); return <article key={reward.id}><div><strong>{reward.reward_name}</strong><span>{customer ? `${customer.first_name} ${customer.last_name} · ${customer.membership_number}` : "Member"}</span><small>{reward.reward_code} · issued {new Date(reward.issued_at).toLocaleDateString()}</small></div><button className="adminPrimary" onClick={() => void patch(reward.id, { action: "fulfill" })}>Mark Handed Over</button></article>; }) : <p>No physical gifts are waiting.</p>}</div>
    </section>
  </div>;
}
