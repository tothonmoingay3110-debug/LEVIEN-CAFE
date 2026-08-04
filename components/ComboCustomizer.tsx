"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/components/StoreProvider";
import type { Combo, ComboProductSelection, Product, ProductTopping } from "@/types";

const iceLevels = ["100%", "70%", "50%", "30%", "No Ice"];
const sugarLevels = ["100%", "70%", "50%", "30%", "No Sugar"];

type SelectionState = Record<string, {
  ice: string;
  sugar: string;
  toppings: ProductTopping[];
  note: string;
}>;

export function ComboCustomizer({ combo, products, close }: { combo: Combo; products: Product[]; close: () => void }) {
  const { addCombo } = useStore();
  const comboProducts = useMemo(
    () => combo.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[],
    [combo.productIds, products],
  );
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<SelectionState>(() => Object.fromEntries(comboProducts.map((product) => [product.id, {
    ice: "100%",
    sugar: "100%",
    toppings: [],
    note: "",
  }])));

  const toppingTotal = useMemo(() => (Object.values(selections) as Array<SelectionState[string]>).reduce(
    (total, selection) => total + selection.toppings.reduce((sum, topping) => sum + topping.price, 0),
    0,
  ), [selections]);
  const regularPrice = comboProducts.reduce((sum, product) => sum + product.price, 0);
  const total = (Number(combo.price) + toppingTotal) * quantity;
  const unavailable = comboProducts.length !== combo.productIds.length || comboProducts.some((product) => product.soldOut);

  function change(productId: string, next: Partial<SelectionState[string]>) {
    setSelections((current) => ({
      ...current,
      [productId]: { ...current[productId], ...next },
    }));
  }

  function toggleTopping(productId: string, topping: ProductTopping) {
    const current = selections[productId]?.toppings || [];
    change(productId, {
      toppings: current.some((item) => item.id === topping.id)
        ? current.filter((item) => item.id !== topping.id)
        : [...current, topping],
    });
  }

  function submit() {
    if (unavailable) return;
    const selectedItems: ComboProductSelection[] = comboProducts.map((product) => ({
      productId: product.id,
      name: product.name,
      emoji: product.emoji,
      ice: product.allowIce ? selections[product.id]?.ice : undefined,
      sugar: product.allowSugar ? selections[product.id]?.sugar : undefined,
      toppings: product.allowToppings ? selections[product.id]?.toppings || [] : [],
      note: selections[product.id]?.note.trim() || "",
    }));
    addCombo(combo, selectedItems, quantity);
    close();
  }

  return <div className="customizerBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section className="customizerModal comboCustomizerModal" role="dialog" aria-modal="true" aria-label={`Customize ${combo.name}`}>
      <header className="customizerHeader">
        <div>
          <span className="sectionLabel">Fixed combo</span>
          <h2>{combo.name}</h2>
          <p>Combo ${Number(combo.price).toFixed(2)} · Regular ${regularPrice.toFixed(2)}</p>
        </div>
        <button className="customizerClose" onClick={close} aria-label="Close">×</button>
      </header>

      <div className="customizerBody comboCustomizerBody">
        {unavailable && <div className="comboUnavailable">This combo is currently unavailable because one of its items is sold out or missing.</div>}
        {comboProducts.map((product, index) => {
          const selection = selections[product.id];
          return <section className="comboProductBlock" key={product.id}>
            <div className="comboProductHeading">
              <span>{product.image ? <img src={product.image} alt="" /> : product.emoji}</span>
              <div><small>Item {index + 1}</small><h3>{product.name}</h3></div>
              {product.soldOut && <b>Sold out</b>}
            </div>

            {product.allowIce && <OptionGroup title="Ice Level" values={iceLevels} value={selection?.ice || "100%"} onChange={(value) => change(product.id, { ice: value })} />}
            {product.allowSugar && <OptionGroup title="Sugar Level" values={sugarLevels} value={selection?.sugar || "100%"} onChange={(value) => change(product.id, { sugar: value })} />}
            {product.allowToppings && !!product.toppings?.length && <fieldset className="customizerGroup">
              <legend>Toppings</legend>
              <div className="toppingOptions">{product.toppings.map((topping) => {
                const checked = selection?.toppings.some((item) => item.id === topping.id);
                return <label className={`toppingOption ${checked ? "selected" : ""}`} key={topping.id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleTopping(product.id, topping)} />
                  <span><strong>{topping.name}</strong><small>+${topping.price.toFixed(2)}</small></span>
                </label>;
              })}</div>
            </fieldset>}
            <label className="customizerNote comboItemNote"><span>Item Note <small>Optional</small></span><textarea value={selection?.note || ""} onChange={(event) => change(product.id, { note: event.target.value })} placeholder="No onion, sauce on the side..." rows={2}/></label>
          </section>;
        })}

        <div className="comboQuantityRow">
          <div><strong>Combo quantity</strong><small>All items repeat together.</small></div>
          <div className="customizerQuantity"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => value + 1)}>+</button></div>
        </div>
      </div>

      <footer className="customizerFooter"><div><span>Total</span><strong>${total.toFixed(2)}</strong>{toppingTotal > 0 && <small>Includes ${toppingTotal.toFixed(2)} add-ons per combo</small>}</div><button className="button primary" onClick={submit} disabled={unavailable}>Add Combo to Order</button></footer>
    </section>
  </div>;
}

function OptionGroup({ title, values, value, onChange }: { title: string; values: string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset className="customizerGroup"><legend>{title}</legend><div className="levelOptions">{values.map((item) => <label className={value === item ? "selected" : ""} key={item}><input type="radio" checked={value === item} onChange={() => onChange(item)} /><span>{item}</span></label>)}</div></fieldset>;
}
