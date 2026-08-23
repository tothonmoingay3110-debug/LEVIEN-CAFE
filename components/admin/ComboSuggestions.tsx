"use client";

import { useMemo, useState } from "react";
import type { CustomerOrder } from "@/types";

type SuggestionProduct = {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  active: boolean;
  soldOut: boolean;
};

type ExistingCombo = { productIds: string[] };

export type ComboSuggestionDraft = {
  productIds: [string, string];
  name: string;
  description: string;
  regularPrice: number;
  suggestedPrice: number;
  orderCount: number;
  confidence: number;
  support: number;
  score: number;
  signal: "Strong" | "Growing" | "Early";
};

type PairAccumulator = { productIds: [string, string]; orderCount: number };

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function pairKey(left: string, right: string) {
  return [left, right].sort().join(":");
}

export default function ComboSuggestions({
  products,
  combos,
  orders,
  createDraft,
}: {
  products: SuggestionProduct[];
  combos: ExistingCombo[];
  orders: CustomerOrder[];
  createDraft: (suggestion: ComboSuggestionDraft) => void;
}) {
  const [range, setRange] = useState("90");
  const [createdKey, setCreatedKey] = useState("");

  const analysis = useMemo(() => {
    const days = range === "all" ? null : Number(range);
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    const productMap = new Map(products.filter((product) => product.active && !product.soldOut).map((product) => [product.id, product]));
    const completedOrders = orders.filter((order) => order.status === "Completed" && (!cutoff || new Date(order.createdAt).getTime() >= cutoff));
    const productOrders = new Map<string, number>();
    const pairs = new Map<string, PairAccumulator>();
    const existingPairs = new Set<string>();

    combos.forEach((combo) => {
      const ids = [...new Set(combo.productIds)];
      for (let left = 0; left < ids.length; left++) {
        for (let right = left + 1; right < ids.length; right++) {
          existingPairs.add(pairKey(ids[left], ids[right]));
        }
      }
    });

    completedOrders.forEach((order) => {
      const ids = [...new Set(order.items
        .filter((item) => item.itemType !== "combo" && productMap.has(item.productId))
        .map((item) => item.productId))];
      ids.forEach((id) => productOrders.set(id, (productOrders.get(id) || 0) + 1));
      for (let left = 0; left < ids.length; left++) {
        for (let right = left + 1; right < ids.length; right++) {
          const key = pairKey(ids[left], ids[right]);
          if (existingPairs.has(key)) continue;
          const sorted = [ids[left], ids[right]].sort() as [string, string];
          const current = pairs.get(key);
          if (current) current.orderCount += 1;
          else pairs.set(key, { productIds: sorted, orderCount: 1 });
        }
      }
    });

    const suggestions = [...pairs.values()].flatMap((pair): ComboSuggestionDraft[] => {
      const first = productMap.get(pair.productIds[0]);
      const second = productMap.get(pair.productIds[1]);
      if (!first || !second) return [];
      const smallerProductBase = Math.max(1, Math.min(productOrders.get(first.id) || 0, productOrders.get(second.id) || 0));
      const confidence = pair.orderCount / smallerProductBase * 100;
      const support = completedOrders.length ? pair.orderCount / completedOrders.length * 100 : 0;
      const crossCategoryBonus = first.categoryId && second.categoryId && first.categoryId !== second.categoryId ? 8 : 0;
      const score = Math.min(100, Math.round(confidence * .55 + support * .25 + Math.min(22, pair.orderCount * 3) + crossCategoryBonus));
      const regularPrice = Number((first.price + second.price).toFixed(2));
      const suggestedPrice = Math.max(.01, Math.floor(regularPrice * .9 * 20) / 20);
      const signal = pair.orderCount >= 5 && confidence >= 40 ? "Strong" : pair.orderCount >= 2 ? "Growing" : "Early";
      return [{
        productIds: pair.productIds,
        name: `${first.name} + ${second.name} Combo`,
        description: `Frequently purchased together: ${first.name} and ${second.name}. Review pricing and publish when ready.`,
        regularPrice,
        suggestedPrice,
        orderCount: pair.orderCount,
        confidence: Math.round(confidence),
        support: Math.round(support),
        score,
        signal,
      }];
    }).sort((left, right) => right.score - left.score || right.orderCount - left.orderCount).slice(0, 8);

    return { completedOrders: completedOrders.length, candidatePairs: pairs.size, suggestions, productMap };
  }, [combos, orders, products, range]);

  function create(suggestion: ComboSuggestionDraft) {
    createDraft(suggestion);
    setCreatedKey(pairKey(...suggestion.productIds));
  }

  return <div className="adminStack comboSuggestions">
    <section className="adminWelcome comboSuggestionWelcome">
      <div><span>Data-assisted recommendations</span><h2>Turn real purchase patterns into better combos.</h2><p>Suggestions use completed orders only. No customer details leave LEVIEN and no paid AI service is required.</p></div>
      <label>Analysis window<select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option><option value="all">All completed orders</option></select></label>
    </section>
    <section className="adminMetrics comboSuggestionMetrics">
      <div className="adminMetric"><span>Orders analyzed</span><strong>{analysis.completedOrders}</strong><small>Completed orders in this window</small></div>
      <div className="adminMetric"><span>Candidate pairs</span><strong>{analysis.candidatePairs}</strong><small>Existing combo pairs excluded</small></div>
      <div className="adminMetric"><span>Recommendations</span><strong>{analysis.suggestions.length}</strong><small>Ranked by repeat purchase signal</small></div>
    </section>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Explainable ranking</span><h3>Recommended combo drafts</h3></div><span className="adminHint">Suggested price starts near 10% savings</span></div>
      {analysis.suggestions.length ? <div className="comboSuggestionGrid">{analysis.suggestions.map((suggestion, index) => {
        const first = analysis.productMap.get(suggestion.productIds[0]);
        const second = analysis.productMap.get(suggestion.productIds[1]);
        const key = pairKey(...suggestion.productIds);
        return <article key={key}>
          <header><span>#{index + 1}</span><b className={`comboSignal ${suggestion.signal.toLowerCase()}`}>{suggestion.signal} signal</b><strong>{suggestion.score}/100</strong></header>
          <h4>{first?.name} <i>+</i> {second?.name}</h4>
          <div className="comboSuggestionPrice"><span>Regular <s>{money(suggestion.regularPrice)}</s></span><strong>{money(suggestion.suggestedPrice)}</strong><small>Save {money(suggestion.regularPrice - suggestion.suggestedPrice)}</small></div>
          <dl><div><dt>Bought together</dt><dd>{suggestion.orderCount} orders</dd></div><div><dt>Pair confidence</dt><dd>{suggestion.confidence}%</dd></div><div><dt>Order support</dt><dd>{suggestion.support}%</dd></div></dl>
          <p>Confidence measures how often the less-frequent product was purchased with the other product.</p>
          <button className={createdKey === key ? "adminSecondary" : "adminPrimary"} type="button" disabled={createdKey === key} onClick={() => create(suggestion)}>{createdKey === key ? "Draft Created" : "Create Draft Combo"}</button>
        </article>;
      })}</div> : <div className="comboSuggestionEmpty"><strong>Not enough independent product pairs yet.</strong><p>Complete orders containing at least two non-combo products will produce recommendations here. Existing combo pairs are intentionally excluded.</p></div>}
    </section>
  </div>;
}
