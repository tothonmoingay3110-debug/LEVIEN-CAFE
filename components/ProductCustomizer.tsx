"use client";

import { useMemo, useState } from "react";
import type { Product, ProductTopping } from "@/types";
import { useStore } from "@/components/StoreProvider";

const iceLevels = ["100%", "70%", "50%", "30%", "No Ice"];
const sugarLevels = ["100%", "70%", "50%", "30%", "No Sugar"];

export function ProductCustomizer({ product, close }: { product: Product; close: () => void }) {
  const { addProduct } = useStore();
  const [ice, setIce] = useState("100%");
  const [sugar, setSugar] = useState("100%");
  const [selected, setSelected] = useState<ProductTopping[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const unitPrice = useMemo(() => product.price + selected.reduce((sum, item) => sum + item.price, 0), [product.price, selected]);
  const total = unitPrice * quantity;

  function toggleTopping(topping: ProductTopping) {
    setSelected((current) => current.some((item) => item.id === topping.id) ? current.filter((item) => item.id !== topping.id) : [...current, topping]);
  }

  function submit() {
    addProduct(product, {
      quantity,
      ice: product.allowIce ? ice : undefined,
      sugar: product.allowSugar ? sugar : undefined,
      toppings: product.allowToppings ? selected : [],
      note,
    });
    close();
  }

  return (
    <div className="customizerBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="customizerModal" role="dialog" aria-modal="true" aria-label={`Customize ${product.name}`}>
        <header className="customizerHeader">
          <div><span className="sectionLabel">Made your way</span><h2>{product.name}</h2><p>Base price ${product.price.toFixed(2)}</p></div>
          <button className="customizerClose" onClick={close} aria-label="Close">×</button>
        </header>

        <div className="customizerBody">
          {product.allowIce && <OptionGroup title="Ice Level" values={iceLevels} value={ice} onChange={setIce} />}
          {product.allowSugar && <OptionGroup title="Sugar Level" values={sugarLevels} value={sugar} onChange={setSugar} />}

          {product.allowToppings && !!product.toppings?.length && <fieldset className="customizerGroup">
            <legend>Toppings</legend>
            <div className="toppingOptions">{product.toppings.map((topping) => {
              const checked = selected.some((item) => item.id === topping.id);
              return <label className={`toppingOption ${checked ? "selected" : ""}`} key={topping.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleTopping(topping)} />
                {topping.image ? <img className="toppingOptionImage" src={topping.image} alt=""/> : <span className="toppingOptionFallback">＋</span>}
                <span><strong>{topping.name}</strong><small>+${topping.price.toFixed(2)}</small></span>
              </label>;
            })}</div>
          </fieldset>}

          <div className="customizerSplit">
            <div className="customizerGroup"><h3>Quantity</h3><div className="customizerQuantity"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => value + 1)}>+</button></div></div>
            <label className="customizerNote"><span>Special Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Less ice, separate topping..." rows={3}/></label>
          </div>
        </div>

        <footer className="customizerFooter"><div><span>Total</span><strong>${total.toFixed(2)}</strong></div><button className="button primary" onClick={submit}>Add to Order</button></footer>
      </section>
    </div>
  );
}

function OptionGroup({ title, values, value, onChange }: { title: string; values: string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset className="customizerGroup"><legend>{title}</legend><div className="levelOptions">{values.map((item) => <label className={value === item ? "selected" : ""} key={item}><input type="radio" checked={value === item} onChange={() => onChange(item)} /><span>{item}</span></label>)}</div></fieldset>;
}
