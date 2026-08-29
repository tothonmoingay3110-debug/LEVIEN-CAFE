"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; price: number };
type RewardType = "free_product" | "physical_gift";
type Rule = {
  id: string;
  name: string;
  description: string;
  trigger_product_id: string;
  trigger_product_ids: string[];
  required_quantity: number;
  reward_type: RewardType;
  reward_product_id: string | null;
  reward_product_ids: string[];
  reward_name: string;
  reward_expires_days: number;
  repeatable: boolean;
  active: boolean;
  starts_on: string;
  ends_on: string | null;
};
type Reward = { id: string; reward_code: string; reward_name: string; customer_profile_id: string; issued_at: string; expires_at: string | null };
type Customer = { id: string; first_name: string; last_name: string; email: string; membership_number: string };
type RewardItem = { id: string; sku: string; name: string; image_url: string | null; stock_quantity: number; active: boolean };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default function LoyaltyPrograms({ notify }: { notify: (message: string) => void }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [rewardType, setRewardType] = useState<RewardType>("free_product");
  const customerMap = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/loyalty", { cache: "no-store" });
      const result = await response.json() as { rules?: Rule[]; products?: Product[]; physicalRewards?: Reward[]; customers?: Customer[]; rewardItems?: RewardItem[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load loyalty programs.");
      setRules(result.rules || []);
      setProducts(result.products || []);
      setRewards(result.physicalRewards || []);
      setCustomers(result.customers || []);
      setRewardItems(result.rewardItems || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load loyalty programs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const triggerProductIds = data.getAll("triggerProductIds").map(String);
    const rewardProductIds = data.getAll("rewardProductIds").map(String);
    if (!triggerProductIds.length) return setError("Choose at least one eligible product.");
    if (rewardType === "free_product" && !rewardProductIds.length) return setError("Choose at least one product customers may redeem.");
    if (rewardType === "physical_gift" && !data.get("rewardItemId")) return setError("Choose a physical gift from inventory.");

    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
          triggerProductIds,
          requiredQuantity: Number(data.get("requiredQuantity")),
          rewardType,
          rewardProductIds,
          rewardName: data.get("rewardName"),
          rewardItemId: data.get("rewardItemId"),
          expiresDays: Number(data.get("expiresDays")),
          repeatable: data.get("repeatable") === "on",
          startsOn: data.get("startsOn"),
          endsOn: data.get("endsOn"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to create program.");
      form.reset();
      setRewardType("free_product");
      setShowCreate(false);
      notify("Loyalty program created");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create program.");
    } finally {
      setCreating(false);
    }
  }

  async function patchRule(id: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/loyalty", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setError(result.error || "Unable to update loyalty.");
    notify(payload.action === "fulfill" ? "Physical reward marked fulfilled" : "Loyalty program updated");
    await load();
  }

  async function createRewardItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setError("");
    try {
      let imageUrl = ""; const image = data.get("image");
      if (image instanceof File && image.size) { const upload = new FormData(); upload.set("file", image); upload.set("scope", "reward"); const uploaded = await fetch("/api/admin/uploads", { method: "POST", body: upload }); const result = await uploaded.json() as { url?: string; error?: string }; if (!uploaded.ok || !result.url) throw new Error(result.error || "Unable to upload reward image."); imageUrl = result.url; }
      const response = await fetch("/api/admin/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "reward_item", sku: data.get("sku"), name: data.get("name"), stockQuantity: Number(data.get("stockQuantity")), imageUrl }) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Unable to create physical gift."); form.reset(); notify("Physical gift added to inventory"); await load();
    } catch (itemError) { setError(itemError instanceof Error ? itemError.message : "Unable to create physical gift."); }
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setRewardType("free_product");
    setError("");
  }

  if (loading) return <div className="adminCard">Loading loyalty programs…</div>;

  return <div className="adminStack loyaltyAdmin">
    {error && <div className="adminLoginError" role="alert">{error}</div>}
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Configurable rules</span><h3>Loyalty programs</h3></div><button className="adminPrimary" type="button" onClick={() => { setError(""); setShowCreate(true); }}>Create Program</button></div>
      <div className="loyaltyRuleRows">{rules.length ? rules.map((rule) => {
        const triggerNames = rule.trigger_product_ids.map((id) => productMap.get(id)).filter(Boolean).join(", ") || productMap.get(rule.trigger_product_id) || "Product";
        const rewardNames = rule.reward_product_ids.map((id) => productMap.get(id)).filter(Boolean).join(", ");
        return <article key={rule.id}><div><strong>{rule.name}</strong><span>Buy {rule.required_quantity} total across: {triggerNames}</span><small>{rule.reward_name}{rewardNames ? ` · choices: ${rewardNames}` : ""}</small><small>{formatDate(rule.starts_on)} – {rule.ends_on ? formatDate(rule.ends_on) : "No end date"} · {rule.repeatable ? "Repeatable" : "One time"} · reward expires in {rule.reward_expires_days} days</small></div><button className={rule.active ? "adminSecondary" : "adminPrimary"} onClick={() => void patchRule(rule.id, { active: !rule.active })}>{rule.active ? "Pause" : "Activate"}</button></article>;
      }) : <p>No programs yet.</p>}</div>
    </section>
    <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Physical reward inventory</span><h3>Gift catalog</h3></div></div><form className="rewardInventoryForm" onSubmit={createRewardItem}><label>SKU<input name="sku" placeholder="GIFT-TEDDY" required /></label><label>Gift name<input name="name" placeholder="LEVIEN teddy bear" required /></label><label>Stock<input name="stockQuantity" type="number" min={0} defaultValue={0} required /></label><label>Image<input name="image" type="file" accept="image/png,image/jpeg,image/webp" /></label><button className="adminPrimary">Add Gift</button></form>{rewardItems.length > 0 && <div className="rewardInventoryGrid">{rewardItems.map((item) => <article key={item.id}>{item.image_url ? <img src={item.image_url} alt="" /> : <span>🎁</span>}<div><strong>{item.name}</strong><small>{item.sku} · {item.stock_quantity} in stock · {item.active ? "Active" : "Inactive"}</small></div></article>)}</div>}</section>
    {rewards.length > 0 && <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Counter fulfillment</span><h3>Physical gifts waiting</h3></div></div>
      <div className="loyaltyRuleRows">{rewards.map((reward) => { const customer = customerMap.get(reward.customer_profile_id); return <article key={reward.id}><div><strong>{reward.reward_name}</strong><span>{customer ? `${customer.first_name} ${customer.last_name} · ${customer.membership_number}` : "Member"}</span><small>{reward.reward_code} · issued {new Date(reward.issued_at).toLocaleDateString()}</small></div><button className="adminPrimary" onClick={() => void patchRule(reward.id, { action: "fulfill" })}>Mark Handed Over</button></article>; })}</div>
    </section>}
    {showCreate && <div className="adminModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCreate(); }}>
      <div className="adminModal loyaltyProgramModal" role="dialog" aria-modal="true" aria-labelledby="create-loyalty-title">
        <header><div><span className="adminEyebrow">Configurable rules</span><h2 id="create-loyalty-title">Create loyalty program</h2></div><button type="button" aria-label="Close" disabled={creating} onClick={closeCreate}>×</button></header>
        {error && <div className="adminLoginError" role="alert">{error}</div>}
        <form className="adminForm" onSubmit={create}>
          <label>Program name<input name="name" placeholder="Buy 5 Vietnamese Coffees" required /></label>
          <label>Required quantity<input name="requiredQuantity" type="number" defaultValue={5} min={1} max={1000} required /></label>
          <fieldset className="loyaltyProductPicker wide">
            <legend>Eligible products <span>Select one or more products that count toward this program.</span></legend>
            <div className="loyaltyProductGrid">{products.map((item) => <label key={item.id} className="loyaltyProductChoice"><input name="triggerProductIds" type="checkbox" value={item.id} /><span><strong>{item.name}</strong><small>${item.price.toFixed(2)}</small></span></label>)}</div>
          </fieldset>
          <label>Reward type<select name="rewardType" value={rewardType} onChange={(event) => setRewardType(event.target.value as RewardType)}><option value="free_product">Free menu product</option><option value="physical_gift">Physical gift</option></select></label>
          {rewardType === "free_product" ? <label>Reward name<input name="rewardName" placeholder="Free coffee" required /></label> : <label>Physical gift<select name="rewardItemId" required defaultValue=""><option value="">Select an in-stock gift</option>{rewardItems.filter((item) => item.active && item.stock_quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stock_quantity} in stock</option>)}</select><input name="rewardName" value={rewardItems[0]?.name || "Physical gift"} readOnly hidden /></label>}
          {rewardType === "free_product" && <fieldset className="loyaltyProductPicker wide">
            <legend>Reward choices <span>Customers may redeem any one of the selected products.</span></legend>
            <div className="loyaltyProductGrid">{products.map((item) => <label key={item.id} className="loyaltyProductChoice"><input name="rewardProductIds" type="checkbox" value={item.id} /><span><strong>{item.name}</strong><small>${item.price.toFixed(2)}</small></span></label>)}</div>
          </fieldset>}
          <label>Start date<input name="startsOn" type="date" defaultValue={today()} required /></label>
          <label>End date<input name="endsOn" type="date" min={today()} required /></label>
          <label>Reward expires after (days)<input name="expiresDays" type="number" defaultValue={90} min={1} max={730} required /></label>
          <label className="adminCheck"><input name="repeatable" type="checkbox" defaultChecked /> Repeat after every completed set</label>
          <label className="wide">Description<textarea name="description" rows={3} maxLength={500} /></label>
          <p className="loyaltyFormHint wide">Selected eligible products are counted together. A free-product reward lets the customer choose one item from the configured reward choices.</p>
          <div className="adminFormActions wide"><button className="adminSecondary" type="button" disabled={creating} onClick={closeCreate}>Cancel</button><button className="adminPrimary" disabled={creating}>{creating ? "Creating…" : "Create Program"}</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
